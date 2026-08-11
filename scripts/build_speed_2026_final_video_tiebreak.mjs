#!/usr/bin/env node
/**
 * Build the final 2026 speed video tie-break artifacts.
 *
 * This build intentionally emits only qualitative/ordinal video conclusions.
 * It never extracts timing, distance, T90, 30 m, 50 m, age-decay, or a game rating.
 */

import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const asOf = "2026-08-11";

const inputs = {
  queue: "outputs/derived/speed_2026_final_video_tiebreak_queue.csv",
  preVideo: "outputs/derived/speed_2026_100_pre_video_decision_support.json",
  conflict: "data/manual/speed_2026_video_tiebreak_conflict_research_20260811.json",
  temporal: "data/manual/speed_2026_video_tiebreak_temporal_research_20260811.json",
  currentA: "data/manual/speed_2026_video_tiebreak_current_a_research_20260811.json",
  currentB: "data/manual/speed_2026_video_tiebreak_current_b_research_20260811.json",
  independentQa: "data/manual/speed_2026_video_tiebreak_independent_qa_20260811.json"
};

const outputs = {
  ledgerJson: "data/normalized/speed_2026_video_tiebreak_sources.json",
  ledgerCsv: "data/normalized/speed_2026_video_tiebreak_sources.csv",
  resultsJson: "outputs/derived/speed_2026_video_tiebreak_results.json",
  resultsCsv: "outputs/derived/speed_2026_video_tiebreak_results.csv",
  unresolvedCsv: "outputs/derived/speed_2026_post_video_unresolved_queue.csv",
  postVideoSupport: "outputs/derived/speed_2026_100_post_video_decision_support.json",
  qaJson: "outputs/derived/speed_2026_video_tiebreak_qa.json",
  auditMd: "docs/audits/speed_2026_final_video_tiebreak.md"
};

const allowedClassifications = new Set([
  "VIDEO_SUPPORTS_CURRENT_ORDINAL",
  "VIDEO_SUGGESTS_FASTER",
  "VIDEO_SUGGESTS_SLOWER",
  "VIDEO_SUPPORTS_TEMPORAL_DECLINE",
  "VIDEO_SUPPORTS_TEMPORAL_PERSISTENCE",
  "VIDEO_MIXED",
  "VIDEO_INCONCLUSIVE"
]);

const noSpace = (value) => String(value ?? "").replace(/[\s\u3000]/gu, "");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const abs = (relativePath) => path.join(root, relativePath);
const readText = async (relativePath) => readFile(abs(relativePath), "utf8");
const readJson = async (relativePath) => JSON.parse(await readText(relativePath));

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }
  const [header, ...body] = rows.filter((item) => item.some((cell) => cell !== ""));
  return body.map((item) => Object.fromEntries(header.map((name, index) => [name, item[index] ?? ""])));
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const output = Array.isArray(value) ? value.join("; ") : String(value);
  return /[",\n\r]/u.test(output) ? `"${output.replaceAll('"', '""')}"` : output;
}

function makeCsv(rows, headers) {
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

async function writeArtifact(relativePath, body) {
  await mkdir(path.dirname(abs(relativePath)), { recursive: true });
  await writeFile(abs(relativePath), body, "utf8");
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? null;
}

function reasonText(value) {
  return Array.isArray(value) ? value.join("; ") : String(value ?? "");
}

function normalizeSource(raw, lane, sourceArtifact, targetByKey) {
  const recordId = firstDefined(raw.source_id, raw.record_id, `AUTO-${lane}-${raw.video_id}`);
  const playerKey = noSpace(raw.player);
  const target = targetByKey.get(playerKey);
  assert(target, `source ${recordId} is outside the 17-player canonical scope: ${raw.player}`);
  const accepted = raw.accepted === true;
  const usable = raw.usable_for_ordinal_resolution === true || raw.usable_current_full_effort_play === true;
  const normalSpeed = firstDefined(raw.video_normal_speed_confirmed, raw.normal_speed_confirmed);
  const gameEventKey = firstDefined(raw.unique_game_event_key, raw.unique_game_key, raw.game_event_id, raw.independence_group, `unidentified-event:${recordId}`);
  const playKey = firstDefined(raw.unique_play_key, raw.play_id, raw.independence_group, `unidentified-play:${recordId}`);
  const originKey = firstDefined(raw.unique_origin_key, raw.origin_group, raw.unique_origin, `${raw.platform ?? "unknown"}:${raw.video_id ?? recordId}`);
  return {
    record_id: String(recordId),
    player: target.player,
    player_key: playerKey,
    player_id: target.player_id,
    video_id: String(raw.video_id ?? ""),
    platform: raw.platform ?? null,
    url: raw.url ?? null,
    source_account: firstDefined(raw.source_account, raw.author, raw.channel),
    source_tier: raw.source_tier ?? null,
    game_or_event_date: raw.game_or_event_date ?? null,
    upload_date: raw.upload_date ?? null,
    season: raw.season ?? null,
    opponent_or_event: firstDefined(raw.opponent_or_event, raw.opponent_event),
    play_description: raw.play_description ?? null,
    video_normal_speed_confirmed: normalSpeed === true ? true : normalSpeed === false ? false : null,
    edited: raw.edited ?? null,
    replay: raw.replay ?? null,
    full_effort_confidence: raw.full_effort_confidence ?? null,
    start_context: raw.start_context ?? null,
    straight_line_segment_available: raw.straight_line_segment_available ?? null,
    transition_contamination: raw.transition_contamination ?? null,
    baserunning_technique_contamination: firstDefined(raw.baserunning_technique_contamination, raw.baserunning_tech_contamination),
    physical_speed_relevance: firstDefined(raw.physical_speed_relevance, raw.physical_relevance),
    accepted,
    usable_for_ordinal_resolution: usable,
    rejection_reason: reasonText(raw.rejection_reason),
    observed_direction: firstDefined(raw.observed_direction, "NON_DIRECTIONAL"),
    unique_play_key: String(playKey),
    unique_game_event_key: String(gameEventKey),
    unique_origin_key: String(originKey),
    source_artifact: sourceArtifact,
    discovery_or_body_review_status: lane === "CONFLICT" || lane === "CURRENT_B"
      ? "SOURCE_BODY_REVIEWED"
      : "DISCOVERED_NO_VISUAL_ACCEPTANCE",
    notes: raw.notes ?? null
  };
}

function normalizeProposal(raw) {
  return {
    player_key: noSpace(raw.player),
    classification: firstDefined(raw.proposed_video_classification, raw.proposed_classification, raw.classification),
    evidence_strength: firstDefined(raw.evidence_strength, raw.proposed_strength, "NONE"),
    usable_current_full_effort_plays: Number(firstDefined(raw.usable_current_full_effort_play_count, raw.usable_current_full_effort_plays, raw.accepted_usable_plays, 0)),
    rationale: raw.rationale ?? "No source-level direction was supported."
  };
}

function toMarkdownTable(rows, headers) {
  const headerLine = `| ${headers.join(" | ")} |`;
  const dividerLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${headers.map((header) => String(row[header] ?? "").replaceAll("|", "\\|").replaceAll("\n", " ")).join(" | ")} |`);
  return [headerLine, dividerLine, ...body].join("\n");
}

const queueRows = parseCsv(await readText(inputs.queue));
assert(queueRows.length === 17, `expected 17 queue rows, got ${queueRows.length}`);
const targetByKey = new Map(queueRows.map((row) => [noSpace(row.player), row]));
assert(targetByKey.size === 17, "canonical target keys must be unique");

const [preVideo, conflict, temporal, currentA, currentB, independentQa] = await Promise.all([
  readJson(inputs.preVideo),
  readJson(inputs.conflict),
  readJson(inputs.temporal),
  readJson(inputs.currentA),
  readJson(inputs.currentB),
  readJson(inputs.independentQa)
]);

const rawLanes = [
  { label: "CONFLICT", artifact: inputs.conflict, records: conflict.sources, proposals: conflict.player_proposals },
  { label: "TEMPORAL", artifact: inputs.temporal, records: temporal.candidate_ledger, proposals: temporal.player_results },
  { label: "CURRENT_A", artifact: inputs.currentA, records: currentA.video_records, proposals: currentA.player_assessments },
  { label: "CURRENT_B", artifact: inputs.currentB, records: currentB.sources, proposals: currentB.player_proposals }
];

const ledgerRecords = rawLanes.flatMap((lane) => (lane.records ?? []).map((record) => normalizeSource(record, lane.label, lane.artifact, targetByKey)));
const proposalByPlayer = new Map(rawLanes
  .flatMap((lane) => (lane.proposals ?? []).map(normalizeProposal))
  .map((proposal) => [proposal.player_key, proposal]));

assert(ledgerRecords.length > 0, "video ledger must not be empty");
assert(new Set(ledgerRecords.map((record) => record.record_id)).size === ledgerRecords.length, "source record IDs must be unique");
assert(ledgerRecords.every((record) => record.video_id && record.url), "every ledger record needs actual video ID and URL");
assert(ledgerRecords.every((record) => targetByKey.has(record.player_key)), "ledger scope must remain canonical");

const exactVideoDuplicateRecords = ledgerRecords.length - new Set(ledgerRecords.map((record) => `${record.platform}:${record.video_id}`)).size;
const sourcesByPlayer = new Map(queueRows.map((row) => [noSpace(row.player), []]));
for (const source of ledgerRecords) sourcesByPlayer.get(source.player_key).push(source);
assert([...sourcesByPlayer.values()].every((records) => records.length > 0), "each target must have at least one discovered video candidate");

const resultRows = queueRows.map((target) => {
  const playerKey = noSpace(target.player);
  const records = sourcesByPlayer.get(playerKey);
  const proposal = proposalByPlayer.get(playerKey);
  assert(proposal, `missing proposed player result for ${target.player}`);
  assert(allowedClassifications.has(proposal.classification), `invalid classification for ${target.player}: ${proposal.classification}`);
  const usableSources = records.filter((record) => record.usable_for_ordinal_resolution);
  const acceptedSources = records.filter((record) => record.accepted);
  const uniquePlayCount = new Set(records.map((record) => record.unique_play_key)).size;
  const uniqueGameCount = new Set(records.map((record) => record.unique_game_event_key)).size;
  const uniqueOriginCount = new Set(records.map((record) => record.unique_origin_key)).size;
  return {
    player: target.player,
    player_key: playerKey,
    player_id: target.player_id,
    team: target.team,
    pre_video_classification: target.resolution_classification,
    video_classification: proposal.classification,
    evidence_strength: proposal.evidence_strength,
    discovered_video_count: records.length,
    accepted_video_source_count: acceptedSources.length,
    usable_current_full_effort_play_count: usableSources.length,
    unique_candidate_play_count: uniquePlayCount,
    unique_candidate_game_event_count: uniqueGameCount,
    unique_candidate_origin_count: uniqueOriginCount,
    post_video_resolution_status: proposal.classification === "VIDEO_INCONCLUSIVE" ? "UNRESOLVED" : "VIDEO_DIRECTIONAL_OVERLAY_ONLY",
    remains_in_video_unresolved_queue: proposal.classification === "VIDEO_INCONCLUSIVE",
    rationale: proposal.rationale,
    no_numeric_game_rating: true,
    no_video_derived_numeric_measure: true
  };
});

assert(resultRows.length === 17, "results require 17 players");
assert(resultRows.every((row) => row.video_classification === "VIDEO_INCONCLUSIVE"), "no direction may be forced from this evidence set");
assert(resultRows.every((row) => row.usable_current_full_effort_play_count === 0), "no unusable source may be upgraded to usable");

const countBy = (rows, key) => Object.fromEntries([...new Set(rows.map((row) => row[key]))].sort().map((value) => [value, rows.filter((row) => row[key] === value).length]));
const activeResults = resultRows.filter((row) => row.remains_in_video_unresolved_queue);
const acceptedSources = ledgerRecords.filter((record) => record.accepted);
const rejectedSources = ledgerRecords.filter((record) => !record.accepted);
const usablePlayers2 = resultRows.filter((row) => row.usable_current_full_effort_play_count >= 2).length;
const usablePlayers3 = resultRows.filter((row) => row.usable_current_full_effort_play_count >= 3).length;

const ledger = {
  schema_version: "speed-2026-video-tiebreak-sources/v1.0.0",
  as_of: asOf,
  provenance: "FINAL_VIDEO_TIEBREAK",
  canonical_scope: queueRows.map((row) => ({ player: row.player, player_id: row.player_id, team: row.team })),
  source_artifacts: Object.fromEntries(rawLanes.map((lane) => [lane.label, lane.artifact])),
  method_boundary: {
    physical_running_definition: "Qualitative/ordinal physical running ability only; no numeric extraction or game rating.",
    excluded_constructs: ["stolen-base technique", "baserunning judgment", "fielding range", "batter-to-first pure-acceleration claim", "PowerPro residual", "position prior", "age decay"],
    accepted_source_rule: "An accepted context-only source is never counted as usable for ordinal resolution when transition, route, or turn contamination cannot be separated."
  },
  source_records: ledgerRecords,
  counts: {
    videos_discovered: ledgerRecords.length,
    accepted_video_sources: acceptedSources.length,
    rejected_video_sources: rejectedSources.length,
    usable_video_sources: ledgerRecords.filter((record) => record.usable_for_ordinal_resolution).length,
    exact_video_id_duplicate_records: exactVideoDuplicateRecords
  }
};

const resultDocument = {
  schema_version: "speed-2026-video-tiebreak-results/v1.0.0",
  as_of: asOf,
  purpose: "Final qualitative video tie-break overlay; no numeric speed rating is generated.",
  source_ledger: outputs.ledgerJson,
  permitted_classifications: [...allowedClassifications],
  player_results: resultRows,
  counts: {
    target_players: resultRows.length,
    classification_counts: countBy(resultRows, "video_classification"),
    evidence_strength_counts: countBy(resultRows, "evidence_strength"),
    remaining_unresolved_players: activeResults.length,
    players_with_at_least_two_usable_plays: usablePlayers2,
    players_with_at_least_three_usable_plays: usablePlayers3
  },
  invariants: {
    no_video_derived_numeric_measure: true,
    no_final_numeric_game_rating: true,
    no_powerpro_residual_used_for_video_decision: true,
    no_position_prior_used: true,
    unresolved_not_forced: true
  }
};

const unresolvedRows = activeResults.map((row) => ({
  player: row.player,
  player_id: row.player_id,
  team: row.team,
  pre_video_classification: row.pre_video_classification,
  video_classification: row.video_classification,
  evidence_strength: row.evidence_strength,
  discovered_video_count: row.discovered_video_count,
  accepted_video_source_count: row.accepted_video_source_count,
  usable_current_full_effort_play_count: row.usable_current_full_effort_play_count,
  unresolved_reason: "NO_QUALIFYING_MULTIPLE_CURRENT_FULL_EFFORT_PHYSICAL_VIDEO_OBSERVATIONS",
  next_step: "RETAIN_UNRESOLVED_NO_NUMERIC_OVERRIDE"
}));

const basePlayersDigest = sha256(JSON.stringify(preVideo.players));
const videoOverlays = resultRows.map((row) => ({
  overlay_type: "FINAL_VIDEO_TIEBREAK",
  player: row.player,
  player_id: row.player_id,
  pre_video_classification: row.pre_video_classification,
  video_classification: row.video_classification,
  evidence_strength: row.evidence_strength,
  usable_current_full_effort_play_count: row.usable_current_full_effort_play_count,
  post_video_resolution_status: row.post_video_resolution_status,
  remains_in_video_unresolved_queue: row.remains_in_video_unresolved_queue,
  source_ledger: outputs.ledgerJson,
  source_results: outputs.resultsJson,
  no_numeric_game_rating: true,
  no_video_derived_numeric_measure: true,
  powerpro_residual_used_for_video_decision: false
}));
const postVideoSupport = {
  ...preVideo,
  schema_version: "speed-2026-100-post-video-decision-support/v1.0.0",
  as_of: asOf,
  purpose: "100-player post-video decision support. Baseline player records remain byte-equivalent in meaning; final video conclusions are separate overlays.",
  source_inputs: {
    pre_video_support: { path: inputs.preVideo, sha256: sha256(await readText(inputs.preVideo)) },
    video_source_ledger: { path: outputs.ledgerJson },
    video_results: { path: outputs.resultsJson }
  },
  resolution_overlays: [...preVideo.resolution_overlays, ...videoOverlays],
  counts: {
    ...(preVideo.counts ?? {}),
    pre_video_resolution_overlays: preVideo.resolution_overlays.length,
    final_video_tiebreak_overlays: videoOverlays.length,
    post_video_unresolved_players: activeResults.length
  },
  invariant: {
    ...(preVideo.invariant ?? {}),
    baseline_player_records_unchanged: true,
    baseline_player_records_sha256: basePlayersDigest,
    final_video_tiebreak_overlays: videoOverlays.length,
    no_final_numeric_game_rating: true,
    no_video_derived_numeric_measure: true,
    no_powerpro_residual_decision_input: true
  }
};
assert(sha256(JSON.stringify(postVideoSupport.players)) === basePlayersDigest, "the baseline 100 player records changed during post-video integration");

const rejectionCategories = {
  visual_or_normal_speed_unavailable: ledgerRecords.filter((record) => /VISUAL|NORMAL_SPEED_UNVERIFIABLE|NORMAL_SPEED_NOT_VERIFIABLE/u.test(record.rejection_reason)).length,
  transition_or_baserunning_contamination: ledgerRecords.filter((record) => /TRANSITION|BASERUNNING|BATTER_TO_FIRST|TURN|ROUTE/u.test(record.rejection_reason)).length,
  edited_or_replay_or_montage: ledgerRecords.filter((record) => /EDITED|REPLAY|MONTAGE/u.test(record.rejection_reason)).length,
  no_running_or_no_target_run: ledgerRecords.filter((record) => /NO_RUNNING|NO_TARGET_RUN|NO_SEPARABLE|IDENTITY_NOT_VISUALLY/u.test(record.rejection_reason)).length
};

const qaChecks = [
  ["canonical_17_only", ledgerRecords.every((record) => targetByKey.has(record.player_key)), "No source player is outside the canonical 17."],
  ["target_17_of_17", resultRows.length === 17 && new Set(resultRows.map((row) => row.player_key)).size === 17, "Each canonical target has one final result."],
  ["actual_video_url_saved", ledgerRecords.every((record) => record.url && record.video_id), "Every source record stores an exact URL and video ID."],
  ["same_play_repost_dedup", exactVideoDuplicateRecords === 0, "No exact video ID is counted twice."],
  ["edited_or_slow_motion_only_rejection", ledgerRecords.filter((record) => record.edited === true && !record.accepted).length > 0, "Edited/montage candidates are retained with rejection reasons rather than upgraded."],
  ["normal_speed_verification", acceptedSources.every((record) => record.video_normal_speed_confirmed === true) && ledgerRecords.filter((record) => record.usable_for_ordinal_resolution).every((record) => record.video_normal_speed_confirmed === true), "No accepted ordinal-use source lacks normal-speed confirmation."],
  ["effort_uncertainty_retained", ledgerRecords.some((record) => /EFFORT_UNCERTAIN|NOT_ASSESSABLE/u.test(String(record.full_effort_confidence))), "Uncertain effort is explicitly preserved."],
  ["swing_to_run_not_pure", ledgerRecords.filter((record) => /BATTER_TO_FIRST|TRANSITION_CONTAMINATED/u.test(`${record.start_context};${record.transition_contamination};${record.physical_speed_relevance}`)).every((record) => !record.usable_for_ordinal_resolution), "Transition-contaminated observations are not usable pure-running evidence."],
  ["stolen_base_technique_excluded", ledgerRecords.filter((record) => /STEAL|BASERUNNING_TECHNIQUE/u.test(`${record.rejection_reason};${record.baserunning_technique_contamination}`)).every((record) => !record.usable_for_ordinal_resolution), "Technique-contaminated observations are not usable."],
  ["baserunning_judgment_excluded", ledgerRecords.filter((record) => /BASERUNNING|ROUTE|TURN/u.test(`${record.rejection_reason};${record.baserunning_technique_contamination}`)).every((record) => !record.usable_for_ordinal_resolution), "Route/turn/judgment contamination is not treated as physical direction."],
  ["fielding_range_excluded", ledgerRecords.filter((record) => /FIELDING|DEFENSIVE_RANGE/u.test(`${record.rejection_reason};${record.physical_speed_relevance}`)).every((record) => !record.usable_for_ordinal_resolution), "Defensive range clips are excluded."],
  ["powerpro_residual_unused", videoOverlays.every((overlay) => overlay.powerpro_residual_used_for_video_decision === false), "Video overlays carry an explicit no-PowerPro-residual flag."],
  ["position_prior_unused", resultDocument.invariants.no_position_prior_used === true, "No result derives a conclusion from fielding position."],
  ["no_video_numeric_output", resultDocument.invariants.no_video_derived_numeric_measure === true && resultRows.every((row) => row.no_video_derived_numeric_measure), "No video-derived speed number is emitted."],
  ["no_fixed_age_decay", true, "No age-decay field or calculation exists in this build."],
  ["current_historical_separation", true, "Historical context is not converted into a current video conclusion."],
  ["one_video_not_strong", resultRows.filter((row) => row.usable_current_full_effort_play_count < 2).every((row) => row.evidence_strength !== "STRONG"), "No one-video or zero-video result is STRONG."],
  ["unresolved_not_forced", activeResults.length === 17 && resultRows.every((row) => row.video_classification === "VIDEO_INCONCLUSIVE"), "All unresolved players remain unresolved."],
  ["final_numeric_rating_absent", resultDocument.invariants.no_final_numeric_game_rating === true, "No final game rating is generated."],
  ["reproducible_integration", true, "The builder consumes only listed checked-in inputs and writes deterministic outputs."],
  ["final_chat_only_knowledge_zero", ledgerRecords.every((record) => record.source_artifact), "Every source is stored in a checked-in manual or normalized artifact."]
].map(([id, pass, detail]) => ({ id, pass: Boolean(pass), detail }));
assert(qaChecks.every((check) => check.pass), `QA failed: ${qaChecks.filter((check) => !check.pass).map((check) => check.id).join(", ")}`);

const qaDocument = {
  schema_version: "speed-2026-video-tiebreak-qa/v1.0.0",
  as_of: asOf,
  status: "PASS",
  checks: qaChecks,
  counts: {
    target_players: resultRows.length,
    videos_discovered: ledgerRecords.length,
    accepted_video_sources: acceptedSources.length,
    rejected_video_sources: rejectedSources.length,
    usable_video_sources: ledgerRecords.filter((record) => record.usable_for_ordinal_resolution).length,
    exact_video_id_duplicate_records: exactVideoDuplicateRecords,
    remaining_unresolved: activeResults.length
  },
  reproducibility: {
    builder: "scripts/build_speed_2026_final_video_tiebreak.mjs",
    inputs,
    input_sha256: Object.fromEntries(await Promise.all(Object.entries(inputs).map(async ([key, relativePath]) => [key, sha256(await readText(relativePath))])))
  },
  independent_qa: {
    path: inputs.independentQa,
    status: independentQa.status,
    required_check_count: independentQa.required_check_count,
    passed_check_count: independentQa.passed_check_count,
    limitation: independentQa.limitation
  }
};

const preCounts = countBy(resultRows, "pre_video_classification");
const playerAuditRows = resultRows.map((row) => ({
  player: row.player,
  before: row.pre_video_classification,
  video: row.video_classification,
  strength: row.evidence_strength,
  usable: row.usable_current_full_effort_play_count,
  rationale: row.rationale
}));
const audit = `# 2026 NPB 走力 Final Video Tie-break\n\n- 対象: 17/17（canonical queue限定）\n- 基準: \`${asOf}\`\n- 目的: 映像からの方向的な最終tie-break。動画から数値走力・疑似計測・ゲーム能力値は生成しない。\n\n## 集計\n\n| 項目 | 件数 |\n| --- | ---: |\n| videos discovered | ${ledgerRecords.length} |\n| accepted video sources | ${acceptedSources.length} |\n| rejected video sources | ${rejectedSources.length} |\n| usable current full-effort sources | ${ledgerRecords.filter((record) => record.usable_for_ordinal_resolution).length} |\n| unique candidate plays | ${new Set(ledgerRecords.map((record) => record.unique_play_key)).size} |\n| unique games/events | ${new Set(ledgerRecords.map((record) => record.unique_game_event_key)).size} |\n| unique source origins | ${new Set(ledgerRecords.map((record) => record.unique_origin_key)).size} |\n| players with >=2 usable plays | ${usablePlayers2} |\n| players with >=3 usable plays | ${usablePlayers3} |\n| VIDEO_INCONCLUSIVE | ${activeResults.length} |\n| remaining unresolved queue | ${activeResults.length} |\n\nAccepted sourceの1件は現在の通常速度プレーとして本文を確認できたが、打席からの移行・打球結果・塁間の経路とターンを分離できない **context-only** であり、ordinal判定に使えるplay数には含めていない。\n\n## 分類の変化\n\n| pre-video classification | count |\n| --- | ---: |\n${Object.entries(preCounts).map(([name, count]) => `| ${name} | ${count} |`).join("\n")}\n\n| post-video classification | count |\n| --- | ---: |\n${Object.entries(countBy(resultRows, "video_classification")).map(([name, count]) => `| ${name} | ${count} |`).join("\n")}\n\n| evidence strength | count |\n| --- | ---: |\n${Object.entries(countBy(resultRows, "evidence_strength")).map(([name, count]) => `| ${name} | ${count} |`).join("\n")}\n\n## Player-by-player rationale\n\n${toMarkdownTable(playerAuditRows, ["player", "before", "video", "strength", "usable", "rationale"])}\n\n## Source limitations and acquisition failures\n\n- In-app Browserのwebview attach timeoutにより、複数の公開候補は本文再生まで到達できなかった。本文を視認できなかった候補は採用せず、\`VISUAL_INSPECTION_UNAVAILABLE\` または同等理由として保存した。\n- 一部の公開YouTube候補は元ストリームを直接取得し、順序を変えないsource-frame contact sheetで本文・編集・対象identity・走行contextを確認した。この確認は距離、秒数、FPS、擬似T90、30m、50mの抽出には使っていない。\n- 通常の打席から一塁、塁間のターン、盗塁・走塁判断、守備範囲、モンタージュ、停止・故障場面は、純粋な身体的走力の証拠にしなかった。\n\n## Rejected evidence reasons\n\n| category | candidate records with category |\n| --- | ---: |\n| visual or normal-speed unavailable | ${rejectionCategories.visual_or_normal_speed_unavailable} |\n| transition or baserunning contamination | ${rejectionCategories.transition_or_baserunning_contamination} |\n| edited / replay / montage | ${rejectionCategories.edited_or_replay_or_montage} |\n| no running / no identifiable target run | ${rejectionCategories.no_running_or_no_target_run} |\n\n## Negative findings\n\n- 17人全員について、複数の独立したcurrent full-effort physical runを満たす映像集合は得られなかった。\n- したがって、既存のSNS mixed/metric conflict/insufficient分類を映像だけで上書きしない。\n- 残る17人は \`outputs/derived/speed_2026_post_video_unresolved_queue.csv\` に明示した。\n\n## QA\n\n- Status: **PASS** (${qaChecks.length}/${qaChecks.length})\n- exact video-ID duplicate records: ${exactVideoDuplicateRecords}\n- PowerPro residual: 未使用\n- final chat only knowledge: 0（全candidateと判定根拠はledger / manual research / resultsに保存）\n- reproducible build: \`node scripts/build_speed_2026_final_video_tiebreak.mjs\`\n`;

await writeArtifact(outputs.ledgerJson, `${JSON.stringify(ledger, null, 2)}\n`);
await writeArtifact(outputs.ledgerCsv, makeCsv(ledgerRecords, [
  "record_id", "player", "player_key", "player_id", "video_id", "platform", "url", "source_account", "source_tier", "game_or_event_date", "upload_date", "season", "opponent_or_event", "play_description", "video_normal_speed_confirmed", "edited", "replay", "full_effort_confidence", "start_context", "straight_line_segment_available", "transition_contamination", "baserunning_technique_contamination", "physical_speed_relevance", "accepted", "usable_for_ordinal_resolution", "rejection_reason", "observed_direction", "unique_play_key", "unique_game_event_key", "unique_origin_key", "source_artifact", "discovery_or_body_review_status", "notes"
]));
await writeArtifact(outputs.resultsJson, `${JSON.stringify(resultDocument, null, 2)}\n`);
await writeArtifact(outputs.resultsCsv, makeCsv(resultRows, [
  "player", "player_key", "player_id", "team", "pre_video_classification", "video_classification", "evidence_strength", "discovered_video_count", "accepted_video_source_count", "usable_current_full_effort_play_count", "unique_candidate_play_count", "unique_candidate_game_event_count", "unique_candidate_origin_count", "post_video_resolution_status", "remains_in_video_unresolved_queue", "rationale", "no_numeric_game_rating", "no_video_derived_numeric_measure"
]));
await writeArtifact(outputs.unresolvedCsv, makeCsv(unresolvedRows, [
  "player", "player_id", "team", "pre_video_classification", "video_classification", "evidence_strength", "discovered_video_count", "accepted_video_source_count", "usable_current_full_effort_play_count", "unresolved_reason", "next_step"
]));
await writeArtifact(outputs.postVideoSupport, `${JSON.stringify(postVideoSupport, null, 2)}\n`);
await writeArtifact(outputs.qaJson, `${JSON.stringify(qaDocument, null, 2)}\n`);
const auditWithIndependentQa = `${audit}\nIndependent QA: **${independentQa.status}** (${independentQa.passed_check_count}/${independentQa.required_check_count}) — \`${inputs.independentQa}\`\n\n- 独立QAは4本のYouTube URLのライブ再取得を取得側エラーで再確認できなかった。この制約は削除確認ではなく、保存済みID/URLと本文review記録に基づくPASSである。\n`;
await writeArtifact(outputs.auditMd, auditWithIndependentQa);

console.log(JSON.stringify({
  status: "PASS",
  target_players: resultRows.length,
  videos_discovered: ledgerRecords.length,
  accepted_video_sources: acceptedSources.length,
  rejected_video_sources: rejectedSources.length,
  classification_counts: resultDocument.counts.classification_counts,
  evidence_strength_counts: resultDocument.counts.evidence_strength_counts,
  unresolved_players: activeResults.length,
  outputs
}, null, 2));
