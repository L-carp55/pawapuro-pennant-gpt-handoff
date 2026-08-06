// Phase 2 検証: 実選手の実成績から確率ベクトルを作り、1シーズン回して
// リーグ全体の分布が実測と一致するかを見る。能力値変換は挟まない（エンジン単体の検証）。
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng } from '../src/engine/rng.mjs';
import { rateVectorFromCounts, OUTCOMES, poolBaseline } from '../src/engine/odds.mjs';
import { playSeason } from '../src/engine/season.mjs';
import { drawLineup } from '../src/engine/lineup.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] || 2024);
const SEED = Number(process.argv[3] || 20260731);

const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'engine.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

// --- 打者 ---
// 上位9人だけを使うと母集団が実チームとずれる（実チームで上位9人が占めるのは打席の69.7%だけで、
// 残りは打率.205前後の控え・代打・投手が打っている）。この不一致が
//   (a) 得点が実測より多く出る (b) 犠打が出すぎる → 打数が減って打数分母の率がかさ上げされる
// という2つの症状になっていた（2026-08-04、T-0094）。
// そこで**各チームの全打者を実打席数に比例して起用する**（試合ごとに9人を重み付き抽選）。
// 下限を設けるのは、数打席しか立っていない選手の率が乱数同然になるため
const MIN_PA = Number(process.env.MIN_PA ?? 30);
const batters = db.prepare(`
  SELECT player_id, name, team, pa, ab, h, b1, b2, b3, hr, bb, hbp, so, sh, sf
  FROM v_batting WHERE season=? AND pa >= ?
  ORDER BY team, pa DESC`).all(SEASON, MIN_PA);

// --- 投手: 球団ごとに投球回上位。先発=GSが多い5人、残りを救援 ---
const pitchers = db.prepare(`
  SELECT player_id, name, team, outs, bf, h, hr, so, bb, hbp, gs
  FROM v_pitching WHERE season=? AND outs >= 60
  ORDER BY team, outs DESC`).all(SEASON);

/**
 * 投手の対戦打者数。
 *
 * 以前は `max(bf, outs+h+bb+hbp)` としていたが、これは**全行の打席数を2.1%水増ししていた**
 * （2026-08-04発見）。`outs` は投球回×3で**走塁死（盗塁刺・牽制死・走者の封殺）まで含む**ため、
 * 再構成値は本来の対戦打者数より構造的に大きくなる。実測でも 2024年の bf 合計は打者側の
 * 総打席数と**完全に一致**（63,762）する一方、再構成値は65,088（+2.08%）だった。
 * さらに「bf に物理的にありえない行がある」という前提も、実際に数えると該当**0件**だった。
 *
 * したがって bf をそのまま使い、欠損または明らかに矛盾する行（安打+四球+死球すら下回る）
 * のときだけ再構成へ落とす。
 */
function pitcherPA(p) {
  const floor = p.h + p.bb + p.hbp; // これ未満はありえない
  if (p.bf != null && p.bf >= floor) return p.bf;
  return p.outs + p.h + p.bb + p.hbp;
}

// リーグ平均（実測）
const lgRow = db.prepare(`
  SELECT SUM(pa) pa, SUM(bb) bb, SUM(hbp) hbp, SUM(so) so,
         SUM(b1) b1, SUM(b2) b2, SUM(b3) b3, SUM(hr) hr
  FROM v_batting WHERE season=?`).get(SEASON);
const league = rateVectorFromCounts({
  PA: lgRow.pa, BB: lgRow.bb, HBP: lgRow.hbp, SO: lgRow.so,
  B1: lgRow.b1, B2: lgRow.b2, B3: lgRow.b3, HR: lgRow.hr,
});

// 投手側の長打内訳はデータに無い（被安打と被本塁打のみ）ので、リーグ平均の比で分配する
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

// --- チーム編成 ---
const teamNames = [...new Set(batters.map(b => b.team))];
const teams = teamNames.map(tn => {
  // ロースター全員。打席数を起用の重みにする
  const roster = batters.filter(b => b.team === tn).map(b => ({
    id: b.player_id, name: b.name, weight: b.pa,
    rates: rateVectorFromCounts({
      PA: b.pa, BB: b.bb, HBP: b.hbp, SO: b.so,
      B1: b.b1, B2: b.b2, B3: b.b3, HR: b.hr,
    }),
  })).filter(x => x.rates);
  const lineup = roster.slice(0, 9); // 編成チェック用の代表（実際の起用は下の抽選）

  const tp = pitchers.filter(p => p.team === tn);
  // 上位5/8人への絞り込みは投手陣をエース級だけに偏らせ選抜バイアスを生む（2026-08-04発見:
  // 本塁打率の乖離-13.7%→-4.0%に改善）。outs>=60の投手は全員プールに含める
  const starters = tp.filter(p => (p.gs ?? 0) >= 5);
  const relievers = tp.filter(p => (p.gs ?? 0) < 5);
  // 起用の重み: 先発・救援とも**実際の対戦打者数**。登板数(gs)ではない——シミュでは1登板の
  // 対戦打者数が投手によらずほぼ一定なので、登板数で重み付けると実際に多く投げた投手の
  // 比重が足りなくなる（分母 poolBaseline は実対戦打者数で加重しているため揃わない）。
  // 均等ローテーションにすると、25試合先発したエースと8試合の投手が同じ扱いになり、
  // 分母(poolBaseline=実起用量で加重)と実際の対戦相手がずれる（2026-08-04発見）
  const mk = p => ({ id: p.player_id, name: p.name, rates: pitcherRates(p), weight: pitcherPA(p) });
  const mkR = p => ({ id: p.player_id, name: p.name, rates: pitcherRates(p), weight: pitcherPA(p) });
  return {
    name: tn,
    roster,
    lineup,
    starters: starters.map(mk).filter(x => x.rates),
    relievers: relievers.map(mkR).filter(x => x.rates),
  };
});

/**
 * 重みを反映した並べ替え（重み付き非復元抽出を全件に繰り返す）。救援の登板順に使う。
 * 常に対戦打者数の多い順に固定すると、毎試合その投手から使うことになり
 * 抑え・セットアッパー（奪三振が高い）へ登板が集中する（2026-08-04発見: 三振率が押し上がる）。
 */
function weightedOrder(list, rand) {
  const pool = list.map(e => ({ e, w: Math.max(e.weight, 0) }));
  const out = [];
  while (pool.length) {
    let total = 0;
    for (const x of pool) total += x.w;
    let idx = pool.length - 1;
    if (total > 0) {
      let r = rand() * total;
      for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { idx = i; break; } }
    } else idx = 0;
    out.push(pool[idx].e);
    pool.splice(idx, 1);
  }
  return out;
}

/** 重みつきで1件選ぶ（復元あり）。先発の指名に使う */
function pickWeighted(list, rand) {
  let total = 0;
  for (const e of list) total += (e.weight > 0 ? e.weight : 0);
  if (!(total > 0)) return list[Math.floor(rand() * list.length)];
  let r = rand() * total;
  for (const e of list) { r -= (e.weight > 0 ? e.weight : 0); if (r <= 0) return e; }
  return list[list.length - 1];
}

/**
 * 1試合分の打順を、打席数を重みにした非復元抽選で作る。
 * 同じ試合に同じ選手を2度入れない。引いた9人は打席数の多い順に上位打順へ置く
 * （実際の打線も良い打者が上位に入るため）。
 */

const bad = teams.filter(t => t.roster.length < 9 || t.starters.length < 1 || t.relievers.length < 1);
if (bad.length) { console.error('編成不足:', bad.map(t => `${t.name}(打${t.roster.length}/先${t.starters.length}/救${t.relievers.length})`)); process.exit(1); }

/** 1シーズン回して、指標ごとの「目標に対する乖離率(%)」を返す。シード違いの再実行に使う */
function runOnce(seed) {
  const r = makeRng(seed);
  let ri = 0;
  const tfs = teams.map(t => ({
    name: t.name,
    // 試合ごとに引き直す（playGame が1試合につき1回だけ team.lineup を読むため）
    get lineup() { return drawLineup(t.roster, r); },
    get starter() { return pickWeighted(t.starters, r); },
    get bullpen() { return weightedOrder(t.relievers, r); },
  }));
  const { playerStats: ps, tally: tl } = playSeason(tfs, { rates: baseline }, r, cfg);
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

const rng = makeRng(SEED);
// 先発は登板ごとにローテーション、救援は毎試合シャッフルなしで使い回す
let rotIdx = 0;
const teamsForSeason = teams.map(t => ({
  name: t.name,
  get lineup() { return drawLineup(t.roster, rng); },
  get starter() { return pickWeighted(t.starters, rng); },
  get bullpen() { return weightedOrder(t.relievers, rng); },
}));

// 合成の分母は「実際に登板する投手陣の平均」に揃える（odds.mjs poolBaseline の説明を参照）。
// 打者側リーグ平均を分母にすると、投手プールが平均より強い分だけ全体が系統的にずれる。
//
// ★2026-08-05に実測で確かめた（この設計を疑って実験した結果、設計が正しいと確定）:
//   投手プールは投球回の92-94%しか含まず、外れた投手ほど打たれやすい。そのため
//   プールの平均は打者側リーグ実測より本塁打で1.2〜3.4%・四球で2.2〜3.7%低い。
//   「分母が低いぶん確率が持ち上がっているのでは」と考えて分母をリーグ実測へ替えたところ、
//   **4年すべてで全指標が悪化した**（四球率 -2.3〜-3.3%、本塁打 -2.0〜-2.8%、
//   打率も -0.7〜-1.3% へ転落）。プール平均のままが正しい。
//   残っている四球率の残差（2023 +0.80% / 2024 +1.43%）は分母が原因ではなく、原因は未特定。
const baseline = poolBaseline(
  teams.flatMap(t => [...t.starters, ...t.relievers])
    .map(p => ({ rates: p.rates, weight: pitcherPA(pitchers.find(q => q.player_id === p.id)) }))
) ?? league;

const t0 = Date.now();
const { standings, playerStats, games, tally } = playSeason(teamsForSeason, { rates: baseline }, rng, cfg);
const elapsed = Date.now() - t0;

// --- 集計 ---
const sim = { PA: 0, BB: 0, HBP: 0, SO: 0, B1: 0, B2: 0, B3: 0, HR: 0, OUT: 0 };
for (const [id, s] of playerStats) {
  if (id.startsWith('P:')) continue; // 打者側だけ集計（投手側は同じ打席の裏返し）
  for (const k of Object.keys(sim)) sim[k] += s[k];
}
// 公式打数=PA-BB-HBP-犠打-犠飛。tally.sh/sfを引かないと打率が過小評価される（2026-08-04発見）
const simAB = sim.PA - sim.BB - sim.HBP - tally.sh - tally.sf;
const simH = sim.B1 + sim.B2 + sim.B3 + sim.HR;
const totalRuns = standings.reduce((a, s) => a + s.rf, 0);

// 比較の文脈を揃える: 実測側も「シミュで実際に打席に立った選手」だけを集計する
// （Sol仕様 02 §4「選手統計とリーグ平均の文脈を一致させる」と同じ原則）
// ロースター全員が起用対象（実打席数の重みで抽選される）
const usedBatterIds = teams.flatMap(t => t.roster.map(b => b.id));
const ph = usedBatterIds.map(() => '?').join(',');
const real = db.prepare(`
  SELECT SUM(pa) pa, SUM(ab) ab, SUM(h) h, SUM(hr) hr, SUM(bb) bb, SUM(so) so, SUM(r) r
  FROM v_batting WHERE season=? AND player_id IN (${ph})`)
  .get(SEASON, ...usedBatterIds);
// 比較の重みを揃える（2026-08-04発見）。
//
// リーグ実測の合計は「実際の打席数」で重み付けされているが、シミュが各打者へ配る打席数は
// それとは違う（打順を回すため。実測で1番:672〜9番:547と1.23倍の開きがある）。
// 打席の多い選手ほど三振が少ない（上位36人16.90% vs 下位36人18.67%）ので、
// 重みが違うと同じ選手集団でも数字がずれ、それをエンジンの誤差と読み違える。
//
// そこで目標値は「**シミュが実際に配った打席数**で各打者の実測レートを加重平均した値」にする。
// ＝「全打者がぴったり実測どおりに打ったら、この打席配分では合計がいくつになるか」。
// これがエンジンの当否を測る正しい基準で、実測合計との差は配分の違いを表すだけ。
const perPlayer = new Map(db.prepare(`
  SELECT player_id, pa, ab, h, hr, so, bb FROM v_batting WHERE season=? AND player_id IN (${ph})`)
  .all(SEASON, ...usedBatterIds).filter(r => r.pa > 0 && r.ab > 0).map(r => [r.player_id, r]));

const weighted = (rateOf, abBased) => {
  let num = 0, den = 0;
  for (const [id, s] of playerStats) {
    if (id.startsWith('P:')) continue;
    const real = perPlayer.get(id);
    if (!real) continue;
    // 打数ベースの指標（打率・本塁打率）は、シミュが与えた打数で重み付ける
    const w = abBased ? (s.PA - s.BB - s.HBP) : s.PA;
    num += rateOf(real) * w; den += w;
  }
  return den > 0 ? num / den : null;
};
const target = {
  avg: weighted(r => r.h / r.ab, true), so: weighted(r => r.so / r.pa, false),
  bb: weighted(r => r.bb / r.pa, false), hr: weighted(r => r.hr / r.ab, true),
};

const realTeamRuns = db.prepare(`
  SELECT SUM(r) r FROM v_batting WHERE season=?`).get(SEASON);
// 全打者に占める「使用9人」の打席割合。得点の比較が成立するかの判定に使う
const paShare = db.prepare(`
  SELECT (SELECT SUM(pa) FROM v_batting WHERE season=? AND player_id IN (${ph})) * 1.0
       / (SELECT SUM(pa) FROM v_batting WHERE season=?) s`).get(SEASON, ...usedBatterIds, SEASON).s;

const rows = [
  ['打率(全打者)', simH / simAB, target.avg, true, real.h / real.ab],
  ['三振率(対打席)', sim.SO / sim.PA, target.so, true, real.so / real.pa],
  ['四球率(対打席)', sim.BB / sim.PA, target.bb, true, real.bb / real.pa],
  ['本塁打率(対打数)', sim.HR / simAB, target.hr, true, real.hr / real.ab],
  // 率と違い、得点だけは母集団が揃わない: シミュは全打席を上位9人に割り当てるが、
  // 実チームは約30%の打席を控え・代打・(セは)投手に与えている（それらの打率は.205）。
  // したがって「シミュの方が多く得点する」のが正しい挙動で、乖離率は判定に使えない。
  // 揃えるには控え選手を打順に組み込む必要がある（Phase 3以降）
  ['得点/試合(1チーム)', totalRuns / (games * 2), realTeamRuns.r / (143 * cfg.season.teams), false, null],
];

const fmt = (v) => v < 0.01 ? v.toFixed(5) : v.toFixed(4);
const pct = (s, r) => ((s - r) / r * 100 >= 0 ? '+' : '') + ((s - r) / r * 100).toFixed(1) + '%';
console.log(`\n=== Phase 2 エンジン検証 (${SEASON}年 / seed=${SEED} / ${games}試合 / ${elapsed}ms) ===`);
console.log('項目'.padEnd(20) + 'シミュ'.padStart(9) + '目標'.padStart(10) + '乖離'.padStart(8)
  + '実打席重み'.padStart(12) + '(参考乖離)'.padStart(11));
for (const [name, s, r, comparable, paWeighted] of rows) {
  if (!comparable) {
    console.log(name.padEnd(18) + fmt(s).padStart(10) + fmt(r).padStart(11) + pct(s, r).padStart(9)
      + '  ※母集団不一致・判定に使わない');
    continue;
  }
  console.log(name.padEnd(18) + fmt(s).padStart(10) + fmt(r).padStart(11) + pct(s, r).padStart(9)
    + fmt(paWeighted).padStart(12) + pct(s, paWeighted).padStart(11));
}
console.log(`\n※「目標」＝**シミュが実際に配った打席数**で各打者の実測レートを加重平均した値＝「全員がぴったり実測どおり打ったらこの打席配分で合計はいくつになるか」。`
  + `エンジンが正しければこの値になる。「実打席重み」＝リーグ実測の集計方法（打席数で重み付け）で、`
  + `打席の多い選手ほど三振が少ない（上位36人16.90% vs 下位36人18.67%）ため両者は一致しない。`
  + `エンジンの当否は「目標」列で見る`);
console.log(`\n※得点の行: ロースター全員を実打席数の重みで起用する形へ変更済み（T-0094）。上位9人の打席シェアは`
  + ` ${(paShare * 100).toFixed(1)}% のみ。残りは打率.205前後の控え・代打が打っており、`
  + `残る差はこの起用の再現度の分。判定に使えるようになったが、なお参考値として扱う`);

// --- 乱数のばらつきから信号を分離する（2026-08-04追加） ---
// 1シーズンは858試合しかないので、本塁打のような低頻度の事象は乱数だけで数%動く
// （実測: 1シードあたりの標準偏差が本塁打で2.3%）。1シードの数字を残差として報告すると
// ノイズを実力と読み違える。既定で複数シードを回し、平均±標準誤差で判定する。
const SEEDS = Number(process.env.SEEDS ?? 10);
if (SEEDS > 1) {
  const dev = { avg: [], so: [], bb: [], hr: [] };
  for (let i = 0; i < SEEDS; i++) {
    const r2 = runOnce(SEED + i * 1013); // 1013=適当な素数。連番シードの相関を避ける
    dev.avg.push(r2.avg); dev.so.push(r2.so); dev.bb.push(r2.bb); dev.hr.push(r2.hr);
  }
  const stat = (a) => {
    const m = a.reduce((x, y) => x + y, 0) / a.length;
    const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
    return { m, sd, se: sd / Math.sqrt(a.length) };
  };
  console.log(`\n=== ${SEEDS}シードでの残差（乱数のばらつきを除いた判定） ===`);
  console.log('項目'.padEnd(10) + '平均'.padStart(9) + '標準誤差'.padStart(10) + '1シードのsd'.padStart(13) + '  判定');
  for (const [k, label] of [['avg', '打率'], ['so', '三振率'], ['bb', '四球率'], ['hr', '本塁打率']]) {
    const s = stat(dev[k]);
    const sig = Math.abs(s.m) > 2 * s.se ? '★実在する残差' : 'ノイズと区別できない';
    console.log(label.padEnd(9) + (s.m >= 0 ? '+' : '') + s.m.toFixed(2).padStart(7) + '%'
      + ('±' + s.se.toFixed(2)).padStart(9) + s.sd.toFixed(2).padStart(12) + '  ' + sig);
  }
  console.log('※判定=|平均| > 2×標準誤差 なら乱数では説明できない残差。1シードだけの数字は'
    + '本塁打で±2〜4%動くので単独では読まない');
}
console.log('\n順位表:');
for (const s of [...standings].sort((a, b) => (b.w / (b.w + b.l)) - (a.w / (a.w + a.l)))) {
  console.log(`  ${s.name.padEnd(14)} ${String(s.w).padStart(3)}勝${String(s.l).padStart(3)}敗${String(s.d).padStart(2)}分  得${String(s.rf).padStart(4)} 失${String(s.ra).padStart(4)}`);
}

await writeFile(path.join(ROOT, 'outputs', 'derived', `phase2_run_${SEASON}_${SEED}.json`),
  JSON.stringify({ season: SEASON, seed: SEED, games, elapsedMs: elapsed, comparison: rows, standings }, null, 2), 'utf8');
db.close();
