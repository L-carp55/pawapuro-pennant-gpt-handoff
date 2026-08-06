// 走力・盗塁・走塁の正規化パラメータを実データから作り、configs/running_norms.json に保存する。
// コードにマジックナンバーを置かない（Sol仕様 08 §5）。
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speedComponents } from '../src/ratings/running.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_PA = Number(process.argv[2] || 300);
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const rows = db.prepare(`
  SELECT b.season, b.name, b.pa, b.ab, b.so, b.b2, b3, b.hr, b.gdp, b.sb, b.cs,
         p.ubr, p.wsb, m.gb_pct
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_player p ON p.player_id=l.bm_id AND p.season=b.season AND p.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  WHERE b.pa>=? AND b.position<>'投' AND p.ubr IS NOT NULL`).all(MIN_PA);

const lgGb = db.prepare(`SELECT AVG(gb_pct) g FROM v_bm_bat WHERE farm=0 AND gb_pct IS NOT NULL`).get().g;

const stat = arr => {
  const v = arr.filter(x => x != null && Number.isFinite(x));
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
  return { mean, sd, n: v.length };
};

// 第1段: 生指標の分布
const raws = rows.map(r => {
  const inplay = Math.max(1, r.ab - r.so);
  const gbCount = Math.max(1, inplay * ((r.gb_pct ?? lgGb) / 100));
  return {
    // 三塁打の割合（場内に残った長打のうち三塁打が何割か）。2026-08-01に旧「三塁打率」から変更。
    // 場外へ消えた本塁打を分母から外せるので脚を測れる（翌年再現性 0.550→0.695）
    triple: (r.b2 + r.b3) > 0 ? r.b3 / (r.b2 + r.b3) : null,
    gdpAvoid: -r.gdp / gbCount,
    ubr: r.ubr / r.pa,
  };
});
const norm = {
  leagueGbPct: lgGb,
  triple: stat(raws.map(r => r.triple)),
  gdpAvoid: stat(raws.map(r => r.gdpAvoid)),
  ubr: stat(raws.map(r => r.ubr)),
};

// 第2段: 走力スコアを算出し、盗塁成功率・UBRの回帰を取る
const scored = rows.map((r, i) => {
  const sc = speedComponents(
    { AB: r.ab, SO: r.so, B3: r.b3, HR: r.hr, GDP: r.gdp, PA: r.pa },
    { gbPct: r.gb_pct }, r.ubr, norm
  );
  return { ...r, speed: sc.score, ubrPerPa: raws[i].ubr };
}).filter(r => r.speed != null);

function regress(pairs) {
  const n = pairs.length;
  const mx = pairs.reduce((a, p) => a + p[0], 0) / n, my = pairs.reduce((a, p) => a + p[1], 0) / n;
  let sxy = 0, sxx = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  const slope = sxy / sxx, intercept = my - slope * mx;
  const res = pairs.map(([x, y]) => y - (intercept + slope * x));
  const sd = Math.sqrt(res.reduce((a, b) => a + b * b, 0) / (n - 2));
  return { slope, intercept, sd, n };
}

const sbRows = scored.filter(r => (r.sb + r.cs) >= 5);
norm.sbSuccess = regress(sbRows.map(r => [r.speed, r.sb / (r.sb + r.cs)]));
norm.attempt = stat(scored.map(r => (r.sb + r.cs) / r.pa));
norm.ubrOnSpeed = regress(scored.map(r => [r.speed, r.ubrPerPa]));
// wSB（成功と失敗の回数が両方入る得点貢献）を走力に回帰。盗塁得能の主経路
const wsbRows = scored.filter(r => r.wsb != null && (r.sb + r.cs) > 0);
norm.wsbOnSpeed = regress(wsbRows.map(r => [r.speed, r.wsb / r.pa]));

// 別の較正スクリプトが書いた項目を巻き添えで消さない。
// （internalHit は calibrate_infield_hits.mjs、componentWeights は同スクリプトが書く。
//   ここで丸ごと上書きすると実行順で静かに消える——2026-08-01に実際に消した。
//   守備側の fielding_norms.json でも同じ事故を起こしており、同じ対策を入れる）
const normPath = path.join(ROOT, 'configs', 'running_norms.json');
let existing = {};
try { existing = JSON.parse(await readFile(normPath, 'utf8')); } catch { /* 初回は無くてよい */ }
const PRESERVE = ['infieldHit', 'componentWeights', '_componentWeights_basis', '_triple_legacy', '_triple_legacy_note'];
for (const k of PRESERVE) if (existing[k] !== undefined && norm[k] === undefined) norm[k] = existing[k];

await writeFile(normPath,
  JSON.stringify({
    _comment: '走力・盗塁・走塁の正規化パラメータ。scripts/build_running_norms.mjs が実データから生成する。手編集しない',
    _source: `2016-2025年 ${MIN_PA}打席以上 ${rows.length}選手シーズン（UBR実測あり＝2020年以降）`,
    _generated_from: 'batting(プロEYE球) × bm_player.ubr(NPB Basement)',
    _preserved: `${PRESERVE.join(', ')} は別スクリプト(calibrate_infield_hits.mjs)が書くため、再生成時も引き継ぐ`,
    ...norm,
  }, null, 2), 'utf8');

console.log(`=== 走力の正規化パラメータを生成 (${rows.length}選手シーズン) ===\n`);
console.log(`リーグ平均ゴロ率: ${lgGb.toFixed(2)}%`);
for (const k of ['triple', 'gdpAvoid', 'ubr']) {
  console.log(`${k.padEnd(10)} 平均${norm[k].mean.toExponential(3)} 標準偏差${norm[k].sd.toExponential(3)} n=${norm[k].n}`);
}
console.log(`\n盗塁成功率 = ${norm.sbSuccess.intercept.toFixed(3)} + ${norm.sbSuccess.slope.toFixed(3)}×走力z  (残差sd=${norm.sbSuccess.sd.toFixed(3)}, n=${norm.sbSuccess.n})`);
console.log(`wSB/打席   = ${norm.wsbOnSpeed.intercept.toExponential(3)} + ${norm.wsbOnSpeed.slope.toExponential(3)}×走力z  (残差sd=${norm.wsbOnSpeed.sd.toExponential(3)}, n=${norm.wsbOnSpeed.n})`);
console.log(`UBR/打席   = ${norm.ubrOnSpeed.intercept.toExponential(3)} + ${norm.ubrOnSpeed.slope.toExponential(3)}×走力z  (残差sd=${norm.ubrOnSpeed.sd.toExponential(3)}, n=${norm.ubrOnSpeed.n})`);
console.log('\n→ configs/running_norms.json');
db.close();
