// 打球の種類（ゴロ/ライナー/外野フライ/内野フライ）ごとに、結果がどう分かれるかを実データから推定する。
// これが「能力 → 打球 → 結果」の中間層の土台になり、Sol仕様の
//   §7 弾道 / 02 §5.4・05 §6 パワー↔ミート相互作用 / 05 §7 内野安打の走力分離
// をまとめて成立させる。
//
// 方法: 選手ごとの打球タイプ割合（NPB Basement）と実結果（プロEYE球）を突き合わせ、
//   結果率_i = Σ_type (タイプ割合_i,type × 結果確率_type)
// を切片なし重回帰で解く。選手間の打球構成の違いが係数を識別する。
import { DatabaseSync } from 'node:sqlite';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_AB = Number(process.argv[2] || 250);
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

// 打球タイプはインプレー打球に対する割合。分母をインプレー打数に揃える必要がある。
const rows = db.prepare(`
  SELECT b.season, b.name, b.ab, b.h, b.b1, b.b2, b.b3, b.hr, b.so,
         m.gb_pct, m.ld_pct, m.offb_pct, m.iffb_pct, m.hr_fb_pct, m.babip
  FROM v_batting b
  JOIN player_link l ON l.proeye_id = b.player_id AND l.season = b.season
  JOIN v_bm_bat m ON m.player_id = l.bm_id AND m.season = b.season AND m.farm = 0
  WHERE b.ab >= ? AND b.position <> '投'
    AND m.gb_pct IS NOT NULL AND m.offb_pct IS NOT NULL`).all(MIN_AB);

console.log(`対象: ${rows.length}選手シーズン（打数${MIN_AB}以上、打球タイプ実測あり）`);
if (rows.length < 50) { console.error('サンプル不足'); process.exit(1); }

const TYPES = ['gb', 'ld', 'offb', 'iffb'];
const recs = rows.map(r => {
  // 打球タイプの割合は合計100%になる前提。ズレは正規化で吸収
  const raw = [r.gb_pct, r.ld_pct, r.offb_pct, r.iffb_pct];
  const sum = raw.reduce((a, b) => a + (b ?? 0), 0);
  const share = raw.map(v => (v ?? 0) / sum);
  // インプレー打数（三振と本塁打を除く…ではなく、本塁打も打球なので三振のみ除く）
  const inplayAb = r.ab - r.so;
  return {
    ...r, share, inplayAb,
    y: {
      b1: r.b1 / inplayAb, b2: r.b2 / inplayAb, b3: r.b3 / inplayAb,
      hr: r.hr / inplayAb, out: (inplayAb - r.b1 - r.b2 - r.b3 - r.hr) / inplayAb,
    },
  };
});

// 切片なし重み付き最小二乗（任意の変数数）。activeで使う変数を指定する。
function solveWLS(X, y, w, active) {
  const k = active.length;
  const A = Array.from({ length: k }, () => new Array(k).fill(0));
  const b = new Array(k).fill(0);
  for (let i = 0; i < X.length; i++) {
    const wi = w[i];
    for (let p = 0; p < k; p++) {
      b[p] += wi * X[i][active[p]] * y[i];
      for (let q = 0; q < k; q++) A[p][q] += wi * X[i][active[p]] * X[i][active[q]];
    }
  }
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r2 = c + 1; r2 < k; r2++) if (Math.abs(A[r2][c]) > Math.abs(A[piv][c])) piv = r2;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    const d = A[c][c];
    if (Math.abs(d) < 1e-12) return null;
    for (let q = c; q < k; q++) A[c][q] /= d;
    b[c] /= d;
    for (let r2 = 0; r2 < k; r2++) {
      if (r2 === c) continue;
      const f = A[r2][c];
      for (let q = c; q < k; q++) A[r2][q] -= f * A[c][q];
      b[r2] -= f * b[c];
    }
  }
  return b;
}

/**
 * 構造制約つきで解く。
 *  - allowed: その結果が物理的に起こりうる打球タイプ（それ以外は0に固定）
 *  - 非負制約: 負になった係数を0に落として再推定する（簡易NNLS）
 */
function solveConstrained(X, y, w, allowed) {
  let active = [...allowed];
  for (let iter = 0; iter < 4 && active.length; iter++) {
    const est = solveWLS(X, y, w, active);
    if (!est) break;
    const neg = active.filter((_, i) => est[i] < 0);
    if (!neg.length) {
      const full = new Array(4).fill(0);
      active.forEach((t, i) => { full[t] = est[i]; });
      return full;
    }
    active = active.filter(t => !neg.includes(t));
  }
  return new Array(4).fill(0);
}

const X = recs.map(r => r.share);
const W = recs.map(r => r.inplayAb); // 打数で重み付け

// 物理的に起こりうる組み合わせだけを許可する（打球タイプの順: gb, ld, offb, iffb）
// 本塁打はフライからのみ。内野フライは単打がごく稀にあるが実質アウト。
const ALLOWED = {
  b1: [0, 1, 2, 3],
  b2: [0, 1, 2],       // 内野フライの二塁打は無い
  b3: [0, 1, 2],       // 同上
  hr: [2],             // 外野フライのみ（ゴロ・ライナー・内野フライの本塁打は分類上ありえない）
};

const coef = {};
for (const outcome of ['b1', 'b2', 'b3', 'hr']) {
  coef[outcome] = solveConstrained(X, recs.map(r => r.y[outcome]), W, ALLOWED[outcome]);
}
// --- リーグ平均の再現に合わせて水準を較正する ---
// 選手ごとの回帰は「誰が多いか」の相対関係を捉えるが、リーグ全体の水準は保証しない。
// 実際、制約付き回帰では本塁打がリーグ実測の1.57倍に出た（外野フライのみに帰属させた制約が強すぎた）。
// エンジンの恒等性（全員リーグ平均で回せばリーグ実測が再現される）を満たすため、
// 各結果カテゴリをリーグ実測に合わせてスケールする。
const lgShare = (() => {
  const r = db.prepare(`
    SELECT SUM(gb_pct*pa)/SUM(pa) gb, SUM(ld_pct*pa)/SUM(pa) ld,
           SUM(offb_pct*pa)/SUM(pa) offb, SUM(iffb_pct*pa)/SUM(pa) iffb
    FROM v_bm_bat WHERE farm=0 AND gb_pct IS NOT NULL`).get();
  const s = r.gb + r.ld + r.offb + r.iffb;
  return [r.gb / s, r.ld / s, r.offb / s, r.iffb / s];
})();
const lgActual = db.prepare(`
  SELECT SUM(b1) b1, SUM(b2) b2, SUM(b3) b3, SUM(hr) hr, SUM(ab) ab, SUM(so) so
  FROM v_batting WHERE season >= 2020`).get();
const lgInplay = lgActual.ab - lgActual.so;

const scales = {};
for (const o of ['b1', 'b2', 'b3', 'hr']) {
  const pred = lgShare.reduce((a, s, i) => a + s * coef[o][i], 0);
  const act = lgActual[o] / lgInplay;
  scales[o] = pred > 0 ? act / pred : 1;
  coef[o] = coef[o].map(v => v * scales[o]);
}
console.log('\nリーグ再現のためのスケール調整:', Object.entries(scales).map(([k, v]) => `${k}=${v.toFixed(3)}`).join(' '));

// アウトは残余として定義する（合計が必ず1になる）
coef.out = [0, 1, 2, 3].map(t => 1 - coef.b1[t] - coef.b2[t] - coef.b3[t] - coef.hr[t]);
const negOut = coef.out.filter(v => v < 0).length;
if (negOut) console.log(`警告: アウト率が負になった打球タイプが${negOut}件あります`);

console.log('\n=== 打球タイプ別の結果確率（インプレー打球あたり） ===\n');
console.log('打球タイプ'.padEnd(12) + ['単打', '二塁打', '三塁打', '本塁打', 'アウト'].map(s => s.padStart(9)).join('') + '   合計');
const labels = { gb: 'ゴロ', ld: 'ライナー', offb: '外野フライ', iffb: '内野フライ' };
TYPES.forEach((t, i) => {
  const vals = ['b1', 'b2', 'b3', 'hr', 'out'].map(o => coef[o][i]);
  const sum = vals.reduce((a, b) => a + b, 0);
  console.log(labels[t].padEnd(11) + vals.map(v => v.toFixed(3).padStart(9)).join('') + sum.toFixed(3).padStart(8));
});

// 検証: 推定係数で各選手の結果を再現できるか
let se = 0, n = 0;
for (const r of recs) {
  for (const o of ['b1', 'b2', 'b3', 'hr']) {
    const pred = TYPES.reduce((a, t, i) => a + r.share[i] * coef[o][i], 0);
    se += (pred - r.y[o]) ** 2 * r.inplayAb; n += r.inplayAb;
  }
}
console.log(`\n再現の重み付きRMSE: ${Math.sqrt(se / n).toExponential(3)}`);

// 選手ごとのばらつき: 同じ打球構成でも結果が違う＝これが能力差（パワー・走力・打球の強さ）
console.log('\n=== 同じ打球構成でも結果が違う部分 ＝ 能力差 ===');
const resid = recs.map(r => {
  const predHr = TYPES.reduce((a, t, i) => a + r.share[i] * coef.hr[i], 0);
  const predB1 = TYPES.reduce((a, t, i) => a + r.share[i] * coef.b1[i], 0);
  return { name: r.name, season: r.season, hrRes: r.y.hr - predHr, b1Res: r.y.b1 - predB1, hrFb: r.hr_fb_pct, gb: r.gb_pct };
});
const top = [...resid].sort((a, b) => b.hrRes - a.hrRes).slice(0, 5);
const bot = [...resid].sort((a, b) => a.b1Res - b.b1Res).slice(0, 0);
console.log('本塁打が打球構成から期待される以上に多い選手（＝パワー）');
for (const r of top) console.log(`  ${r.name.replace(/　/g, ' ').padEnd(13)}${r.season}  超過${(r.hrRes * 100).toFixed(1)}%  (HR/FB%=${r.hrFb})`);
const topB1 = [...resid].sort((a, b) => b.b1Res - a.b1Res).slice(0, 5);
console.log('単打が打球構成から期待される以上に多い選手（＝走力・打球の質）');
for (const r of topB1) console.log(`  ${r.name.replace(/　/g, ' ').padEnd(13)}${r.season}  超過${(r.b1Res * 100).toFixed(1)}%  (ゴロ%=${r.gb})`);

await writeFile(path.join(ROOT, 'outputs', 'derived', 'batted_ball_coefficients.json'),
  JSON.stringify({ minAb: MIN_AB, n: recs.length, types: TYPES, coefficients: coef }, null, 2), 'utf8');
console.log('\n→ outputs/derived/batted_ball_coefficients.json');
db.close();
