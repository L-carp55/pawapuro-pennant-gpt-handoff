// 各打撃イベントの「得点価値」を実データから測る。
//
// なぜ必要か:
//   年度の総合評価に「打率×0.4＋本塁打×0.3…」のような恣意的な重みを置くと、
//   Sol仕様08 §5「コードへマジックナンバーを埋め込まない」に反する。
//   チームの実得点を各イベント数で説明する回帰なら、重みは実データが決める。
//
// 方法: チーム×年の集計（12球団×20年）で
//   得点 = b1*単打 + bXB*(二塁打+三塁打) + bHR*本塁打 + bBB*四球 + bHBP*死球
//          + bSB*盗塁 + bCS*盗塁死 + bOUT*アウト
//   を最小二乗で解く。切片なし（イベントが無ければ得点も無い）。
import { DatabaseSync } from 'node:sqlite';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

// チーム×年の集計。得点(r)は打者の得点合計＝チーム得点に一致する
const rows = db.prepare(`
  SELECT season, team,
    SUM(r) runs, SUM(b1) b1, SUM(b2) b2, SUM(b3) b3, SUM(hr) hr,
    SUM(bb) bb, SUM(hbp) hbp, SUM(sb) sb, SUM(cs) cs,
    SUM(ab) ab, SUM(h) h, SUM(sh) sh, SUM(sf) sf
  FROM v_batting GROUP BY season, team HAVING SUM(ab) > 3000`).all();

// 三塁打は二塁打と合算して1つの係数で推定する。
//   理由1: チーム年間20-30本しかなく単独推定が不安定（分離すると三塁打1.60 > 本塁打1.46 と
//          序列が逆転した。多重共線性による）。
//   理由2: 三塁打の超過価値は主に脚力由来であり、Sol仕様03 §5.4「三塁打は脚力・球場要因を分離する」
//          に従えば走力査定側で評価すべきもの。打撃の得点価値に混ぜると二重計上になる。
// アウト数 = 打数 - 安打 + 犠打 + 犠飛 + 盗塁死
const TERMS = ['b1', 'xb2', 'hr', 'bb', 'hbp', 'sb', 'cs', 'outs'];
const X = rows.map(r => [r.b1, r.b2 + r.b3, r.hr, r.bb, r.hbp, r.sb, r.cs,
  r.ab - r.h + r.sh + r.sf + r.cs]);
const y = rows.map(r => r.runs);

// 正規方程式 (X'X)b = X'y をガウス消去で解く
function solveLS(X, y) {
  const p = X[0].length;
  const A = Array.from({ length: p }, () => new Array(p + 1).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) for (const row of X) A[i][j] += row[i] * row[j];
    for (let k = 0; k < X.length; k++) A[i][p] += X[k][i] * y[k];
  }
  for (let i = 0; i < p; i++) {
    let piv = i;
    for (let k = i + 1; k < p; k++) if (Math.abs(A[k][i]) > Math.abs(A[piv][i])) piv = k;
    [A[i], A[piv]] = [A[piv], A[i]];
    for (let k = i + 1; k < p; k++) {
      const f = A[k][i] / A[i][i];
      for (let j = i; j <= p; j++) A[k][j] -= f * A[i][j];
    }
  }
  const b = new Array(p).fill(0);
  for (let i = p - 1; i >= 0; i--) {
    let s = A[i][p];
    for (let j = i + 1; j < p; j++) s -= A[i][j] * b[j];
    b[i] = s / A[i][i];
  }
  return b;
}

const b = solveLS(X, y);
const rv = Object.fromEntries(TERMS.map((t, i) => [t, Math.round(b[i] * 10000) / 10000]));

// あてはまりを確認
const pred = X.map(row => row.reduce((a, v, i) => a + v * b[i], 0));
const my = y.reduce((a, v) => a + v, 0) / y.length;
const ssTot = y.reduce((a, v) => a + (v - my) ** 2, 0);
const ssRes = y.reduce((a, v, i) => a + (v - pred[i]) ** 2, 0);
const r2 = 1 - ssRes / ssTot;
const rmse = Math.sqrt(ssRes / y.length);

console.log(`=== 打撃イベントの得点価値（チーム×年 ${rows.length}件の回帰）===\n`);
const LABEL = { b1: '単打', xb2: '二/三塁打', hr: '本塁打', bb: '四球', hbp: '死球', sb: '盗塁', cs: '盗塁死', outs: 'アウト' };
for (const t of TERMS) console.log(`  ${LABEL[t].padEnd(7)} ${rv[t] >= 0 ? '+' : ''}${rv[t].toFixed(4)} 点`);
console.log(`\nR² = ${r2.toFixed(4)} / RMSE = ${rmse.toFixed(1)}点（平均得点 ${my.toFixed(0)}点に対し ${(rmse / my * 100).toFixed(1)}%）`);

// 妥当性の確認: 一般に知られる得点価値の序列と一致するか
const ok = rv.hr > rv.xb2 && rv.xb2 > rv.b1 && rv.b1 > rv.bb && rv.outs < 0;
console.log(`\n序列チェック（本塁打>二/三塁打>単打>四球、アウトは負）: ${ok ? 'OK' : '**NG**'}`);

await writeFile(path.join(ROOT, 'configs', 'run_values.json'), JSON.stringify({
  _comment: '打撃イベント1つあたりの得点価値。年度の総合評価で使う重みを恣意的に置かないため、チーム実得点からの回帰で決めた',
  _method: `チーム×年 ${rows.length}件（2006-2025、打数3000以上）で 得点 = Σ(係数×イベント数) を最小二乗。切片なし。三塁打は二塁打と合算（単独では推定不安定＋脚力寄与は走力査定へ回すため）。アウト数 = 打数-安打+犠打+犠飛+盗塁死`,
  _fit: { r2: Math.round(r2 * 10000) / 10000, rmse: Math.round(rmse * 10) / 10, n: rows.length },
  _script: 'scripts/calibrate_run_values.mjs',
  values: rv,
}, null, 2) + '\n', 'utf8');
console.log('\n→ configs/run_values.json');
db.close();
