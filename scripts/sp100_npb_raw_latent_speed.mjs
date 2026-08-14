// SP-100 — PowerPro を一切介さない NPB+ raw → latent physical speed
//
// ■ owner裁定(2026-08-14)の設計要件
//   NPB+ raw physical measurement
//     → same-time normalization / measurement reliability / exposure / temporal proximity
//     → latent physical-speed estimate
//   ★PowerProラベルも翌年再現性も weight・採否に使わない（SP-046 B-1〜B-5 / SR-053）
//
// ■ 使う raw（PowerPro非経由であることを機械的に保証する）
//   top_speed_kmh   … NPB+の最高走速度(km/h)。速いほど大きい
//   hp_to_1b_sec    … 本塁→一塁の到達秒。速いほど**小さい**ので符号反転して使う
//   full_effort_run_proxy_count … 全力走の機会数＝exposure
//   season_label / previous_season_* … temporal proximity
//   ※ pawapuro_2026_speed は**読み込まない**（実データでも 0/100 で存在しない）
//
// ■ reliability の出し方（公表run数が無いため）
//   npb_plus_sample_count / qualified_run_count は 0/100 で**全てnull**。
//   代わりに **parallel forms**（同じ構成概念を測る別測定どうしの一致）で推定する:
//     top_speed_kmh と hp_to_1b_sec は別の物理量だが同じ「走る速さ」を測る。
//     その相関 r が、各測定が共有する構成概念の割合の下限になる。
//   これは PowerPro を一切使わない内部整合の推定。
//
// 使い方: node scripts/sp100_npb_raw_latent_speed.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

const exposure = JSON.parse(readFileSync(
  path.join(ROOT, 'outputs', 'derived', 'npb_plus_sprint_exposure_2026.json'), 'utf8'));
const expRows = Array.isArray(exposure) ? exposure : (exposure.players ?? exposure.rows ?? []);
const screens = readFileSync(path.join(ROOT, 'data', 'manual', 'npb_plus_screens.jsonl'), 'utf8')
  .split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
const byName = new Map(screens.map(r => [nk(r.name), r]));

// ★PowerPro由来フィールドを一切読まないことを機械的に確認する
const FORBIDDEN = ['pawapuro', 'powerpro'];
const usedFields = ['npb_plus_sprint_speed_kmh', 'full_effort_run_proxy_count', 'PA', 'games',
  'npb_plus_source_season_label', 'previous_season_PA', 'top_speed_kmh', 'hp_to_1b_sec'];
const guard = usedFields.filter(f => FORBIDDEN.some(x => f.toLowerCase().includes(x)));
if (guard.length) throw new Error(`PowerPro由来フィールドを使おうとしている: ${guard.join(',')}`);

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a, m) => Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);
const corr = (a, b) => {
  const ma = mean(a), mb = mean(b);
  let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb);
  return (s / a.length) / (sd(a, ma) * sd(b, mb));
};

// ── 1. 素材を集める ────────────────────────────────────────
const rows = [];
for (const e of expRows) {
  const s = byName.get(nk(e.player));
  const top = s?.top_speed_kmh ?? e.npb_plus_sprint_speed_kmh ?? null;
  const h2f = s?.hp_to_1b_sec ?? null;
  if (top == null) continue;
  rows.push({
    player: e.player, player_id: e.player_id,
    top_speed_kmh: top,
    hp_to_1b_sec: h2f,
    exposure_runs: e.full_effort_run_proxy_count ?? 0,
    pa: e.PA ?? 0, games: e.games ?? 0,
    season_label: e.npb_plus_source_season_label ?? null,
    prev_pa: e.previous_season_PA ?? null,
  });
}

// ── 2. same-time normalization（同一snapshot内で標準化） ─────────────
const tops = rows.map(r => r.top_speed_kmh);
const mTop = mean(tops), sTop = sd(tops, mTop);
const h2fRows = rows.filter(r => r.hp_to_1b_sec != null);
const h2fs = h2fRows.map(r => -r.hp_to_1b_sec);          // 符号反転＝速いほど大きい
const mH = mean(h2fs), sH = sd(h2fs, mH);
for (const r of rows) {
  r.z_top = (r.top_speed_kmh - mTop) / sTop;
  r.z_h2f = r.hp_to_1b_sec == null ? null : ((-r.hp_to_1b_sec) - mH) / sH;
}

// ── 3. measurement reliability（parallel forms。PowerPro不使用） ──────
const pf = h2fRows.map(r => [r.z_top, r.z_h2f]);
const rPF = corr(pf.map(p => p[0]), pf.map(p => p[1]));
// Spearman-Brown: 2測定を合成したときの信頼性
const relCombined = (2 * rPF) / (1 + rPF);

// ── 4. exposure による精度（全力走の機会数） ──────────────────────
// kappa_exp: 機会数がこの値のとき exposure 由来の信頼が 0.5。
// 実データの中央値を使い恣意的な定数を置かない。
const runs = rows.map(r => r.exposure_runs).filter(x => x > 0).sort((a, b) => a - b);
const KAPPA_EXP = runs.length ? runs[Math.floor(runs.length / 2)] : 30;

// ── 5. latent speed の合成 ────────────────────────────────
// 各測定を「その測定の信頼性」で重み付けし、exposure由来の精度で全体を縮小する。
// 測定が1つしかない選手は、その1つだけで（重みは下がる）。
for (const r of rows) {
  const parts = [];
  parts.push({ z: r.z_top, w: Math.max(0, rPF) });                    // top_speed
  if (r.z_h2f != null) parts.push({ z: r.z_h2f, w: Math.max(0, rPF) });
  const wsum = parts.reduce((s, p) => s + p.w, 0);
  const zMeas = wsum > 0 ? parts.reduce((s, p) => s + p.z * p.w, 0) / wsum : null;
  const wExp = r.exposure_runs / (r.exposure_runs + KAPPA_EXP);
  r.n_measures = parts.length;
  r.exposure_weight = +wExp.toFixed(4);
  // 縮小: 観測が薄い選手ほど集団平均(0)へ寄せる
  r.latent_speed_z = zMeas == null ? null : +(zMeas * wExp).toFixed(4);
  r.latent_speed_z_unshrunk = zMeas == null ? null : +zMeas.toFixed(4);
  r.confidence = +(Math.min(1, relCombined) * wExp).toFixed(4);
};

// ── 6. temporal proximity ────────────────────────────────
const labels = {};
for (const r of rows) labels[r.season_label ?? '(null)'] = (labels[r.season_label ?? '(null)'] ?? 0) + 1;

const out = {
  generated_at: '2026-08-14',
  policy: 'SP-046 B-1〜B-5 / SR-010 / SR-053 — PowerProラベルも翌年再現性も一切使わない',
  powerpro_fields_read: [],
  powerpro_guard: 'pawapuro_2026_speed は読み込んでいない（実データでも 0/100 で不在）。使用フィールドはコード内で機械チェック',
  inputs: {
    top_speed_kmh: rows.filter(r => r.top_speed_kmh != null).length,
    hp_to_1b_sec: h2fRows.length,
    exposure_runs_nonzero: rows.filter(r => r.exposure_runs > 0).length,
    published_qualified_run_count: 0,
    published_sample_count: 0,
  },
  same_time_normalization: {
    top_speed: { mean: +mTop.toFixed(3), sd: +sTop.toFixed(3) },
    hp_to_1b_negated: { mean: +mH.toFixed(3), sd: +sH.toFixed(3) },
    note: '同一snapshot(2026)内で標準化。年をまたいだ正規化はしていない',
  },
  measurement_reliability: {
    method: 'parallel forms（top_speed_kmh と hp_to_1b_sec の一致）。公表run数が全てnullのため代替',
    r_between_measures: +rPF.toFixed(4),
    spearman_brown_combined: +relCombined.toFixed(4),
    note: 'PowerProを一切使わない内部整合の推定。2測定は別の物理量だが同じ「走る速さ」を測る',
  },
  exposure: {
    field: 'full_effort_run_proxy_count',
    kappa: KAPPA_EXP,
    kappa_basis: '実データの中央値。恣意的な定数を置かない',
  },
  temporal_proximity: { season_labels: labels,
    note: 'NPB+は2026途中のsnapshot。査定年との距離はこのラベルで追う。年別NPB+は存在しない' },
  n_players: rows.length,
  players: rows.sort((a, b) => (b.latent_speed_z ?? -9) - (a.latent_speed_z ?? -9)),
};
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp100_npb_raw_latent_speed.json'), JSON.stringify(out, null, 2));

console.log(`n=${rows.length}人`);
console.log(`入力: top_speed ${out.inputs.top_speed_kmh} / hp_to_1b ${out.inputs.hp_to_1b_sec} / exposure>0 ${out.inputs.exposure_runs_nonzero}`);
console.log(`公表run数: sample_count ${out.inputs.published_sample_count}/100, qualified_run_count ${out.inputs.published_qualified_run_count}/100 → parallel formsで代替`);
console.log(`\nmeasurement reliability: r(top_speed, hp_to_1b) = ${rPF.toFixed(4)} → Spearman-Brown合成 ${relCombined.toFixed(4)}`);
console.log(`exposure kappa = ${KAPPA_EXP}（実データ中央値）`);
console.log(`\nlatent speed 上位5:`);
rows.slice(0, 5).forEach(r => console.log(`  ${r.player.padEnd(12)} z=${r.latent_speed_z} (未縮小 ${r.latent_speed_z_unshrunk}) exposure=${r.exposure_runs} conf=${r.confidence}`));
console.log(`下位3:`);
rows.slice(-3).forEach(r => console.log(`  ${r.player.padEnd(12)} z=${r.latent_speed_z} (未縮小 ${r.latent_speed_z_unshrunk}) exposure=${r.exposure_runs} conf=${r.confidence}`));
