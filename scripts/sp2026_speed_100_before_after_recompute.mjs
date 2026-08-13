// 走力2026 100人 — SP-015/016/018/019/007/017是正の before/after 再計算。
//
// オーナー明示要求: 「旧production・修正版で100人を同条件再計算し、before/after・変更理由・
// 配線確認を保存」。既存productionを直接上書きして比較不能にしない（旧設定を明示的に再現する）。
//
// 何が「before/after」の対象か:
//   SP-015（componentWeights: 翌年再現性→同時点信頼性）とSP-016（currentYearFirst既定反転）は
//   config/opts経由でON/OFF切替可能なため、直接比較する。
//   SP-018（advanceの固定閾値→連続shrinkage）はコード自体を修理したバグ修正であり、
//   旧ハードカット挙動を再現するconfig切替は用意していない（そもそも切替可能にすべき
//   "設計判断"ではなく閾値バグの修理のため）。
//   SP-019は「現状維持を同時点根拠で追認」が結論のため、コード上の変更なし＝差分ゼロが期待値。
//   SP-007（H2F低信頼度レーン）とSP-017（物理測定のrange復元）は、走力の合成z-scoreへ
//   配線していない別レーン・非破壊overlayのため、走力コア値には影響しない設計。
//
// 使い方: node scripts/sp2026_speed_100_before_after_recompute.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = J('ratings.json'), rv = J('run_values.json').values;
const runNorm = J('running_norms.json'), fldNorm = J('fielding_norms.json');

// legacy runNorm: componentWeightsを是正前(翌年再現性)へ差し替えた複製
const legacyRunNorm = JSON.parse(JSON.stringify(runNorm));
legacyRunNorm.componentWeights = runNorm._componentWeightsLegacyNextYearRepeatability;

const evidence = JSON.parse(readFileSync(
  path.join(ROOT, 'data', 'manual', 'npb_speed_physical_evidence_full_20260809.json'), 'utf8'));
const players = evidence.players.map(p => p.player);

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);

const SEASON = '2025';
const rows = [];
for (const name of players) {
  let legacy, corrected;
  try {
    legacy = appraiseCard(ctx, {
      name, mode: SEASON, statPrimarySpeed: true, cfg, rv,
      runNorm: legacyRunNorm, fldNorm,
      currentYearFirst: false,   // SP-016是正前の既定
    });
  } catch (e) { legacy = { error: `throw: ${e.message}` }; }
  try {
    corrected = appraiseCard(ctx, {
      name, mode: SEASON, statPrimarySpeed: true, cfg, rv,
      runNorm, fldNorm,
      // currentYearFirst/sufficientWeightはpipeline.mjsのproduction既定(true/50)をそのまま使う
    });
  } catch (e) { corrected = { error: `throw: ${e.message}` }; }

  if (legacy.error || corrected.error) {
    rows.push({ player: name, error: legacy.error ?? corrected.error });
    continue;
  }
  const L = legacy.card.abilities.基礎能力.走力;
  const C = corrected.card.abilities.基礎能力.走力;
  const diff = Math.round((C.value - L.value) * 100) / 100;
  rows.push({
    player: name,
    legacy_value: L.value, legacy_rank: L.rank,
    corrected_value: C.value, corrected_rank: C.rank,
    diff,
    corrected_poolReason: corrected.card.speedDetail?.poolReason ?? null,
    corrected_years: corrected.card.speedDetail?.years ?? null,
    legacy_poolReason: legacy.card.speedDetail?.poolReason ?? null,
    legacy_years: legacy.card.speedDetail?.years ?? null,
  });
}

const ok = rows.filter(r => !r.error);
const errors = rows.filter(r => r.error);
const moved = ok.filter(r => Math.abs(r.diff) >= 0.05);
const moved5 = ok.filter(r => Math.abs(r.diff) >= 5);
const rankChanged = ok.filter(r => r.legacy_rank !== r.corrected_rank);
const avgAbsDiff = moved.length ? moved.reduce((s, r) => s + Math.abs(r.diff), 0) / moved.length : 0;
const maxDiff = ok.reduce((m, r) => Math.max(m, Math.abs(r.diff)), 0);

const summary = {
  generated_at: '2026-08-13',
  scope: '走力2026 100人（data/manual/npb_speed_physical_evidence_full_20260809.json）、mode=2025、statPrimarySpeed:true(NPB+自動blendを除きstat modelのみ比較)',
  legacy_settings: 'componentWeights=_componentWeightsLegacyNextYearRepeatability（翌年再現性由来、is-05是正前）, currentYearFirst=false（is-016是正前=自動多年pool）',
  corrected_settings: 'production既定（componentWeights=same_time_reliability、currentYearFirst=true, sufficientWeight=50）。SP-018のadvance shrinkageは常時有効（旧ハードカット挙動は再現不可＝閾値バグの修理のため）',
  out_of_scope_for_this_diff: 'SP-019(現状維持を追認、差分ゼロが期待値)/SP-007(H2F低信頼度レーン、走力コアz-scoreへ未配線)/SP-017(物理測定range復元、非破壊overlayで走力コアz-scoreへ未配線)は設計上この100人走力値へ影響しない',
  n_total: rows.length, n_ok: ok.length, n_errors: errors.length,
  n_moved_ge_0_05: moved.length, n_moved_ge_5: moved5.length, n_rank_changed: rankChanged.length,
  avg_abs_diff_among_moved: Math.round(avgAbsDiff * 100) / 100,
  max_abs_diff: Math.round(maxDiff * 100) / 100,
  errors,
};

const outJson = { summary, rows: ok.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)) };
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'speed_2026_100_before_after_sp015_016.json'), JSON.stringify(outJson, null, 2));

const csvHeader = 'player,legacy_value,legacy_rank,corrected_value,corrected_rank,diff,legacy_poolReason,legacy_years,corrected_poolReason,corrected_years';
const csvRows = outJson.rows.map(r => [r.player, r.legacy_value, r.legacy_rank, r.corrected_value, r.corrected_rank, r.diff,
  r.legacy_poolReason, r.legacy_years, r.corrected_poolReason, r.corrected_years].join(','));
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'speed_2026_100_before_after_sp015_016.csv'), [csvHeader, ...csvRows].join('\n'));

console.log(JSON.stringify(summary, null, 2));
