// SP-042 — PowerPro stale/inertia detector（Prospi非依存版）
//
// ■ 前提が変わった
//   旧設計は Prospi との同時点比較を前提にしていたが、2026-08-14 のオーナー裁定で
//   Prospi A（スマホアプリ版）は比較適格でないと確定し SP-054/055/056 が SUPERSEDED。
//   代わりに **SP-100 の PowerPro非依存 latent physical speed** が使えるようになった。
//
// ■ 設計（尺度差の罠を踏まない）
//   PowerPro素点と npb_top_speed_z は**別の尺度**。生の差を取ると SP-056 と同じ
//   「尺度差を食い違いと誤認する」失敗になる（corr(diff, powerpro)≈-0.95 の型）。
//   → **両方を percentile へ写してから比べる**。順位空間なら尺度差は原理的に消える。
//
//   stale の定義（2つの独立した signal を分けて出す。合成して1つの点にしない）:
//     S1 内部inertia  … SP-041: 素点が動いていないのにリーグ内の位置が動いた
//                        （素点据え置き=staleではない、を実証済み。129人）
//     S2 外部不一致    … PowerPro percentile と latent physical percentile の乖離
//                        （PowerProを教師にせず、physical側を独立参照にする）
//
//   ★SP-046 A-2 の範囲内: PowerPro は「疑いの入口」としてのみ使い、解消は他証拠で行う。
//     player-level teacher にはしない（B-1）。
//
// 使い方: node scripts/sp042_powerpro_stale_detector.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

const pp = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'sp041_powerpro_normalized.json'), 'utf8'));
const latent = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'sp100_npb_raw_latent_speed.json'), 'utf8'));

// ── S1: 内部inertia（SP-041の実測をそのまま使う） ─────────────────
const inertia = pp.trajectories.filter(t => t.raw_flat_but_pct_moved);
const inertiaByPid = new Map(inertia.map(t => [String(t.pid).replace(/^proeye:/, ''), t]));

// ── S2: PowerPro percentile vs latent physical percentile ────────────
// latent 側を percentile 化（順位空間へ）
// ★SP-100 v2（2026-08-14 provenance修理）で入力フィールドが変わった。
//   旧: latent_speed_z_unshrunk（hp_to_1b_sec を第2測定として混ぜた合成）
//   新: npb_top_speed_z（NPB+最高速度のみ・標準化のみ）
//   旧名のまま読むと filter が全件落として**静かに0件**になるため、fail closed にする。
if (!latent.players.some(p => p.npb_top_speed_z != null)) {
  throw new Error('[fail closed] SP-100 v2 の npb_top_speed_z が無い。'
    + 'sp100_npb_raw_latent_speed.json が旧版（hp_to_1b_sec 汚染）の疑い。先に SP-100 を再生成せよ');
}
const lat = latent.players.filter(p => p.npb_top_speed_z != null);
const sortedLat = [...lat].sort((a, b) => a.npb_top_speed_z - b.npb_top_speed_z);
const latPct = new Map();
sortedLat.forEach((p, idx) => latPct.set(nk(p.player), sortedLat.length > 1 ? idx / (sortedLat.length - 1) : 0.5));

// PowerPro 側は SP-041 が算出済みの pct_last（版内 percentile）を使う
const ppByName = new Map();
for (const t of pp.trajectories) {
  if (t.pct_last == null) continue;
  const key = t.name ? nk(t.name) : null;
  if (key) ppByName.set(key, t);
}
// 名前が空の trajectory があるため pid 経由の対応表も作る
const ppByPid = new Map(pp.trajectories.map(t => [String(t.pid).replace(/^proeye:/, ''), t]));

const rows = [];
for (const p of lat) {
  const key = nk(p.player);
  const t = ppByName.get(key) ?? ppByPid.get(String(p.player_id));
  if (!t || t.pct_last == null) continue;
  const lp = latPct.get(key);
  if (lp == null) continue;
  const gap = lp - t.pct_last;              // 正=物理の方が上位（PowerProが低く見ている）
  rows.push({
    player: p.player, player_id: p.player_id,
    powerpro_pct: +t.pct_last.toFixed(4),
    latent_physical_pct: +lp.toFixed(4),
    percentile_gap: +gap.toFixed(4),
    powerpro_raw_last: t.raw_last, powerpro_raw_changes: t.raw_changes, powerpro_years: t.years,
    s1_internal_inertia: !!t.raw_flat_but_pct_moved,
    // ★confidence は撤去。SP-100 v2 で NPB+ の測定信頼性は NOT_IDENTIFIABLE と確定したため、
    //   数値を作らない。信頼度の代わりに exposure（機会数）を文脈として置く。
    latent_reliability: null,
    latent_reliability_status: 'NOT_IDENTIFIABLE',
    exposure_runs: p.exposure_runs,
    exposure_caveat: p.exposure_context?.max_statistic_direction ?? null,
  });
}

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a, m) => Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);
const gaps = rows.map(r => r.percentile_gap);
const mg = mean(gaps), sg = sd(gaps, mg);
// 尺度差アーティファクトの検査（SP-056の再発防止）: gap が片方の値で決まっていないか
const cr = (a, b) => { const ma = mean(a), mb = mean(b); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb); return (s / a.length) / (sd(a, ma) * sd(b, mb)); };
const artifactCheck = {
  corr_gap_vs_powerpro_pct: +cr(gaps, rows.map(r => r.powerpro_pct)).toFixed(4),
  corr_gap_vs_latent_pct: +cr(gaps, rows.map(r => r.latent_physical_pct)).toFixed(4),
  note: 'percentile空間で比べているので尺度差は原理的に消える。|r|が1に近ければ設計ミスの徴候',
};

// 2つのsignalを **合成せずに** 出す
for (const r of rows) {
  r.s2_external_disagreement = Math.abs(r.percentile_gap - mg) > 1.5 * sg;
  r.flag = r.s1_internal_inertia && r.s2_external_disagreement ? 'BOTH'
    : r.s1_internal_inertia ? 'INTERNAL_INERTIA_ONLY'
    : r.s2_external_disagreement ? 'EXTERNAL_DISAGREEMENT_ONLY' : 'NONE';
}

const byFlag = {};
for (const r of rows) byFlag[r.flag] = (byFlag[r.flag] ?? 0) + 1;

const out = {
  generated_at: '2026-08-14',
  role: 'PowerPro stale/odd の **疑いの入口** のみ（SP-046 A-2）。player-level teacher にしない（B-1）。自動補正しない',
  premise_change: 'Prospi比較を前提にした旧設計は、Prospi A が比較適格でないとのオーナー裁定(2026-08-14)で失効。SP-100 の PowerPro非依存 latent physical speed を独立参照に置き換えた',
  scale_safety: {
    method: 'PowerProもlatentも percentile へ写してから比較する。生の差を取らない',
    why: 'SP-056 で生diffが尺度差に支配された(corr(diff, powerpro)=-0.945)。順位空間なら尺度差は原理的に消える',
    artifact_check: artifactCheck,
  },
  signals: {
    S1_internal_inertia: 'SP-041実測: 素点が一度も動いていないのにリーグ内percentileが動いた選手。「据え置き年数だけでstale判定は不可」の実証に基づく',
    S2_external_disagreement: 'PowerPro percentile と latent physical percentile の乖離が平均から1.5SD以上',
    note: '2つは**合成しない**。原因が違うため（S1はPowerPro内部の相対位置ずれ、S2は物理証拠との不一致）',
  },
  n_compared: rows.length,
  n_powerpro_panel: pp.trajectories.length,
  n_internal_inertia_total: inertia.length,
  flag_counts: byFlag,
  gap_stats: { mean: +mg.toFixed(4), sd: +sg.toFixed(4) },
  rows: rows.sort((a, b) => Math.abs(b.percentile_gap - mg) - Math.abs(a.percentile_gap - mg)),
};
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp042_powerpro_stale_detector.json'), JSON.stringify(out, null, 2));

console.log(`比較できた選手: ${rows.length} / PowerProパネル ${pp.trajectories.length}人`);
console.log(`S1 内部inertia（素点据え置きだがpercentileが動いた）: パネル全体で ${inertia.length}人`);
console.log(`\n尺度アーティファクト検査: corr(gap, powerpro_pct)=${artifactCheck.corr_gap_vs_powerpro_pct} / corr(gap, latent_pct)=${artifactCheck.corr_gap_vs_latent_pct}`);
console.log(`  → |r|が1に近くなければ percentile 空間での比較は健全`);
console.log(`\nflag内訳: ${JSON.stringify(byFlag)}`);
console.log(`\n乖離上位8（PowerProが物理より低く見ている＝正のgap）:`);
out.rows.filter(r => r.percentile_gap > 0).slice(0, 8).forEach(r =>
  console.log(`  ${r.player.padEnd(12)} PP_pct=${r.powerpro_pct.toFixed(2)} 物理_pct=${r.latent_physical_pct.toFixed(2)} gap=${r.percentile_gap.toFixed(2)} 素点${r.powerpro_raw_last}(変更${r.powerpro_raw_changes}回/${r.powerpro_years}年) [${r.flag}]`));
console.log(`\n乖離上位5（PowerProが物理より高く見ている＝負のgap）:`);
out.rows.filter(r => r.percentile_gap < 0).slice(0, 5).forEach(r =>
  console.log(`  ${r.player.padEnd(12)} PP_pct=${r.powerpro_pct.toFixed(2)} 物理_pct=${r.latent_physical_pct.toFixed(2)} gap=${r.percentile_gap.toFixed(2)} 素点${r.powerpro_raw_last}(変更${r.powerpro_raw_changes}回/${r.powerpro_years}年) [${r.flag}]`));
