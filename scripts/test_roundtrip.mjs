// Phase 3a 検証: 実成績 → 能力値 → 確率ベクトル → 実成績 の往復で元に戻るかを実選手で測る。
// 戻らなければ、査定とエンジンが同じ変換の表裏になっていない＝設計の核が壊れている。
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitLogDist } from '../src/ratings/scale.mjs';
import { appraiseBatting } from '../src/ratings/from_rates.mjs';
import { ratesFromRatings, observedFromRates } from '../src/ratings/to_rates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] || 2024);
const MIN_PA = Number(process.argv[3] || 200);

const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const rows = db.prepare(`
  SELECT player_id, name, team, pa, ab, h, b2, b3, hr, bb, hbp, so, sh, sf
  FROM v_batting WHERE season=? AND pa >= ?
  ORDER BY pa DESC`).all(SEASON, MIN_PA);

if (!rows.length) { console.error('対象なし'); process.exit(1); }

// 能力値スケールの基準になる分布を、その年の対象集団から作る
const dists = {
  contact: fitLogDist(rows.map(r => r.so / r.pa)),
  eye: fitLogDist(rows.map(r => r.bb / r.pa)),
};

// 安打の内訳（単打/二塁打/三塁打の比）はリーグ平均を使う
const lg = db.prepare(`
  SELECT SUM(b1) b1, SUM(b2) b2, SUM(b3) b3 FROM v_batting WHERE season=?`).get(SEASON);
const nonHr = lg.b1 + lg.b2 + lg.b3;
const hitSplit = { B2: lg.b2 / nonHr, B3: lg.b3 / nonHr };

const errs = { meet: [], power: [], contact: [], eye: [], avg: [], hr: [] };
const failures = [];
const sample = [];

for (const r of rows) {
  const line = { PA: r.pa, AB: r.ab, H: r.h, HR: r.hr, BB: r.bb, HBP: r.hbp, SO: r.so, SH: r.sh, SF: r.sf };
  // 核の可逆性を測るテストなので、前処理（ISO混合）は外す
  const rating = appraiseBatting(line, cfg, dists, null, { useIsoBlend: false });
  if (!rating) { failures.push({ name: r.name, why: '査定不能' }); continue; }

  const ctx = {
    hbpRate: r.hbp / r.pa,
    sacRate: (r.sh + r.sf) / r.pa,
    hitSplit,
  };
  const rates = ratesFromRatings(rating, cfg, dists, ctx);
  if (!rates) { failures.push({ name: r.name, why: '確率生成不能' }); continue; }

  // 戻す
  const back = observedFromRates(rates, ctx.sacRate);
  const line2 = {
    PA: 1, AB: 1 - rates.BB - rates.HBP - ctx.sacRate,
    H: rates.B1 + rates.B2 + rates.B3 + rates.HR,
    HR: rates.HR, BB: rates.BB, HBP: rates.HBP, SO: rates.SO, SH: 0, SF: 0,
  };
  const rating2 = appraiseBatting(line2, cfg, dists, null, { useIsoBlend: false });

  errs.meet.push(Math.abs(rating2.meet - rating.meet));
  errs.power.push(Math.abs(rating2.power - rating.power));
  errs.contact.push(Math.abs(rating2.contact - rating.contact));
  errs.eye.push(Math.abs(rating2.eye - rating.eye));
  errs.avg.push(Math.abs(back.avg - rating.observed.avg));
  errs.hr.push(Math.abs(back.hrPerAb - rating.observed.hrPer500 / cfg.ab_ref.value));

  if (sample.length < 12) {
    sample.push({ name: r.name, pa: r.pa, avg: rating.observed.avg, hr: r.hr, ...rating });
  }
}

const stat = a => {
  if (!a.length) return { max: NaN, p99: NaN, median: NaN, n: 0 };
  const s = [...a].sort((x, y) => x - y);
  const at = q => s[Math.min(s.length - 1, Math.max(0, Math.floor(s.length * q)))];
  return { max: s[s.length - 1], p99: at(0.99), median: at(0.5), n: s.length };
};

console.log(`\n=== Phase 3a 往復テスト (${SEASON}年 / ${MIN_PA}打席以上 ${rows.length}人) ===\n`);
console.log('能力値の往復誤差（能力値ポイント）');
for (const k of ['meet', 'power', 'contact', 'eye']) {
  const s = stat(errs[k]);
  console.log(`  ${k.padEnd(8)} 中央値 ${s.median.toExponential(2)}  99%点 ${s.p99.toExponential(2)}  最大 ${s.max.toExponential(2)}`);
}
console.log('\n観測値の往復誤差');
console.log(`  打率     最大 ${stat(errs.avg).max.toExponential(2)}`);
console.log(`  本塁打率 最大 ${stat(errs.hr).max.toExponential(2)}`);
if (failures.length) console.log(`\n変換できなかった選手: ${failures.length}人`, failures.slice(0, 5));

console.log('\n査定サンプル（打席数上位）');
console.log('  選手'.padEnd(16) + '打席'.padStart(5) + '打率'.padStart(8) + '本'.padStart(4) + '  ミート パワー コンタクト 選球眼');
for (const s of sample) {
  console.log('  ' + s.name.padEnd(14) + String(s.pa).padStart(5) + s.avg.toFixed(3).padStart(8) + String(s.hr).padStart(4)
    + String(s.meet).padStart(8) + String(s.power).padStart(7) + String(s.contact).padStart(10) + String(s.eye).padStart(8));
}

const maxErr = Math.max(...['meet', 'power', 'contact', 'eye'].map(k => stat(errs[k]).max));
console.log(`\n判定: 能力値往復の最大誤差 ${maxErr.toExponential(2)} ポイント ${maxErr < 1 ? '→ 合格（基準1.0未満）' : '→ 不合格'}`);

await writeFile(path.join(ROOT, 'outputs', 'derived', `phase3a_roundtrip_${SEASON}.json`),
  JSON.stringify({ season: SEASON, minPa: MIN_PA, players: rows.length, errors: Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, stat(v)])), sample }, null, 2), 'utf8');
db.close();
