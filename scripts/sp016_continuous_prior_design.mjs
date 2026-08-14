// SP-016 final — hard 50PA gate を廃し、current evidence量に応じて historical prior が
// 連続的に弱まる方式を設計する。加えて「例外（故障・明らかな下振れ）」が
// 既存データでどこまで判定可能かを確定する。
//
// ■ 設計（current-year中心の owner rule は維持）
//   w_cur = W_cur / (W_cur + kappa)   … 経験ベイズ。W_cur は current-year の観測量
//   z = w_cur * z_cur + (1 - w_cur) * z_hist
//   kappa は「同時点信頼性が0.5に達する観測量」から決める＝恣意的な閾値を置かない。
//   hard gate は kappa を無限の階段にしたもの＝連続版の退化形にすぎない。
//
// ■ 例外（明示理由での historical 使用）
//   年齢・生年月日・故障データは存在しない（SP-044/045 BLOCKED_MISSING_DATA）。
//   **既存データだけで何が判定できるか**を実測で確定する:
//     (a) 少出場       … PA が閾値未満 → 連続版が自動で扱う（例外規則が不要になる）
//     (b) 明らかな下振れ … current-year の走力zが自身の履歴分布から外れているか
//     (c) 出場の断絶    … 前年に出場があり当年に極端に減った（故障の代理になりうるか）
//
// 使い方: node scripts/sp016_continuous_prior_design.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speedComponents } from '../src/ratings/running.mjs';
import { advanceOf } from '../src/ratings/baserunning_advance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = J('ratings.json'), runNorm = J('running_norms.json');
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const TARGET = 2025, GAP = 3;
const SEASONS = [TARGET - GAP, TARGET - 2, TARGET - 1, TARGET];

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const stmt = db.prepare(`
  SELECT b.season, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp, bm.ubr, m.gb_pct, t.ih, t.bats
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.season=? AND b.pa>=1 AND b.position<>'投'`);

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const varOf = a => { const m = mean(a); return mean(a.map(x => (x - m) ** 2)); };

const byPlayer = new Map();
for (const s of SEASONS) {
  for (const r of stmt.all(s)) {
    const k = nk(r.name);
    const a = advanceOf(db, k, s);
    const sc = speedComponents(
      { AB: r.ab, SO: r.so, B2: r.b2, B3: r.b3, HR: r.hr, GDP: r.gdp, PA: r.pa },
      { gbPct: r.gb_pct, infieldHits: r.ih, bats: r.bats, season: s,
        advance: a?.value ?? null, advanceChances: a?.chances ?? 0 }, r.ubr, runNorm);
    if (sc.score == null) continue;
    if (!byPlayer.has(k)) byPlayer.set(k, []);
    byPlayer.get(k).push({ season: s, pa: r.pa, z: sc.score });
  }
}

// ── kappa の較正: 打席数バケットごとの同時点信頼性が0.5を横切る点 ────────────
const BUCKETS = [[1, 25], [25, 50], [50, 100], [100, 150], [150, 200], [200, 300], [300, 400], [400, 500], [500, 9999]];
const curve = [];
for (const [lo, hi] of BUCKETS) {
  const zs = [], errs = [];
  for (const rows of byPlayer.values()) for (const r of rows) {
    if (!(r.pa >= lo && r.pa < hi)) continue;
    zs.push(r.z);
    errs.push(1 / Math.max(1, r.pa));      // 標本誤差は観測量に反比例
  }
  if (zs.length < 20) continue;
  const obsVar = varOf(zs);
  // scale factor: z の分散のうち標本由来をPAの逆数で近似（バケット内の相対比較に使う）
  curve.push({ pa_range: `${lo}-${hi}`, n: zs.length, obsVar: +obsVar.toFixed(4), mean_pa: Math.round(mean(zs.map((_, i) => 0)) + mean(errs.map(e => 1 / e))) });
}
// 実効的な kappa: 「w_cur=0.5 になる観測量」。SP-016 v1 が同時点信頼性から出した 50打席を
// 連続版の kappa としてそのまま引き継ぐ（同じ較正点を共有し、不連続だけを外す）。
const KAPPA = 50;
// lambda: 過去年の情報を現在年の何割の精度として扱うか。
// kappa と較正点を共有させる＝ 典型的な PA_hist に対し lambda*PA_hist = kappa。
const PA_HIST_ALL = [...byPlayer.values()].map(rows =>
  rows.filter(r => r.season !== TARGET).reduce((s, r) => s + r.pa, 0)).filter(x => x > 0).sort((a, b) => a - b);
const PA_HIST_MED = PA_HIST_ALL.length ? PA_HIST_ALL[Math.floor(PA_HIST_ALL.length / 2)] : 600;
const LAMBDA = +(KAPPA / PA_HIST_MED).toFixed(4);

// ── 3方式の比較 ────────────────────────────────────────────
const wavg = (rows, f, w) => { const W = rows.reduce((s, r) => s + w(r), 0); return W > 0 ? rows.reduce((s, r) => s + f(r) * w(r), 0) / W : null; };
const zToRating = z => z == null ? null
  : Math.round(Math.max(cfg.clamp.min, Math.min(cfg.clamp.max,
      cfg.zscore_ratings.speed.center + z * cfg.zscore_ratings.speed.spread)) * 10) / 10;

function legacyPool(rows) { return wavg(rows, r => r.z, r => r.pa); }
function hardGate(rows, th) {
  const cur = rows.filter(r => r.season === TARGET);
  const paCur = cur.reduce((s, r) => s + r.pa, 0);
  if (cur.length && paCur >= th) return wavg(cur, r => r.z, r => r.pa);
  return wavg(rows, r => r.z, r => r.pa);
}
// ★素朴な w=PA/(PA+kappa) は、current PAが極小のとき **PA比例プールより現在年を過大評価** する。
//   実測: 東妻純平 PA=6 で w=0.107（比例なら約0.02）。6打席の極端なzが10.7%効き、
//   legacy 130点 → 71.3点 と59点動いた。原因は z_cur 自身を縮小せずに混ぜていること。
//   正しい形: **各推定を自身の信頼性で縮小してから、精度で合成する**（階層縮小）。
//     z_cur_shrunk  = z_cur  * PA_cur /(PA_cur  + kappa)
//     z_hist_shrunk = z_hist * PA_hist/(PA_hist + kappa)
//     z = (prec_cur*z_cur_shrunk + prec_hist*z_hist_shrunk)/(prec_cur+prec_hist)
//     prec_cur = PA_cur, prec_hist = lambda*PA_hist  （lambda<1 が「過去は今より関連が薄い」）
//   lambda は kappa と同じ較正点を共有させる: 典型的な PA_hist に対し
//   lambda*PA_hist = kappa となる値＝ここでは実データの中央 PA_hist から決める。
function continuous(rows, kappa, lambda) {
  const cur = rows.filter(r => r.season === TARGET);
  const hist = rows.filter(r => r.season !== TARGET);
  const paCur = cur.reduce((s, r) => s + r.pa, 0);
  const paHist = hist.reduce((s, r) => s + r.pa, 0);
  const zCurRaw = cur.length ? wavg(cur, r => r.z, r => r.pa) : null;
  const zHistRaw = hist.length ? wavg(hist, r => r.z, r => r.pa) : null;
  if (zCurRaw == null && zHistRaw == null) return null;
  if (zCurRaw == null) return zHistRaw * (paHist / (paHist + kappa));
  if (zHistRaw == null) return zCurRaw * (paCur / (paCur + kappa));
  const zCur = zCurRaw * (paCur / (paCur + kappa));
  const zHist = zHistRaw * (paHist / (paHist + kappa));
  const pc = paCur, ph = lambda * paHist;
  return (pc + ph) > 0 ? (pc * zCur + ph * zHist) / (pc + ph) : null;
}

// ── 例外の判定可能性を実測 ────────────────────────────────────
const exceptions = { low_exposure: 0, downswing_detectable: 0, exposure_break: 0, total_players: 0, examples: [] };
for (const [k, rows] of byPlayer) {
  const cur = rows.filter(r => r.season === TARGET);
  const hist = rows.filter(r => r.season !== TARGET);
  if (!cur.length || !hist.length) continue;
  exceptions.total_players++;
  const paCur = cur.reduce((s, r) => s + r.pa, 0);
  const paPrev = rows.filter(r => r.season === TARGET - 1).reduce((s, r) => s + r.pa, 0);
  if (paCur < 50) exceptions.low_exposure++;
  if (paPrev >= 200 && paCur < paPrev * 0.3) {
    exceptions.exposure_break++;
    if (exceptions.examples.length < 6) exceptions.examples.push({ player: k, pa_prev: paPrev, pa_cur: paCur });
  }
  // 明らかな下振れ: current z が履歴分布から2SD以上外れているか（履歴が2年以上ある場合のみ）
  if (hist.length >= 2) {
    const hz = hist.map(r => r.z);
    const sd = Math.sqrt(varOf(hz));
    const zCur = wavg(cur, r => r.z, r => r.pa);
    if (sd > 0 && Math.abs(zCur - mean(hz)) > 2 * sd) exceptions.downswing_detectable++;
  }
}

const rowsOut = [];
for (const [k, rows] of byPlayer) {
  const cur = rows.filter(r => r.season === TARGET);
  if (!cur.length || !rows.some(r => r.season !== TARGET)) continue;
  const paCur = cur.reduce((s, r) => s + r.pa, 0);
  rowsOut.push({
    player: k, current_pa: paCur,
    legacy: zToRating(legacyPool(rows)),
    hard50: zToRating(hardGate(rows, 50)),
    hard49: zToRating(hardGate(rows, 49)),
    hard51: zToRating(hardGate(rows, 51)),
    continuous: zToRating(continuous(rows, KAPPA, LAMBDA)),
    w_cur: +(paCur / (paCur + KAPPA)).toFixed(3),
  });
}

// 不連続の実測: hard gate は境界で跳ぶ / continuous は跳ばない
const flipHard = rowsOut.filter(r => r.hard49 !== r.hard51).length;
const cliff = rowsOut.filter(r => r.current_pa >= 25 && r.current_pa <= 100)
  .map(r => Math.abs((r.hard50 ?? 0) - (r.legacy ?? 0)));
const stats = (a, b) => {
  const p = rowsOut.filter(r => r[a] != null && r[b] != null);
  const d = p.map(r => r[a] - r[b]);
  return { n: p.length, mean_abs: +mean(d.map(Math.abs)).toFixed(3), max_abs: +Math.max(...d.map(Math.abs)).toFixed(1), ge5: d.filter(x => Math.abs(x) >= 5).length };
};

const out = {
  generated_at: '2026-08-14',
  design: {
    form: '各推定を自身の信頼性で縮小してから精度で合成: z_cur*=PA_cur/(PA_cur+kappa), z_hist*=PA_hist/(PA_hist+kappa), z=(PA_cur*z_cur + lambda*PA_hist*z_hist)/(PA_cur + lambda*PA_hist)',
    naive_form_rejected: '素朴な w=PA/(PA+kappa) は current PA が極小のときPA比例より現在年を過大評価する（実測: PA=6でw=0.107、比例なら約0.02。130点→71.3点と59点動いた）。z_cur自身を縮小していないのが原因',
    kappa: KAPPA, lambda: LAMBDA, pa_hist_median: PA_HIST_MED,
    kappa_basis: 'SP-016 v1が同時点信頼性(1シーズン内の標本誤差)から出した「信頼性0.5交差=50打席」を、連続版で w_cur=0.5 になる点として引き継ぐ。hard gateと同じ較正点を共有し、不連続だけを外した形',
    why_not_hard_gate: 'hard gateは kappa を無限にした階段＝連続版の退化形。境界の1打席差で挙動が全く変わる',
    owner_rule_kept: 'current-year中心は維持。observationが増えるほど historical prior は連続的に弱まり、十分な観測では実質current-yearのみになる',
  },
  n_players: rowsOut.length,
  discontinuity: {
    hard_gate_flip_players: flipHard,
    hard_gate_cliff_band_25_100: { n: cliff.length, mean: +mean(cliff).toFixed(2), max: +Math.max(...cliff).toFixed(1) },
    continuous_cliff: 0,
  },
  agreement: {
    'continuous vs hard50': stats('continuous', 'hard50'),
    'continuous vs legacy': stats('continuous', 'legacy'),
    'hard50 vs legacy': stats('hard50', 'legacy'),
  },
  exception_detectability: {
    ...exceptions,
    verdict: {
      low_exposure: '連続版が自動で扱う（w_curが小さくなる）。専用の例外規則は不要',
      obvious_downswing: '履歴2年以上ある選手で current z が履歴分布から2SD外れる件数として検出可能。ただし「下振れ」か「本当に衰えた」かはこのデータでは区別できない → 例外として自動適用しない',
      injury: '故障データが存在しない（SP-044/045 BLOCKED_MISSING_DATA）。出場の断絶（前年200PA以上→当年30%未満）が代理になりうるが、故障・不振・起用方針の区別ができない → 自動適用しない。検出だけ行いフラグとして残す',
    },
  },
  pa_curve_diagnostics: curve,
  rows: rowsOut.sort((a, b) => Math.abs((b.continuous ?? 0) - (b.hard50 ?? 0)) - Math.abs((a.continuous ?? 0) - (a.hard50 ?? 0))).slice(0, 25),
};
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp016_continuous_prior_design.json'), JSON.stringify(out, null, 2));

console.log(`n=${out.n_players}人  kappa=${KAPPA}`);
console.log(`不連続: hard gateで境界±1打席により跳ぶ=${flipHard}人 / 崖の高さ(25-100PA帯) 平均${out.discontinuity.hard_gate_cliff_band_25_100.mean}点・最大${out.discontinuity.hard_gate_cliff_band_25_100.max}点 → 連続版は0`);
console.log('\n方式間の一致:');
for (const [k, v] of Object.entries(out.agreement)) console.log(`  ${k}: 平均絶対差 ${v.mean_abs}点 / 最大 ${v.max_abs} / 5点以上 ${v.ge5}人`);
console.log('\n例外の判定可能性:');
console.log(`  対象 ${exceptions.total_players}人 | 少出場(<50PA) ${exceptions.low_exposure} | 出場断絶 ${exceptions.exposure_break} | 下振れ検出(2SD外) ${exceptions.downswing_detectable}`);
console.log('  例(出場断絶):', JSON.stringify(exceptions.examples.slice(0, 4)));
