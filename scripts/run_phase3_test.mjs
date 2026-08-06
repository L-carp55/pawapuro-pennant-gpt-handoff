// Phase 3 検証: **能力値変換を挟んで**1シーズン回し、リーグ分布が実測と一致するかを見る。
//
// Phase 2（scripts/run_season_test.mjs）との違いはここだけ:
//   Phase 2: 実成績 → 確率ベクトル → エンジン          （変換を挟まない＝エンジン単体の検査）
//   Phase 3: 実成績 → **査定（能力値）** → 確率ベクトル → エンジン
//
// つまり設計書 §1 の「査定はエンジンの逆算」が本当に往復しているかを、リーグ全体の分布で確かめる。
// Phase 2 が合っている状態が前提（2026-08-04に4指標すべてノイズ内へ到達済み）なので、
// ここでずれたら**原因は査定側**と切り分けられる。
//
// 能力値は0-100の粗い目盛りで、しかも少打席の選手はPriorへ縮小される。
// 縮小は個々の選手を平均へ寄せるので、**リーグ全体の散らばりは実測より小さく出るのが正しい**。
// したがって見るのは水準（平均）の一致であって、散らばりの一致ではない。

import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng } from '../src/engine/rng.mjs';
import { rateVectorFromCounts, OUTCOMES, poolBaseline } from '../src/engine/odds.mjs';
import { playSeason } from '../src/engine/season.mjs';
import { drawLineup } from '../src/engine/lineup.mjs';
import { ratesFromRatings } from '../src/ratings/to_rates.mjs';
import { fitLogDist } from '../src/ratings/scale.mjs';
import { gammaForLevel } from '../src/ratings/from_rates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] || 2024);
const SEED = Number(process.argv[3] || 20260731);
const SEEDS = Number(process.env.SEEDS ?? 10);

const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const engineCfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'engine.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

// ★読み先は `scripts/appraise_season.mjs` が実際に書く場所（outputs/）。
// outputs/derived/ にも同名ファイルがあるが、そちらは**基準打数を436.25→490へ変えた
// 2026-07-31以前の古い写し**で、読むと全選手が一律 436.25/490 = -10.97% ずれる
// （2026-08-04にPhase 3で検出。査定オブジェクト自身のAB・HRで検算したら174人**全員**が
// 同じ倍率でずれており、選手ごとの誤差でなく単位のずれだと分かった）
const APPRAISAL = path.join(ROOT, 'outputs', `appraisal_${SEASON}.json`);
const appraisal = JSON.parse(await readFile(APPRAISAL, 'utf8'));

// 読み込んだ査定が今の設定と同じ基準打数で作られているかを、その場で検算する。
// 古い成果物を黙って使わないための門番（合わなければ止める）
{
  const bad = appraisal.filter(a => {
    const o = a.observed;
    if (!o?.raw?.hrPer500 || !o.AB || a.hr == null) return false;
    return Math.abs(o.raw.hrPer500 / cfg.ab_ref.value * o.AB - a.hr) > 0.05;
  });
  if (bad.length > appraisal.length * 0.05) {
    const r = bad[0].observed.raw.hrPer500 / cfg.ab_ref.value * bad[0].observed.AB / bad[0].hr;
    console.error(`査定ファイルが今の設定と合いません: ${bad.length}/${appraisal.length}人で`
      + `本塁打の逆算が実測と一致しない（倍率 ${r.toFixed(4)}）。`
      + `基準打数 ab_ref=${cfg.ab_ref.value} で作り直してください: node scripts/appraise_season.mjs ${SEASON}`);
    process.exit(1);
  }
}

const normName = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');
const byName = new Map(appraisal.map(a => [normName(a.name), a]));

const MIN_PA = Number(process.env.MIN_PA ?? 30);
const batters = db.prepare(`
  SELECT player_id, name, team, pa, ab, h, b1, b2, b3, hr, bb, hbp, so, sh, sf
  FROM v_batting WHERE season=? AND pa >= ? ORDER BY team, pa DESC`).all(SEASON, MIN_PA);
const pitchers = db.prepare(`
  SELECT player_id, name, team, outs, bf, h, hr, so, bb, hbp, gs
  FROM v_pitching WHERE season=? AND outs >= 60 ORDER BY team, outs DESC`).all(SEASON);

// Phase 2 で確定した定義（bfをそのまま使い、矛盾行だけ再構成へ落とす）
function pitcherPA(p) {
  const floor = p.h + p.bb + p.hbp;
  return (p.bf != null && p.bf >= floor) ? p.bf : (p.outs + p.h + p.bb + p.hbp);
}

const lgRow = db.prepare(`
  SELECT SUM(pa) pa, SUM(bb) bb, SUM(hbp) hbp, SUM(so) so,
         SUM(b1) b1, SUM(b2) b2, SUM(b3) b3, SUM(hr) hr, SUM(sh) sh, SUM(sf) sf
  FROM v_batting WHERE season=?`).get(SEASON);
const nonHrHits = lgRow.b1 + lgRow.b2 + lgRow.b3;
const share = { B1: lgRow.b1 / nonHrHits, B2: lgRow.b2 / nonHrHits, B3: lgRow.b3 / nonHrHits };

function pitcherRates(p) {
  const pa = pitcherPA(p);
  const hNonHr = Math.max(p.h - p.hr, 0);
  return rateVectorFromCounts({
    PA: pa, BB: p.bb, HBP: p.hbp, SO: p.so,
    B1: Math.round(hNonHr * share.B1), B2: Math.round(hNonHr * share.B2), B3: Math.round(hNonHr * share.B3),
    HR: p.hr,
  });
}

// 能力値→レートに要る、能力に依存しない要素はリーグ実測から取る
const lgHbp = lgRow.hbp / lgRow.pa;
const lgSac = (lgRow.sh + lgRow.sf) / lgRow.pa;

// 能力値スケールの基準分布。**査定時（scripts/appraise_season.mjs）と同じ作り方でなければ
// 往復にならない**——あちらは「打席200以上・投手を除く」層から作っている
const distBase = db.prepare(`
  SELECT so, bb, pa FROM v_batting WHERE season=? AND pa >= 200 AND position <> '投'`).all(SEASON);
const dists = {
  contact: fitLogDist(distBase.map(r => r.so / r.pa)),
  eye: fitLogDist(distBase.map(r => r.bb / r.pa)),
};

/**
 * ★環境補正の戻し（2026-08-04発見）。
 *
 * 査定は成績を**2019年NPB基準へ正規化**して能力値にしている（configs `environment`、
 * 式は `rate_env = rate_player × (rate_ref / rate_lg_year)^gamma`）。年代の打高打低を
 * 揃えないと、同じ能力の選手が年によって違う能力値になってしまうため。
 *
 * したがって能力値からレートへ戻す時は、**その年の環境へ引き戻さないといけない**。
 * 忘れると2019年の水準でその年を回すことになる——2024年は2019年よりHRが出にくい年
 * （HR/AB 0.01712 vs 0.02924）なので、戻さないと本塁打が実測の1.63倍出る（実測+41%）。
 */
const lgOf = (s) => {
  const r = db.prepare(`SELECT SUM(hr) hr, SUM(ab) ab, SUM(h) h FROM v_batting WHERE season=?`).get(s);
  return { hr: r.hr / r.ab, avg: r.h / r.ab };
};
const REF = lgOf(cfg.environment.reference_season);
const CUR = lgOf(SEASON);
// 査定は ×(REF/CUR)^gamma を掛けている。戻すのはその逆数
const hrRatio = CUR.hr / REF.hr; // 戻す向きの比（査定は REF/CUR を掛けている）
const deEnvAvg = Math.pow(CUR.avg / REF.avg, cfg.environment.gamma_avg);

/** 査定（能力値）から確率ベクトルを作る。査定が無い選手は実成績から直接（穴を空けない） */
function ratesViaRatings(b) {
  const a = byName.get(normName(b.name));
  const direct = () => rateVectorFromCounts({
    PA: b.pa, BB: b.bb, HBP: b.hbp, SO: b.so, B1: b.b1, B2: b.b2, B3: b.b3, HR: b.hr,
  });
  if (!a || !dists) return { rates: direct(), viaRatings: false };
  const r = ratesFromRatings(
    { meet: a.meet, power: a.power, contact: a.contact, eye: a.eye },
    cfg, dists,
    { hbpRate: lgHbp, sacRate: lgSac, hitSplit: share },
    { deEnvAvg, hrRatio, gammaForLevel: (lvl) => gammaForLevel(lvl, cfg) });
  if (!r) return { rates: direct(), viaRatings: false };
  return { rates: r, viaRatings: true };
}

const teamNames = [...new Set(batters.map(b => b.team))];
let viaCount = 0, directCount = 0;
const teams = teamNames.map(tn => {
  const roster = batters.filter(b => b.team === tn).map(b => {
    const { rates, viaRatings } = ratesViaRatings(b);
    if (rates) { viaRatings ? viaCount++ : directCount++; }
    return { id: b.player_id, name: b.name, weight: b.pa, rates };
  }).filter(x => x.rates);
  const tp = pitchers.filter(p => p.team === tn);
  const mk = p => ({ id: p.player_id, name: p.name, rates: pitcherRates(p), weight: pitcherPA(p) });
  return {
    name: tn, roster,
    starters: tp.filter(p => (p.gs ?? 0) >= 5).map(mk).filter(x => x.rates),
    relievers: tp.filter(p => (p.gs ?? 0) < 5).map(mk).filter(x => x.rates),
  };
});

// Phase 2 と同じ起用の作り（母集団・重みを揃えることが検証の前提）
function pickWeighted(list, rand) {
  let total = 0;
  for (const e of list) total += Math.max(e.weight, 0);
  if (!(total > 0)) return list[Math.floor(rand() * list.length)];
  let r = rand() * total;
  for (const e of list) { r -= Math.max(e.weight, 0); if (r <= 0) return e; }
  return list[list.length - 1];
}
function weightedOrder(list, rand) {
  const pool = list.map(e => ({ e, w: Math.max(e.weight, 0) }));
  const out = [];
  while (pool.length) {
    let total = 0;
    for (const x of pool) total += x.w;
    let idx = 0;
    if (total > 0) { let r = rand() * total; for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { idx = i; break; } } }
    out.push(pool[idx].e); pool.splice(idx, 1);
  }
  return out;
}

const baseline = poolBaseline(
  teams.flatMap(t => [...t.starters, ...t.relievers]).map(p => ({ rates: p.rates, weight: p.weight }))
);

const usedIds = teams.flatMap(t => t.roster.map(b => b.id));
const ph = usedIds.map(() => '?').join(',');
const perPlayer = new Map(db.prepare(`
  SELECT player_id, pa, ab, h, hr, so, bb FROM v_batting WHERE season=? AND player_id IN (${ph})`)
  .all(SEASON, ...usedIds).filter(r => r.pa > 0 && r.ab > 0).map(r => [r.player_id, r]));

function runOnce(seed) {
  const r = makeRng(seed);
  const tfs = teams.map(t => ({
    name: t.name,
    get lineup() { return drawLineup(t.roster, r); },
    get starter() { return pickWeighted(t.starters, r); },
    get bullpen() { return weightedOrder(t.relievers, r); },
  }));
  const { playerStats: ps, tally: tl } = playSeason(tfs, { rates: baseline }, r, engineCfg);
  const s = { PA: 0, BB: 0, HBP: 0, SO: 0, B1: 0, B2: 0, B3: 0, HR: 0, OUT: 0 };
  for (const [id, v] of ps) { if (id.startsWith('P:')) continue; for (const k of Object.keys(s)) s[k] += v[k]; }
  const ab = s.PA - s.BB - s.HBP - tl.sh - tl.sf;
  const hits = s.B1 + s.B2 + s.B3 + s.HR;
  const W = (f, abBased) => {
    let n = 0, d = 0;
    for (const [id, v] of ps) {
      if (id.startsWith('P:')) continue;
      const real = perPlayer.get(id); if (!real) continue;
      const w = abBased ? (v.PA - v.BB - v.HBP) : v.PA;
      n += f(real) * w; d += w;
    }
    return n / d;
  };
  const rel = (sim, tgt) => (sim - tgt) / tgt * 100;
  return {
    avg: rel(hits / ab, W(x => x.h / x.ab, true)),
    so: rel(s.SO / s.PA, W(x => x.so / x.pa, false)),
    bb: rel(s.BB / s.PA, W(x => x.bb / x.pa, false)),
    hr: rel(s.HR / ab, W(x => x.hr / x.ab, true)),
  };
}

const dev = { avg: [], so: [], bb: [], hr: [] };
for (let i = 0; i < SEEDS; i++) {
  const o = runOnce(SEED + i * 1013);
  dev.avg.push(o.avg); dev.so.push(o.so); dev.bb.push(o.bb); dev.hr.push(o.hr);
}
const stat = (a) => {
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
  return { m, sd, se: sd / Math.sqrt(a.length) };
};

console.log(`\n=== Phase 3 検証（能力値変換を挟む） ${SEASON}年 / ${SEEDS}シード ===`);
console.log(`査定を通した打者 ${viaCount}人 / 実成績を直接使った打者 ${directCount}人`
  + `（査定が無い or 変換できない選手は穴を空けず実成績で埋める）`);
console.log('項目'.padEnd(10) + '平均'.padStart(9) + '標準誤差'.padStart(10) + '1シードのsd'.padStart(13) + '  判定');
for (const [k, label] of [['avg', '打率'], ['so', '三振率'], ['bb', '四球率'], ['hr', '本塁打率']]) {
  const s = stat(dev[k]);
  const sig = Math.abs(s.m) > 2 * s.se ? '★実在する残差' : 'ノイズと区別できない';
  console.log(label.padEnd(9) + (s.m >= 0 ? '+' : '') + s.m.toFixed(2).padStart(7) + '%'
    + ('±' + s.se.toFixed(2)).padStart(9) + s.sd.toFixed(2).padStart(12) + '  ' + sig);
}
console.log('\n※Phase 2（変換を挟まない）と比べて悪化した分が、査定→能力値→レートの往復で失われた精度。'
  + 'Phase 2は4指標すべてノイズ内へ到達済みなので、ここでずれたら原因は査定側にある');
db.close();
