// SP-100 v2 — PowerPro を一切介さない NPB+ raw → physical speed estimate
//
// ■ v1 からの変更（2026-08-14 owner訂正 + Luna provenance監査を受けた作り直し）
//   v1 は `top_speed_kmh` と `hp_to_1b_sec` を「同じ走る速さを測る2つの測定」とみなし、
//   その相関 r=0.7462 から Spearman-Brown で合成信頼性 0.8547 を作り、
//   latent_speed_z / confidence / Candidate N / Candidate F まで流していた。
//   **owner訂正により hp_to_1b_sec は NPB+ の直接計測ではない**（MISATTRIBUTED_SOURCE、
//   真の出所は未確認）。したがって v1 の parallel-forms reliability は成立しない。
//
//   v2 の方針:
//     1. NPB+ の直接計測は **最高速度のみ**。取り出しは provenance 合流点を通す（fail closed）。
//     2. 直接測定が1つしか無い以上、**内部 parallel-forms 信頼性を捏造しない**。
//        generic reliability は `NOT_IDENTIFIABLE` と記録する。
//     3. exposure（全力走の機会数）を z への**乗算縮小に使わない**（下記★）。
//     4. 縮小した値が要る用途には、仮定を明示した **感度帯** を出す。単一の点推定にしない。
//
// ■ ★ exposure を縮小係数にしない理由（v1 のもう1つの欠陥。汚染とは独立）
//   実測（2026-08-14、n=100）:
//     corr(exposure_runs, z_top)   = +0.4148
//     corr(exposure_weight, z_top) = +0.3526
//   exposure は測定対象そのものと正に相関する。z に exposure_weight を掛けると
//   **遅い選手ほど強く中心へ寄る**非対称な縮小になり、分布の平均自体が動く:
//     |z| の平均損失  速い群 0.3905 / 遅い群 0.4666
//     縮小後 mean(z) = +0.0552（縮小は本来 mean を動かさないはず）
//   さらに top_speed は **最大値統計** なので、機会数が少ない選手は
//   「精度が低い」のではなく「水準が下振れする」。中心方向への縮小はこの偏りを直さず、
//   上の非対称をそのまま乗せる。よって exposure は**別欄の文脈情報**として報告する。
//
// 使い方: node scripts/sp100_npb_raw_latent_speed.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNpbPlusMeasurements, npbPlusReliability, readRawForAudit }
  from '../src/ratings/npb_plus_provenance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

// ── provenance 合流点。top_speed_kmh 以外を要求すれば例外で止まる ────────────
const npb = loadNpbPlusMeasurements(ROOT, ['top_speed_kmh']);
const reliability = npbPlusReliability(ROOT);

const exposure = JSON.parse(readFileSync(
  path.join(ROOT, 'outputs', 'derived', 'npb_plus_sprint_exposure_2026.json'), 'utf8'));
const expRows = Array.isArray(exposure) ? exposure : (exposure.players ?? exposure.rows ?? []);

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a, m) => Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);
const corr = (a, b) => {
  if (a.length < 5) return null;
  const ma = mean(a), mb = mean(b);
  let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb);
  const den = sd(a, ma) * sd(b, mb);
  return den > 0 ? (s / a.length) / den : null;
};

// ── 1. 素材 ────────────────────────────────────────────────
const rows = [];
for (const e of expRows) {
  const s = npb.byName.get(nk(e.player));
  const top = s?.top_speed_kmh ?? e.npb_plus_sprint_speed_kmh ?? null;
  if (top == null) continue;
  rows.push({
    player: e.player, player_id: e.player_id,
    top_speed_kmh: top,
    exposure_runs: e.full_effort_run_proxy_count ?? 0,
    pa: e.PA ?? 0, games: e.games ?? 0,
    season_label: e.npb_plus_source_season_label ?? null,
    prev_pa: e.previous_season_PA ?? null,
  });
}

// ── 2. same-time normalization（同一 snapshot 内で標準化） ──────────────
const tops = rows.map(r => r.top_speed_kmh);
const mTop = mean(tops), sTop = sd(tops, mTop);
for (const r of rows) r.npb_top_speed_z = +((r.top_speed_kmh - mTop) / sTop).toFixed(4);

// 測定分解能: 生値が何段階しか無いかは情報量の上限そのもの
const distinct = [...new Set(tops)].sort((a, b) => a - b);
const stepMin = distinct.length > 1
  ? Math.min(...distinct.slice(1).map((v, i) => v - distinct[i])) : null;

// ── 3. reliability は識別できない。数値を作らない ───────────────────
//   （v1 の r_between_measures / spearman_brown_combined は撤去。復活させないこと）

// ── 4. exposure は文脈として別欄。z には掛けない ─────────────────────
const runsSorted = rows.map(r => r.exposure_runs).filter(x => x > 0).sort((a, b) => a - b);
const KAPPA_EXP = runsSorted.length ? runsSorted[Math.floor(runsSorted.length / 2)] : 30;
const corrExpZ = corr(rows.map(r => r.exposure_runs), rows.map(r => r.npb_top_speed_z));
const corrWZ = corr(rows.map(r => r.exposure_runs / (r.exposure_runs + KAPPA_EXP)),
  rows.map(r => r.npb_top_speed_z));
for (const r of rows) {
  r.exposure_context = {
    runs: r.exposure_runs,
    // 参考値として残すが、latent へは掛けない。掛けた場合の歪みは上のコメントの実測どおり。
    would_be_weight_NOT_APPLIED: +(r.exposure_runs / (r.exposure_runs + KAPPA_EXP)).toFixed(4),
    max_statistic_direction: r.exposure_runs < KAPPA_EXP
      ? 'FEW_RUNS_TOP_SPEED_LIKELY_UNDERSTATED' : 'ADEQUATE_RUNS',
  };
}

// ── 5. 縮小が要る用途向けの感度帯（仮定であって推定ではない） ─────────────
const ASSUMED_RHO = [0.5, 0.7, 0.9];
for (const r of rows) {
  r.shrunk_sensitivity_ASSUMPTION = Object.fromEntries(
    ASSUMED_RHO.map(rho => [`rho_${rho}`, +(r.npb_top_speed_z * rho).toFixed(4)]));
}

// ── 6. 監査: 誤帰属フィールドが raw に残っていることの確認（削除していない） ──
const rawAudit = readRawForAudit(ROOT);
const hpPresent = rawAudit.filter(r => r.hp_to_1b_sec != null).length;

// ── 7. temporal proximity ────────────────────────────────────
const labels = {};
for (const r of rows) labels[r.season_label ?? '(null)'] = (labels[r.season_label ?? '(null)'] ?? 0) + 1;

const out = {
  generated_at: '2026-08-14',
  supersedes: 'sp100_npb_raw_latent_speed.json v1 (2026-08-14 早版、hp_to_1b_sec 汚染)',
  policy: 'SP-046 B-1〜B-5 / SR-010 / SR-053 — PowerProラベルも翌年再現性も一切使わない',
  provenance: npb.provenance,
  contamination_remediation: {
    incident: 'hp_to_1b_sec を NPB+ 直接計測として扱っていた（MISATTRIBUTED_SOURCE）',
    audit: 'docs/audits/luna_npb_plus_provenance_contamination_20260814.md',
    removed_from_this_output: [
      'parallel-forms reliability r(top_speed, hp_to_1b)',
      'Spearman-Brown combined reliability',
      'confidence = relCombined × exposure_weight',
      'latent_speed_z（hp を第2測定として混ぜた合成）',
    ],
    raw_retained: { file: 'data/manual/npb_plus_screens.jsonl', hp_to_1b_sec_rows_kept: hpPresent },
    enforcement: 'src/ratings/npb_plus_provenance.mjs の合流点で fail closed。configs/npb_plus_field_provenance.json が正本',
  },
  measurement_reliability: {
    verdict: reliability.verdict,          // NOT_IDENTIFIABLE
    value: null,
    why: reliability.why,
    reopen_condition: reliability.reopen_condition,
    _do_not: '別の量を第2測定に仕立てて内部信頼性を作り直さない。埋めるより NOT_IDENTIFIABLE を残す方が正しい。',
  },
  inputs: {
    top_speed_kmh: rows.length,
    published_qualified_run_count: 0,
    published_sample_count: 0,
    hp_to_1b_sec_used: 0,
  },
  same_time_normalization: {
    top_speed: { mean: +mTop.toFixed(3), sd: +sTop.toFixed(3), min: Math.min(...tops), max: Math.max(...tops) },
    measurement_resolution: {
      distinct_values: distinct.length, values: distinct, min_step: stepMin,
      step_in_sd: stepMin == null ? null : +(stepMin / sTop).toFixed(3),
      note: '1刻みが約0.8sdに相当する粗い格子。順位づけの分解能そのものがここで上限になる',
    },
    note: '同一snapshot(2026)内で標準化。年をまたいだ正規化はしていない',
  },
  exposure_proxy: {
    field: 'full_effort_run_proxy_count',
    class: 'DERIVED_PROXY',
    applied_to_z: false,
    kappa_reference_only: KAPPA_EXP,
    corr_with_z_top: corrExpZ == null ? null : +corrExpZ.toFixed(4),
    corr_weight_with_z_top: corrWZ == null ? null : +corrWZ.toFixed(4),
    why_not_applied: 'exposure が測定対象と正に相関するため、乗算縮小は遅い選手を強く縮める非対称になり分布の平均が動く。'
      + 'また top_speed は最大値統計なので、機会数が少ない選手は精度でなく水準が下振れする。中心方向への縮小では直らない。',
    selection_bias_note: '機会数は走力そのもの・起用・盗塁企図の意思にも依存する。信頼度として読むときはこの交絡を併記すること。',
  },
  shrinkage_policy: {
    point_estimate: 'npb_top_speed_z（縮小なし）',
    sensitivity: 'shrunk_sensitivity_ASSUMPTION.rho_{0.5,0.7,0.9}',
    _note: 'rho は仮定であって推定ではない。単一の縮小値を production の既定にしない。',
  },
  temporal_proximity: { season_labels: labels, note: 'NPB+は2026途中のsnapshot。年別NPB+は存在しない' },
  n_players: rows.length,
  players: rows.sort((a, b) => (b.npb_top_speed_z ?? -9) - (a.npb_top_speed_z ?? -9)),
};

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp100_npb_raw_latent_speed.json'),
  JSON.stringify(out, null, 2));

console.log(`n=${rows.length}人  （NPB+ direct = top_speed_kmh のみ）`);
console.log(`provenance: 使用=${npb.fields_used.join(',')} / 除外=${npb.provenance.excluded_misattributed.map(x => x.field).join(',')}`);
console.log(`measurement reliability: ${reliability.verdict}（数値は作らない）`);
console.log(`分解能: ${distinct.length}水準 ${distinct.join(',')} / 1刻み=${(stepMin / sTop).toFixed(3)}sd`);
console.log(`exposure: corr(runs, z)=${corrExpZ.toFixed(4)} → z へは掛けない`);
console.log(`raw保持: hp_to_1b_sec ${hpPresent}行をJSONLに温存（監査用）`);
console.log(`\n上位5:`);
rows.slice(0, 5).forEach(r => console.log(`  ${r.player.padEnd(12)} z=${r.npb_top_speed_z} (${r.top_speed_kmh}km/h) runs=${r.exposure_runs}`));
console.log(`下位3:`);
rows.slice(-3).forEach(r => console.log(`  ${r.player.padEnd(12)} z=${r.npb_top_speed_z} (${r.top_speed_kmh}km/h) runs=${r.exposure_runs}`));
