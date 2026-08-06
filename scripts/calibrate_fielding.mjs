// 守備の査定係数を実データから測る（Sol仕様 04 §4-§11、02 §11）。
//
// 仕様の核:
//   §4 守備力＝範囲・反応・判断／捕球＝失策・ハンドリング／送球＝速度は肩力・精度は送球得能
//   §5 内野守備は走力より守備力の寄与が大きい
//   §6 外野守備は走力と守備力の合成。同じ現実Rangeなら俊足→守備力を下げ、鈍足→上げる
//   §7 失策は捕球のみ。守備力に入れない
//   §8 出場量（守備イニング）は信頼度へ。自動加点しない
//
// ここで確かめること: §5/§6 の主張（内野と外野で走力の寄与が違う）が実データで成り立つか。
// 成り立つなら、RngR（範囲の実測）から走力で説明できる分を引いた残差＝守備技術、と定義できる。
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speedComponents } from '../src/ratings/running.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_INN = Number(process.argv[2] || 200);
const norm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

// 守備成績（ポジション別）に、その選手の走力材料を結合する
const rows = db.prepare(`
  SELECT f.season, f.pos, f.inn, f.rngr, f.errr, f.arm, f.dpr, f.framing, f.blocking,
         p.name_ja name,
         b.ab, b.so, b.b3, b.hr, b.gdp, b.pa, pl.ubr, m.gb_pct
  FROM bm_fld f
  JOIN v_bm_player pl ON pl.player_id=f.player_id AND pl.season=f.season AND pl.farm=f.farm
  JOIN v_bm_player p ON p.player_id=f.player_id AND p.season=f.season AND p.farm=f.farm
  LEFT JOIN v_bm_bat m ON m.player_id=f.player_id AND m.season=f.season AND m.farm=f.farm
  LEFT JOIN player_link l ON l.bm_id=f.player_id AND l.season=f.season
  LEFT JOIN v_batting b ON b.player_id=l.proeye_id AND b.season=f.season
  WHERE f.farm=0 AND f.inn >= ? AND f.rngr IS NOT NULL AND b.ab IS NOT NULL`).all(MIN_INN);

// 捕手はRngR（範囲の指標）を持たない——捕手の守備は範囲でなくフレーミング・ブロッキング・
// 盗塁阻止で測るため、NPB BasementもRngRを出していない（実データで確認: 捕手415件すべてrngr=null）。
// 上のWHERE句 `f.rngr IS NOT NULL` では捕手が全件落ちるので、捕手だけ別に取る。
// これを見落としていたため、捕手の正規化パラメータが生成されず catcherAbilities が
// 常に null を返す（＝捕手査定が動かない）状態だった（2026-08-01に回帰テストで検出）。
const catcherRows = db.prepare(`
  SELECT f.season, f.pos, f.inn, f.rngr, f.errr, f.arm, f.dpr, f.framing, f.blocking,
         p.name_ja name,
         b.ab, b.so, b.b3, b.hr, b.gdp, b.pa, pl.ubr, m.gb_pct
  FROM bm_fld f
  JOIN v_bm_player pl ON pl.player_id=f.player_id AND pl.season=f.season AND pl.farm=f.farm
  JOIN v_bm_player p ON p.player_id=f.player_id AND p.season=f.season AND p.farm=f.farm
  LEFT JOIN v_bm_bat m ON m.player_id=f.player_id AND m.season=f.season AND m.farm=f.farm
  LEFT JOIN player_link l ON l.bm_id=f.player_id AND l.season=f.season
  LEFT JOIN v_batting b ON b.player_id=l.proeye_id AND b.season=f.season
  WHERE f.farm=0 AND f.inn >= ? AND f.pos='C' AND f.framing IS NOT NULL`).all(MIN_INN);

console.log(`対象: ${rows.length}件（守備イニング${MIN_INN}以上、走力材料あり）＋捕手 ${catcherRows.length}件\n`);

const withSpeed = rows.map(r => {
  const sc = speedComponents(
    { AB: r.ab, SO: r.so, B3: r.b3, HR: r.hr, GDP: r.gdp, PA: r.pa },
    { gbPct: r.gb_pct }, r.ubr, norm
  );
  return { ...r, speed: sc.score, rngrPer1000: (r.rngr / r.inn) * 1000, errrPer1000: (r.errr / r.inn) * 1000, armPer1000: r.arm != null ? (r.arm / r.inn) * 1000 : null };
}).filter(r => r.speed != null);

function regress(pairs) {
  const n = pairs.length;
  if (n < 12) return null;
  const mx = pairs.reduce((a, p) => a + p[0], 0) / n, my = pairs.reduce((a, p) => a + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  const slope = sxy / sxx, intercept = my - slope * mx;
  const res = pairs.map(([x, y]) => y - (intercept + slope * x));
  const sd = Math.sqrt(res.reduce((a, b) => a + b * b, 0) / (n - 2));
  return { slope, intercept, sd, n, r: sxy / Math.sqrt(sxx * syy) };
}

const POS_GROUP = { '1B': '内野', '2B': '内野', '3B': '内野', 'SS': '内野', 'LF': '外野', 'CF': '外野', 'RF': '外野', 'C': '捕手' };
const positions = [...new Set(withSpeed.map(r => r.pos))].filter(p => POS_GROUP[p]);

console.log('=== 仕様§5/§6の検証: 走力はRngR（範囲の実測）にどれだけ効くか ===\n');
console.log('守備位置'.padEnd(8) + '群'.padEnd(6) + 'n'.padStart(5) + '走力→RngRの傾き'.padStart(18) + '相関'.padStart(8));
const fieldingNorm = { byPos: {} };
for (const pos of ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']) {
  const g = withSpeed.filter(r => r.pos === pos);
  if (g.length < 12) continue;
  const reg = regress(g.map(r => [r.speed, r.rngrPer1000]));
  if (!reg) continue;
  console.log(pos.padEnd(8) + POS_GROUP[pos].padEnd(6) + String(reg.n).padStart(5) + reg.slope.toFixed(3).padStart(16) + reg.r.toFixed(3).padStart(10));
  const st = arr => { const v = arr.filter(x => x != null && Number.isFinite(x)); const m = v.reduce((a, b) => a + b, 0) / v.length; return { mean: m, sd: Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, v.length - 1)), n: v.length }; };
  fieldingNorm.byPos[pos] = {
    group: POS_GROUP[pos],
    rngrOnSpeed: reg,                            // 走力で説明できる分（仕様§6の逆補正の核）
    errr: st(g.map(r => r.errrPer1000)),         // 捕球（仕様§7: 失策はここだけ）
    arm: st(g.map(r => r.armPer1000)),           // 肩・送球
    framing: st(g.map(r => r.framing).filter(x => x != null)),
    blocking: st(g.map(r => r.blocking).filter(x => x != null)),
  };
}

// 捕手（RngRが無いので別処理。仕様04 §10「捕球は盗塁阻止と分離し、失策・捕逸等で査定」）
{
  const st = arr => {
    const v = arr.filter(x => x != null && Number.isFinite(x));
    if (!v.length) return { mean: 0, sd: 1, n: 0 };
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    return { mean: m, sd: Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, v.length - 1)), n: v.length };
  };
  const g = catcherRows.map(r => ({
    ...r,
    errrPer1000: (r.errr / r.inn) * 1000,
    armPer1000: r.arm != null ? (r.arm / r.inn) * 1000 : null,
    framingPer1000: r.framing != null ? (r.framing / r.inn) * 1000 : null,
    blockingPer1000: r.blocking != null ? (r.blocking / r.inn) * 1000 : null,
  }));
  if (g.length >= 12) {
    fieldingNorm.byPos['C'] = {
      group: '捕手',
      // 捕手にRngRは存在しない。範囲の逆補正（仕様§6）は捕手に適用しない
      rngrOnSpeed: null,
      _no_rngr: '捕手はNPB BasementにRngRが無い（範囲でなくフレーミング・ブロッキング・盗塁阻止で守備を測るため）。実データで415件すべてrngr=nullを確認',
      errr: st(g.map(r => r.errrPer1000)),
      arm: st(g.map(r => r.armPer1000)),
      framing: st(g.map(r => r.framingPer1000)),
      blocking: st(g.map(r => r.blockingPer1000)),
    };
    const c = fieldingNorm.byPos['C'];
    console.log(`C       捕手  ${String(g.length).padStart(5)}        （RngRなし）`);
    console.log(`  1000イニングあたり  framing平均${c.framing.mean.toFixed(2)}(sd${c.framing.sd.toFixed(2)}) / blocking平均${c.blocking.mean.toFixed(2)}(sd${c.blocking.sd.toFixed(2)}) / arm平均${c.arm.mean.toFixed(2)}(sd${c.arm.sd.toFixed(2)})`);
  }
}

const infield = ['1B', '2B', '3B', 'SS'].map(p => fieldingNorm.byPos[p]?.rngrOnSpeed?.slope).filter(x => x != null);
const outfield = ['LF', 'CF', 'RF'].map(p => fieldingNorm.byPos[p]?.rngrOnSpeed?.slope).filter(x => x != null);
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`\n内野の平均傾き: ${avg(infield).toFixed(3)}   外野の平均傾き: ${avg(outfield).toFixed(3)}`);
console.log(outfield.length && infield.length && avg(outfield) > avg(infield)
  ? '→ 外野の方が走力の寄与が大きい。仕様§5/§6と整合'
  : '→ 仕様§5/§6と整合しない。実装前に要検討');

// ポジション×年の失策水準（仕様04 §11「各年・各ポジションで標準化する」）。
// ポジションだけで標準化すると年ごとの水準移動が能力差に化ける。
// 実測（scripts/validate_fielding_norms.mjs）では右翼で「年ごとの平均の幅 ÷ 選手間ばらつき = 0.56」あり、
// 無視できない大きさだった。標本が薄い年は作らず、その年は全年プールへ落とす。
{
  const cells = {};
  for (const r of [...withSpeed, ...catcherRows.map(r => ({ ...r, errrPer1000: (r.errr / r.inn) * 1000 }))]) {
    if (r.errrPer1000 == null || !Number.isFinite(r.errrPer1000)) continue;
    (cells[`${r.pos}|${r.season}`] ??= []).push(r.errrPer1000);
  }
  fieldingNorm.errrByPosSeason = {};
  for (const [k, a] of Object.entries(cells)) {
    if (a.length < 8) continue;
    const m = a.reduce((x, y) => x + y, 0) / a.length;
    const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
    if (sd > 0) fieldingNorm.errrByPosSeason[k] = { mean: m, sd, n: a.length };
  }
  console.log(`\nポジション×年の失策水準: ${Object.keys(fieldingNorm.errrByPosSeason).length}セル（8件未満の年は作らず全年プールへ落とす）`);
}

// 別の較正スクリプトが書き込んだ項目を巻き添えで消さない。
// （内野手の肩の事前値 infieldArmPrior は calibrate_infield_arm.mjs が書く。
//   ここで丸ごと上書きすると、実行順によって静かに消える＝2026-08-01に実際に消した）
const normPath = path.join(ROOT, 'configs', 'fielding_norms.json');
let existing = {};
try { existing = JSON.parse(await readFile(normPath, 'utf8')); } catch { /* 初回は無くてよい */ }
const PRESERVE = ['infieldArmPrior'];
for (const k of PRESERVE) if (existing[k] && !fieldingNorm[k]) fieldingNorm[k] = existing[k];

await writeFile(normPath,
  JSON.stringify({
    _comment: '守備の正規化パラメータ。scripts/calibrate_fielding.mjs が実データから生成する。手編集しない',
    _preserved: `${PRESERVE.join(', ')} は別スクリプトが書くため、再生成時も引き継ぐ`,
    _source: `2020-2026年 守備イニング${MIN_INN}以上 ${withSpeed.length}件（NPB Basement × プロEYE球）`,
    _spec: 'rngrOnSpeed = 走力で説明できる範囲の分。残差が守備技術（仕様§6の「同じ現実Rangeなら俊足は守備力を下げる」の実装）',
    _errr_by_pos_season: '捕球はポジション×年で標準化する（仕様04 §11）。該当年のセルが無ければ byPos の全年プールを使う',
    minInn: MIN_INN, ...fieldingNorm,
  }, null, 2), 'utf8');
console.log('\n→ configs/fielding_norms.json');
db.close();
