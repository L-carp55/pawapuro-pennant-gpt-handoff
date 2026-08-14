// One-shot registry/ledger update for the large wave. Run from repo root.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadTsv(rel) {
  const raw = readFileSync(path.join(ROOT, rel), 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const head = lines[0].split('\t');
  const rows = [];
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const cells = line.split('\t');
    if (cells.length !== head.length) throw new Error(`${rel} bad width ${cells.length} vs ${head.length}: ${cells[0]}`);
    rows.push(Object.fromEntries(head.map((h, i) => [h, cells[i]])));
  }
  return { head, rows, rel };
}
function saveTsv(bundle) {
  const lines = [bundle.head.join('\t')];
  for (const r of bundle.rows) lines.push(bundle.head.map(h => r[h] ?? '').join('\t'));
  writeFileSync(path.join(ROOT, bundle.rel), lines.join('\n') + '\n');
}
function patch(bundle, id, fields) {
  const key = bundle.head[0];
  const row = bundle.rows.find(r => r[key] === id);
  if (!row) throw new Error(`missing ${id} in ${bundle.rel}`);
  Object.assign(row, fields);
}

const tasks = loadTsv('docs/state/speed_task_registry.tsv');
const excl = loadTsv('docs/state/speed_exclusion_reason_ledger.tsv');

const A016 = [
  'src/ratings/durable_traits.mjs',
  'src/cards/durable_estimate.mjs',
  'src/cards/pipeline.mjs',
  'configs/running_norms.json',
  'configs/ratings.json',
  'scripts/sp016_continuous_prior_apply.mjs',
  'outputs/derived/sp016_continuous_prior_apply_20260814.json',
  'outputs/derived/sp016_scale_artifact_check_20260814.json',
  'docs/audits/sp016_continuous_prior_design_20260814.md',
  'docs/audits/sp016_continuous_prior_apply_20260814.md',
].join(';');

patch(tasks, 'SP-016', {
  status: 'PARTIAL',
  next_action_or_blocker: '2026-08-14 candidate適用済み（continuous_prior + applyScale再導出をセット。hard gateはcontrol。尺度検査=双方向・corr(delta,hard)=-0.191・全員同方向でない）。PowerPro個人ラベルはweight/フィットに未使用。★既定を本番確定するかはOpus/owner。EX-009は閉じない。最終2026 practical ratingではない。',
  artifacts: A016,
});

patch(tasks, 'SP-100', {
  status: 'PARTIAL',
  next_action_or_blocker: '2026-08-14 S/N/F比較済み。winner=NOT_DECLARED（H2F n=15・T90 n=0・Nは2026 snapshotのみ）。production既定は凍らせていない。PowerPro一致は勝敗基準にしていない。残り=Opus/ownerの配線判断。SP-079はwinner前にPowerPro経由blendをfinalに使わない。',
  artifacts: [
    'docs/audits/owner_policy_ruling_20260814.md',
    'scripts/sp100_npb_raw_latent_speed.mjs',
    'outputs/derived/sp100_npb_raw_latent_speed.json',
    'docs/audits/sp100_npb_raw_latent_speed_20260814.md',
    'scripts/sp100_wiring_candidates_compare.mjs',
    'outputs/derived/sp100_wiring_candidates_20260814.json',
    'docs/audits/sp100_wiring_candidates_20260814.md',
  ].join(';'),
});

patch(tasks, 'SP-020', {
  status: 'DONE_VALIDATED',
  next_action_or_blocker: '2026-08-14 既存台帳で確定。解決15人・未解決19人。未解決は未解決のまま。日付捏造なし。公式プロフィール追加探索は未実施=NOT_COLLECTEDであり証拠欠如ではない。',
  artifacts: [
    'outputs/derived/speed_2026_100_master_evidence.csv',
    'outputs/derived/npb_speed_measurement_date_resolution_20260809.json',
    'outputs/derived/sp020_date_resolution_status_20260814.json',
    'docs/audits/sp036_039_060_061_062_cleanup_20260814.md',
  ].join(';'),
});

patch(tasks, 'SP-022', {
  status: 'DONE_VALIDATED',
  next_action_or_blocker: '2026-08-14 exact measurementを要求しないpairwise/rangeを既存S/N/Fと不確かさから実装。教師にしない。EX-013是正。',
  artifacts: [
    'outputs/derived/sp022_pairwise_range_20260814.json',
    'docs/audits/sp063_090_098_043_022_072_074_075_20260814.md',
  ].join(';'),
});

patch(tasks, 'SP-033', {
  next_action_or_blocker: '2026-08-14 既存コメント分類+姓candidate（243件review・フルネーム自動採用70・皮肉1）。新規公式動画探索/APIはNOT_COLLECTEDであり「言及が無い」ではない。',
  artifacts: tasks.rows.find(r => r.task_id === 'SP-033').artifacts
    + ';scripts/sp033_034_surname_identity_resolution.mjs;outputs/derived/sp033_034_surname_identity_resolution_20260814.json;outputs/derived/sp033_034_youtube_events_by_player_claim_20260814.jsonl',
});

patch(tasks, 'SP-034', {
  next_action_or_blocker: '2026-08-14 SP-033と同一の既存分類器。Prospi公式コメントの新規取得はNOT_COLLECTED。空検索を「コメントが無い」へ変換していない。',
});

patch(tasks, 'SP-035', {
  next_action_or_blocker: '2026-08-14 既存公式Xを整理（投稿3・走力批評は現行100人に無し）。認証APIページングとPowerPro公式クロールはNOT_COLLECTED。新規APIアプリは作っていない。',
  artifacts: tasks.rows.find(r => r.task_id === 'SP-035').artifacts
    + ';scripts/sp035_x_existing_organize.mjs;outputs/derived/sp035_x_existing_organize_20260814.json',
});

patch(tasks, 'SP-036', {
  status: 'DONE_VALIDATED',
  next_action_or_blocker: '2026-08-14 既存データ範囲のgeneric掃き出し完了。台帳外7件・0情報化0。弱い方向ラベルとして保持。EX-011是正。',
  artifacts: [
    'docs/tasks/CODEX_SPEED_COMMUNITY_RATING_RESCUE_20260813.md',
    'outputs/derived/speed_community_rating_raw_20260813_run2.jsonl',
    'outputs/derived/sp032_grok_x_150_reclassification_20260813.jsonl',
    'scripts/sp036_generic_label_sweep.mjs',
    'outputs/derived/sp036_generic_label_sweep_20260814.json',
    'docs/audits/sp036_039_060_061_062_cleanup_20260814.md',
  ].join(';'),
});

patch(tasks, 'SP-039', {
  status: 'DONE_VALIDATED',
  next_action_or_blocker: '2026-08-14 既存video 17人を再利用。広い探索は再開せず。17/17 VIDEO_INCONCLUSIVE。汚染フラグ保持。数値T90教師にしない。EX-012是正。',
  artifacts: [
    'outputs/derived/speed_2026_video_tiebreak_results.json',
    'docs/audits/speed_2026_final_video_tiebreak.md',
    'scripts/sp039_existing_video_lane.mjs',
    'outputs/derived/sp039_existing_video_lane_20260814.json',
    'docs/audits/sp036_039_060_061_062_cleanup_20260814.md',
  ].join(';'),
});

patch(tasks, 'SP-042', {
  status: 'DONE_VALIDATED',
  next_action_or_blocker: '2026-08-14 実装済みdetectorを完了判定。疑いの入口のみ。自動補正しない。corr(gap,pp)=-0.3875 / corr(gap,latent)=0.2533。',
});

patch(tasks, 'SP-043', {
  status: 'DONE_VALIDATED',
  next_action_or_blocker: '2026-08-14 秋山・松山の証拠ケースを既存データで作成。残るowner判断=秋山2025出場減の中身（故障/起用/衰えは台帳に無い）と松山を2026-100に残すか。',
  artifacts: [
    'outputs/derived/sp043_veteran_case_studies_20260814.json',
    'docs/audits/sp063_090_098_043_022_072_074_075_20260814.md',
  ].join(';'),
});

patch(tasks, 'SP-044', {
  next_action_or_blocker: 'pennant.dbに生年月日列なし。MIT 2025 rosterにもbirthdateなし。NPB公式ページは収集方針外。BLOCKED_MISSING_DATA。欠測であり負の所見ではない。',
  artifacts: 'outputs/derived/sp044_age_birth_search_20260814.json',
});

patch(tasks, 'SP-045', {
  next_action_or_blocker: '構造化故障台帳なし。PA減・ロースター除外を故障へ変換しない。SNSのケガ言及は日付/部位/離脱/復帰が無い。BLOCKED_MISSING_DATA。欠測であり負の所見ではない。',
  artifacts: 'outputs/derived/sp045_injury_search_20260814.json',
});

patch(tasks, 'SP-060', {
  status: 'DONE_VALIDATED',
  next_action_or_blocker: '2026-08-14 既存scouting走力は1件（鈴木誠也 owner）。100人の大半は行なし。教師にしない。EX-016棚卸し完了。',
  artifacts: [
    'configs/scouting.json',
    'outputs/derived/sp060_scouting_inventory_20260814.json',
    'docs/audits/sp036_039_060_061_062_cleanup_20260814.md',
  ].join(';'),
});

patch(tasks, 'SP-061', {
  status: 'DONE_VALIDATED',
  next_action_or_blocker: '2026-08-14 既存Grok-Xに代走言及5件。監督判断・役割・故障が混ざる。弱い文脈であり教師ではない。EX-017。',
  artifacts: [
    'outputs/derived/sp061_pinch_runner_weak_context_20260814.json',
    'docs/audits/sp036_039_060_061_062_cleanup_20260814.md',
  ].join(';'),
});

patch(tasks, 'SP-062', {
  status: 'DONE_NEGATIVE_FINDING',
  next_action_or_blocker: '2026-08-14 既存ソースはルート・反応・守備位置が混ざる。直線追走だけを分離できるソースはリポジトリに無い。判断に使えないので閉じる。EX-018。',
  artifacts: [
    'outputs/derived/sp062_defensive_chase_close_20260814.json',
    'docs/audits/sp036_039_060_061_062_cleanup_20260814.md',
  ].join(';'),
});

patch(tasks, 'SP-063', {
  status: 'DONE_VALIDATED',
  next_action_or_blocker: '2026-08-14 2026-08-05親タスクの走力子項目を後続SPへ対応づけ。親はsuperseded。肩力以降は走力スコープ外。',
  artifacts: [
    '_codex_task_20260805_all_missing_data.md',
    '_codex_result_20260805_missing_data.md',
    'outputs/derived/sp063_all_missing_data_child_map_20260814.json',
    'docs/audits/sp063_090_098_043_022_072_074_075_20260814.md',
  ].join(';'),
});

patch(tasks, 'SP-072', {
  status: 'DONE_VALIDATED',
  next_action_or_blocker: '2026-08-14 走力applyScaleはロースター全体で導出し100人にも同じ式。100人専用scaleは無い。',
  artifacts: [
    'outputs/derived/sp072_100_vs_roster_scale_20260814.json',
    'outputs/derived/sp016_scale_artifact_check_20260814.json',
    'docs/audits/sp063_090_098_043_022_072_074_075_20260814.md',
  ].join(';'),
});

patch(tasks, 'SP-074', {
  status: 'DONE_VALIDATED',
  next_action_or_blocker: '2026-08-14 再診断。旧+14.4同方向は尺度混合。現S vs Nはn=93・平均差+0.021・全員同方向でない。年が違う残差を同年対立にしない。',
  artifacts: [
    'docs/audits/speed_material_conflict_diagnosis_20260813.md',
    'outputs/derived/sp074_conflict_rediagnosis_20260814.json',
    'docs/audits/sp063_090_098_043_022_072_074_075_20260814.md',
  ].join(';'),
});

patch(tasks, 'SP-075', {
  status: 'PARTIAL',
  next_action_or_blocker: '2026-08-14 既存成果でstale/conflict再診断を出力（NONE77/EXT11/INT5/BOTH2）。Prospi不使用。owner queue未生成。SP-033/034/035の新規収集がNOT_COLLECTEDのため閉じない。',
  artifacts: 'outputs/derived/sp075_stale_conflict_rediagnosis_20260814.json;docs/audits/sp063_090_098_043_022_072_074_075_20260814.md',
});

patch(tasks, 'SP-090', {
  status: 'DONE_VALIDATED',
  next_action_or_blocker: '2026-08-14 このwaveの判断を成果物へ書いた。チャットのみの知識は残さない。',
  artifacts: 'outputs/derived/sp090_chat_only_scan_20260814.json;docs/state/speed_task_registry.tsv',
});

patch(tasks, 'SP-098', {
  status: 'DONE_VALIDATED',
  next_action_or_blocker: '2026-08-14 再確認。名原は2025一軍打撃が無く値を作らない。サンタナ=53755153。塩見2025はAB=0が実データで走力85.3・肩力69.1・schema非縮退。残る名原の一軍台帳欠落はidentityではなくcoverage。',
  artifacts: [
    'scripts/sp098_identity_coverage_repair.mjs',
    'outputs/derived/sp098_identity_coverage_repair_20260813.json',
    'docs/audits/sp098_identity_coverage_repair_20260813.md',
    'src/cards/pipeline.mjs',
    'src/ratings/context_tier.mjs',
    'outputs/derived/sp098_identity_reverify_20260814.json',
    'docs/audits/sp063_090_098_043_022_072_074_075_20260814.md',
  ].join(';'),
});

// Exclusions whose corrective tasks are now closed.
patch(excl, 'EX-004', {
  verdict: 'VALID_DOWNGRADE_NOT_ZERO',
  owner_review_block: '0',
  gate_block: '0',
  corrected_policy: '2026-08-14 是正完了。model層のproxyはSP-019（三塁打分離はVALID_EXCLUSION、GB率はNOT_IDENTIFIABLE_PROVISIONAL）。scoutingは1件をlow/medium priorとして棚卸し・教師にしない(SP-060)。代走は弱い文脈5件・教師にしない(SP-061)。守備直線追走は分離不能で判断に使えない(SP-062)。',
  evidence: 'docs/audits/sp019_construct_validity_reaudit_v2_20260813.md;outputs/derived/sp060_scouting_inventory_20260814.json;outputs/derived/sp061_pinch_runner_weak_context_20260814.json;outputs/derived/sp062_defensive_chase_close_20260814.json;docs/audits/sp036_039_060_061_062_cleanup_20260814.md',
});
patch(excl, 'EX-011', {
  verdict: 'VALID_DOWNGRADE_NOT_ZERO',
  owner_review_block: '0',
  gate_block: '0',
  corrected_policy: '2026-08-14 是正完了。150件中WEAKは0情報化せず保持。台帳外generic 7件も保持・zeroed=0。強い証拠と区別し独立originとして数える。数値教師にはしない。',
  evidence: 'outputs/derived/sp032_grok_x_150_reclassification_20260813.jsonl;outputs/derived/sp036_generic_label_sweep_20260814.json;docs/audits/sp036_039_060_061_062_cleanup_20260814.md',
});
patch(excl, 'EX-012', {
  verdict: 'VALID_DOWNGRADE_NOT_ZERO',
  owner_review_block: '0',
  gate_block: '0',
  corrected_policy: '2026-08-14 是正完了。pure T90としては不採用（17/17 INCONCLUSIVE）を維持。既存candidateをcontext/contamination付きのlow-weightレーンとして保持。広い探索は再開しない。',
  evidence: 'outputs/derived/speed_2026_video_tiebreak_results.json;outputs/derived/sp039_existing_video_lane_20260814.json;docs/audits/sp036_039_060_061_062_cleanup_20260814.md',
});
patch(excl, 'EX-013', {
  verdict: 'VALID_DOWNGRADE_NOT_ZERO',
  owner_review_block: '0',
  gate_block: '0',
  corrected_policy: '2026-08-14 是正完了。exact measurementを要求せず、S/N/Fと不確かさからprobabilistic/range pairwiseを許可。教師にしない。',
  evidence: 'outputs/derived/sp022_pairwise_range_20260814.json;docs/audits/sp063_090_098_043_022_072_074_075_20260814.md',
});
patch(excl, 'EX-016', {
  verdict: 'VALID_DOWNGRADE_NOT_ZERO',
  owner_review_block: '0',
  gate_block: '0',
  corrected_policy: '2026-08-14 棚卸し完了。走力scoutingは1件（鈴木誠也）。identity/source/date/basisを保存。教師にしない。欠けは欠けとして記録。',
  evidence: 'configs/scouting.json;outputs/derived/sp060_scouting_inventory_20260814.json;docs/audits/sp036_039_060_061_062_cleanup_20260814.md',
});
patch(excl, 'EX-017', {
  verdict: 'VALID_DOWNGRADE_NOT_ZERO',
  owner_review_block: '0',
  gate_block: '0',
  corrected_policy: '2026-08-14 評価完了。代走言及5件は監督判断・役割・故障が混ざる。弱い文脈として保持し教師にしない。',
  evidence: 'outputs/derived/sp061_pinch_runner_weak_context_20260814.json;docs/audits/sp036_039_060_061_062_cleanup_20260814.md',
});
patch(excl, 'EX-018', {
  verdict: 'VALID_EXCLUSION',
  owner_review_block: '0',
  gate_block: '0',
  corrected_policy: '2026-08-14 閉じる。既存ソースはroute/reaction/positioningが混ざり直線追走を分離できない。判断に使えない。',
  evidence: 'outputs/derived/sp062_defensive_chase_close_20260814.json;docs/audits/sp036_039_060_061_062_cleanup_20260814.md',
});

saveTsv(tasks);
saveTsv(excl);
console.log('registry and exclusion ledger updated');
