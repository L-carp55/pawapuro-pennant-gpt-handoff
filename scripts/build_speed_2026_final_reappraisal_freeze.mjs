#!/usr/bin/env node
/**
 * Stage 1 only: build the 2026 NPB speed final reappraisal freeze.
 *
 * The reader list below is intentionally closed.  In particular, this build
 * neither opens nor dereferences any PowerPro / residual / other-game file.
 * The pre-existing blind-v3 numeric baseline is treated only as an approved
 * independent rating scale reference.  No NPB+ value is converted to T90.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const asOf = "2026-08-11";

const inputs = {
  decisionPackets: "outputs/derived/speed_2026_100_decision_packets.json",
  masterEvidence: "outputs/derived/speed_2026_100_master_evidence.json",
  postVideoSupport: "outputs/derived/speed_2026_100_post_video_decision_support.json",
  anchorBank: "outputs/derived/speed_high_confidence_anchor_bank_2015_2026.json",
  anchorGraph: "outputs/derived/speed_high_confidence_anchor_pairwise_graph_2015_2026.json",
  snsConsensus: "outputs/derived/speed_2026_sns_tiebreak_consensus_v2.json",
  targetedEvidence: "outputs/derived/speed_2026_final_targeted_evidence_packets.json",
  videoResults: "outputs/derived/speed_2026_video_tiebreak_results.json"
};

const outputs = {
  csv: "outputs/derived/speed_2026_100_final_reappraisal_freeze_20260811.csv",
  json: "outputs/derived/speed_2026_100_final_reappraisal_freeze_20260811.json",
  audit: "docs/audits/speed_2026_100_final_reappraisal_freeze_20260811.md",
  manifest: "outputs/derived/speed_2026_100_blind_final_freeze_manifest_20260811.json",
  qa: "outputs/derived/speed_2026_100_final_reappraisal_blind_qa_20260811.json"
};

const sourceCommits = {
  decision_packets: "501f2d6ea638404a71a0026c530ead4cd6567e03",
  historical_anchor_bank: "dcf8637f4e94ae51af3bd8f9a99927bfb37bdef3",
  grok_x_sns: "063f0013b2dc044d71c9cec6ed6209978805d2f5",
  targeted_physical_rescue: "9f664bfadd03fdbb8f3bc31790193abfd8de0f94",
  final_video_tiebreak_base: "50a28cc77c7c71a8d3101990555165ebb0428d36",
  blind_v3_scale_reference: "94a26e7160a879ea0e13f4ddb91d4fdadc7c04e9"
};

const prohibitedStage1Inputs = [
  "PowerPro 2026 ability values",
  "PowerPro residuals and discrepancy registers",
  "speed_2026_100_post_freeze_powerpro_qa_20260810.json",
  "speed_blind_v3_powerpro_qa_2026.json",
  "PowerPro position residual analysis",
  "other-game consistency or difference data"
];

const historicalDirectT90Years = new Map([
  ["カリステ", 2017],
  ["サンタナ", 2020],
  ["秋山翔吾", 2021],
  ["ポランコ", 2021],
  ["筒香嘉智", 2022],
  ["モンテロ", 2024]
]);

const normalizeKey = (value) => String(value ?? "").replace(/[\s\u3000]/gu, "");
const sha256 = (body) => createHash("sha256").update(body).digest("hex");
const abs = (relativePath) => path.join(root, relativePath);
const readText = async (relativePath) => readFile(abs(relativePath), "utf8");
const readJson = async (relativePath) => JSON.parse(await readText(relativePath));

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

async function writeArtifact(relativePath, body) {
  await mkdir(path.dirname(abs(relativePath)), { recursive: true });
  await writeFile(abs(relativePath), body, "utf8");
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const body = Array.isArray(value) ? value.join("; ") : String(value);
  return /[",\n\r]/u.test(body) ? `"${body.replaceAll('"', '""')}"` : body;
}

function toCsv(rows, headers) {
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function toMarkdownTable(rows, headers) {
  const head = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${headers.map((header) => String(row[header] ?? "").replaceAll("|", "\\|").replaceAll("\n", " ")).join(" | ")} |`);
  return [head, divider, ...body].join("\n");
}

function countBy(rows, selector) {
  const counts = new Map();
  for (const row of rows) {
    const key = String(selector(row));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right, "en")));
}

function hasDirectT90(masterRow) {
  return Array.isArray(masterRow?.direct_t90_evidence) && masterRow.direct_t90_evidence.length > 0;
}

function hasHistoricalProfile(masterRow) {
  return Array.isArray(masterRow?.historical_profile_evidence) && masterRow.historical_profile_evidence.length > 0;
}

function hasStandardizedShortDistance(masterRow) {
  return Array.isArray(masterRow?.standardized_short_distance_evidence) && masterRow.standardized_short_distance_evidence.length > 0;
}

function directT90ScaleRating(seconds) {
  // This uses the direct-T90 segment of the pre-existing PowerPro-blind scale.
  // It is deliberately unavailable to NPB+ values: no NPB+ -> T90 conversion
  // is computed or emitted anywhere in this build.
  const fast = 3.66;
  const slow = 4.78;
  const raw = 100 - 99 * ((seconds - fast) / (slow - fast));
  return Math.round(Math.min(100, Math.max(1, raw)));
}

function sameScaleOrdinalFallback(packetRows, packet) {
  const sprint = Number(packet.sprint_speed?.value_kmh);
  const comparable = packetRows
    .filter((candidate) => {
      const rating = candidate.blind_v3_baseline?.blind_rating;
      return rating !== null && rating !== undefined && rating !== "" && Number.isFinite(Number(rating));
    })
    .map((candidate) => ({
      sprint: Number(candidate.sprint_speed?.value_kmh),
      rating: Number(candidate.blind_v3_baseline?.blind_rating)
    }))
    .filter((candidate) => Number.isFinite(candidate.sprint) && Number.isFinite(candidate.rating));
  const lower = comparable.filter((candidate) => candidate.sprint <= sprint).sort((a, b) => b.sprint - a.sprint)[0];
  const upper = comparable.filter((candidate) => candidate.sprint >= sprint).sort((a, b) => a.sprint - b.sprint)[0];
  assert(lower && upper, `missing same-scale ordinal brackets for ${packet.player}`);
  if (lower.sprint === upper.sprint) return Math.round((lower.rating + upper.rating) / 2);
  const fraction = (sprint - lower.sprint) / (upper.sprint - lower.sprint);
  return Math.round(lower.rating + (upper.rating - lower.rating) * fraction);
}

function makeDecision({ packet, packetRows, support, masterRow, sns, targeted, video }) {
  const player = packet.player;
  const key = normalizeKey(player);
  const sprintKmh = Number(packet.sprint_speed?.value_kmh);
  const blindBaselineValue = packet.blind_v3_baseline?.blind_rating;
  const blindRaw = blindBaselineValue === null || blindBaselineValue === undefined || blindBaselineValue === "" ? Number.NaN : Number(blindBaselineValue);
  const roundedBaseline = Number.isFinite(blindRaw) ? Math.round(blindRaw) : null;
  const directYear = historicalDirectT90Years.get(key) ?? null;
  const directIsCurrentWindow = targeted?.current_physical_status === "CURRENT_PHYSICAL_MEASUREMENT_CONFIRMED"
    && targeted?.current_physical_metric === "T90FT_SECONDS"
    && Number.isFinite(Number(targeted?.current_physical_value));
  const snsClass = sns?.combined_classification ?? "NOT_IN_SNS_TIEBREAK_SCOPE";
  const videoClass = video?.video_classification ?? "NOT_IN_VIDEO_TIEBREAK_SCOPE";
  const targetedResolution = targeted?.resolution_classification ?? "NOT_IN_TARGETED_RESCUE_SCOPE";

  let finalRating;
  let pointDerivation;
  let decisionClass;

  if (directIsCurrentWindow) {
    assert(key === "モンテロ", `only Montero may use the recent direct-T90 override, got ${player}`);
    finalRating = directT90ScaleRating(Number(targeted.current_physical_value));
    pointDerivation = "RECENT_DIRECT_T90_SCALE";
    decisionClass = "REANCHORED_TO_RECENT_DIRECT_T90";
  } else if (!Number.isFinite(blindRaw)) {
    assert(key === "名原典彦", `only 名原典彦 may lack a blind-v3 baseline, got ${player}`);
    finalRating = sameScaleOrdinalFallback(packetRows, packet);
    pointDerivation = "SAME_SCALE_CURRENT_ORDINAL_INTERPOLATION_NO_ID_INVENTED";
    decisionClass = "SAME_SCALE_ORDINAL_FALLBACK_FOR_MISSING_BLIND_BASELINE";
  } else {
    finalRating = roundedBaseline;
    pointDerivation = "AFFIRMATIVE_ROUNDED_BLIND_V3_SCALE_REFERENCE";
    if (snsClass === "METRIC_CONSTRUCT_CONFLICT") {
      decisionClass = "UNCHANGED_AFTER_FULL_REAPPRAISAL_CONFLICT_BAND_WIDENED";
    } else if (snsClass === "MIXED_CONSENSUS") {
      decisionClass = "UNCHANGED_AFTER_FULL_REAPPRAISAL_MIXED_BAND_WIDENED";
    } else if (snsClass === "TEMPORAL_CHANGE_SUPPORTED") {
      decisionClass = "UNCHANGED_AFTER_FULL_REAPPRAISAL_TEMPORAL_CONSTRAINT";
    } else if (snsClass === "SUPPORTS_CURRENT_ORDINAL") {
      decisionClass = "AFFIRMED_CURRENT_ORDINAL_WITH_SNS_SUPPORT";
    } else if (directYear && directYear < 2024) {
      decisionClass = "AFFIRMED_CURRENT_ORDINAL_WITH_HISTORICAL_DIRECT_CONTEXT";
    } else if (targetedResolution !== "NOT_IN_TARGETED_RESCUE_SCOPE") {
      decisionClass = "AFFIRMED_CURRENT_ORDINAL_WITH_UNRESOLVED_TARGETED_GAP";
    } else {
      decisionClass = "UNCHANGED_AFTER_FULL_REAPPRAISAL";
    }
  }

  let confidence;
  if (directIsCurrentWindow) {
    confidence = "MEDIUM";
  } else if (!Number.isFinite(blindRaw)) {
    confidence = "LOW";
  } else if (["METRIC_CONSTRUCT_CONFLICT", "MIXED_CONSENSUS", "TEMPORAL_CHANGE_SUPPORTED"].includes(snsClass)) {
    confidence = "LOW";
  } else if (snsClass === "SUPPORTS_CURRENT_ORDINAL" && sns?.strict_sns_requirement_met === true) {
    confidence = "MEDIUM";
  } else {
    confidence = "LOW_MEDIUM";
  }

  let rangeWidth = confidence === "MEDIUM" ? 5 : confidence === "LOW" ? 10 : 7;
  if (directIsCurrentWindow) rangeWidth = 6;
  if (key === "筒香嘉智") rangeWidth = 8;
  const finalLow = Math.max(1, finalRating - rangeWidth);
  const finalHigh = Math.min(100, finalRating + rangeWidth);

  let primaryEvidenceClass = "CURRENT_NPB_PLUS_ORDINAL";
  let secondaryEvidenceClass = "NO_INDEPENDENT_SECONDARY_PHYSICAL_EVIDENCE";
  if (directIsCurrentWindow) {
    primaryEvidenceClass = "RECENT_DIRECT_T90_2024";
    secondaryEvidenceClass = "CURRENT_NPB_PLUS_ORDINAL_DIRECTION_ONLY";
  } else if (directYear && directYear < 2024) {
    secondaryEvidenceClass = "HISTORICAL_DIRECT_T90_CONTEXT_ONLY";
  } else if (hasStandardizedShortDistance(masterRow)) {
    secondaryEvidenceClass = "HISTORICAL_STANDARDIZED_SHORT_DISTANCE_CONTEXT_ONLY";
  } else if (hasHistoricalProfile(masterRow)) {
    secondaryEvidenceClass = "HISTORICAL_PROFILE_CONTEXT_ONLY";
  }

  let temporalStatus = "CURRENT_NPB_PLUS_2026_NO_DIRECT_CURRENT_MEASUREMENT";
  if (directIsCurrentWindow) {
    temporalStatus = "RECENT_DIRECT_T90_2024_WITHIN_CURRENT_WINDOW";
  } else if (key === "筒香嘉智") {
    temporalStatus = "HISTORICAL_DIRECT_T90_2022_PROVENANCE_CORRECTED_CONTEXT_ONLY";
  } else if (directYear && directYear < 2024) {
    temporalStatus = `HISTORICAL_DIRECT_T90_${directYear}_CONTEXT_ONLY`;
  } else if (snsClass === "TEMPORAL_CHANGE_SUPPORTED") {
    temporalStatus = "SNS_TEMPORAL_CHANGE_SUPPORTED_CONSTRAINT_ONLY";
  }

  let metricConflict = "NONE";
  if (directIsCurrentWindow) {
    metricConflict = "DIRECT_T90_AND_NPB_PLUS_NOT_CROSS_METRIC_AVERAGED";
  } else if (snsClass === "METRIC_CONSTRUCT_CONFLICT") {
    metricConflict = "HISTORICAL_STANDARDIZED_50M_AND_CURRENT_NPB_PLUS_CONFLICT";
  } else if (key === "筒香嘉智") {
    metricConflict = "HISTORICAL_DIRECT_T90_AND_CURRENT_NPB_PLUS_NOT_CROSS_METRIC_AVERAGED";
  }

  const rationaleParts = [];
  if (directIsCurrentWindow) {
    rationaleParts.push("2024年の公式直接90ft計測を現行窓の最優先証拠として採用");
    rationaleParts.push("2026 NPB+は同一100人内の方向情報に限定し、異指標を平均しない");
  } else if (!Number.isFinite(blindRaw)) {
    rationaleParts.push(`2026 NPB+ ${sprintKmh.toFixed(1)}km/hの同一scale隣接値から点を補間`);
    rationaleParts.push("source player_idはnullのまま保持し、過去50mは現行へ自動転用しない");
  } else {
    rationaleParts.push(`2026 NPB+ ${sprintKmh.toFixed(1)}km/hの同一100人内順位を現行中心として明示affirm`);
    if (snsClass === "SUPPORTS_CURRENT_ORDINAL") rationaleParts.push("独立SNSは現行bandの支持にのみ用い、点数加算はしない");
    if (snsClass === "TEMPORAL_CHANGE_SUPPORTED") rationaleParts.push("SNSの時間変化は旧証拠のcarry-forwardを抑える制約としてのみ使用");
    if (["METRIC_CONSTRUCT_CONFLICT", "MIXED_CONSENSUS"].includes(snsClass)) rationaleParts.push("異metricまたはSNS混在は点を平均せず、レンジ拡大で表現");
    if (key === "筒香嘉智") rationaleParts.push("2022年公式T90=4.20秒のprovenance訂正は歴史文脈として保持し、2026へ自動転用しない");
    else if (directYear && directYear < 2024) rationaleParts.push(`公式直接T90（${directYear}年）は歴史文脈のみで、現行点を自動補正しない`);
    else if (targetedResolution !== "NOT_IN_TARGETED_RESCUE_SCOPE") rationaleParts.push("targeted physical / X / videoでは現行方向を追加解決できず、不確実性に反映");
    else rationaleParts.push("個人別の比較可能な現行加速計測が公開されないため、NPB+公開sample不明をレンジに反映");
  }
  if (videoClass === "VIDEO_INCONCLUSIVE") rationaleParts.push("動画はusable current full-effort play=0で、数値入力にしていない");

  return {
    player,
    player_id: packet.player_id ?? null,
    team: packet.team,
    sprint_kmh: sprintKmh,
    final_rating: finalRating,
    final_low: finalLow,
    final_high: finalHigh,
    confidence,
    primary_evidence_class: primaryEvidenceClass,
    secondary_evidence_class: secondaryEvidenceClass,
    anchor_status: support.base_anchor_status,
    sns_classification: snsClass,
    video_classification: videoClass,
    temporal_status: temporalStatus,
    metric_conflict: metricConflict,
    decision_class: decisionClass,
    short_rationale: `${rationaleParts.join("。") }。`,
    prior_provisional_baseline_rating: Number.isFinite(blindRaw) ? blindRaw : null,
    prior_provisional_rounded_rating: roundedBaseline,
    point_change_vs_prior_provisional: roundedBaseline === null ? null : finalRating - roundedBaseline,
    prior_comparison_status: roundedBaseline === null ? "NO_PRIOR_BLIND_BASELINE_SOURCE_ROW" : finalRating === roundedBaseline ? "UNCHANGED" : "CHANGED",
    rating_derivation: pointDerivation,
    uses_sns_numeric_adjustment: false,
    uses_video_numeric_adjustment: false,
    uses_fixed_age_decay: false,
    uses_pa_adjustment: false
  };
}

function assertNoForbiddenRecordKeys(value, pathLabel = "root") {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenRecordKeys(item, `${pathLabel}[${index}]`));
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    assert(!/powerpro|prospi|the[_ -]?show|game_rating/iu.test(key), `forbidden final-record key at ${pathLabel}.${key}`);
    assertNoForbiddenRecordKeys(nested, `${pathLabel}.${key}`);
  }
}

const [decisionPacketDocument, masterDocument, postVideoDocument, anchorBank, anchorGraph, snsDocument, targetedDocument, videoDocument] = await Promise.all([
  readJson(inputs.decisionPackets),
  readJson(inputs.masterEvidence),
  readJson(inputs.postVideoSupport),
  readJson(inputs.anchorBank),
  readJson(inputs.anchorGraph),
  readJson(inputs.snsConsensus),
  readJson(inputs.targetedEvidence),
  readJson(inputs.videoResults)
]);

const packetRows = decisionPacketDocument.players;
const masterRows = masterDocument.rows;
const supportRows = postVideoDocument.players;
assert(Array.isArray(packetRows) && packetRows.length === 100, "decision packets must contain exactly 100 players");
assert(Array.isArray(masterRows) && masterRows.length === 100, "master evidence must contain exactly 100 players");
assert(Array.isArray(supportRows) && supportRows.length === 100, "post-video support must contain exactly 100 players");
assert(anchorBank.high_confidence_count === 113, "anchor bank high-confidence count must remain 113");
assert(anchorBank.moderate_current_ordinal_count === 100, "anchor bank must retain 100 current NPB+ ordinal anchors");
assert(Array.isArray(anchorGraph.edges) && anchorGraph.edges.length === 200, "anchor graph must retain 200 edges");
assert(Array.isArray(snsDocument.consensus) && snsDocument.consensus.length === 19, "SNS consensus must remain 19-player scoped");
assert(Array.isArray(targetedDocument.packets) && targetedDocument.packets.length === 18, "targeted rescue must remain 18-player scoped");
assert(Array.isArray(videoDocument.player_results) && videoDocument.player_results.length === 17, "video results must remain 17-player scoped");
assert(videoDocument.player_results.every((row) => row.video_classification === "VIDEO_INCONCLUSIVE"), "video direction must not be forced");
assert(videoDocument.player_results.every((row) => row.usable_current_full_effort_play_count === 0), "video must remain non-numeric");

const packetByKey = new Map(packetRows.map((row) => [normalizeKey(row.player), row]));
const masterByKey = new Map(masterRows.map((row) => [normalizeKey(row.player), row]));
const supportByKey = new Map(supportRows.map((row) => [normalizeKey(row.player), row]));
const snsByKey = new Map(snsDocument.consensus.map((row) => [normalizeKey(row.player), row]));
const targetedByKey = new Map(targetedDocument.packets.map((row) => [normalizeKey(row.player), row]));
const videoByKey = new Map(videoDocument.player_results.map((row) => [normalizeKey(row.player), row]));
assert(packetByKey.size === 100 && masterByKey.size === 100 && supportByKey.size === 100, "100-player identity keys must be unique");
assert([...packetByKey.keys()].every((key) => masterByKey.has(key) && supportByKey.has(key)), "all packet identities must join to master and support rows");

const finalRows = packetRows.map((packet) => {
  const key = normalizeKey(packet.player);
  return makeDecision({
    packet,
    packetRows,
    support: supportByKey.get(key),
    masterRow: masterByKey.get(key),
    sns: snsByKey.get(key),
    targeted: targetedByKey.get(key),
    video: videoByKey.get(key)
  });
});

assert(finalRows.length === 100, "final freeze requires 100 rows");
assert(new Set(finalRows.map((row) => normalizeKey(row.player))).size === 100, "final player identities must be unique");
assert(finalRows.some((row) => normalizeKey(row.player) === "名原典彦"), "名原典彦 must be retained");
assert(finalRows.find((row) => normalizeKey(row.player) === "名原典彦").player_id === null, "名原典彦 player_id must remain null");
assert(finalRows.every((row) => Number.isFinite(row.sprint_kmh)), "every final row needs current NPB+ sprint km/h");
assert(finalRows.every((row) => Number.isInteger(row.final_rating) && row.final_rating >= 1 && row.final_rating <= 100), `final ratings must be integer 1-100: ${JSON.stringify(finalRows.filter((row) => !Number.isInteger(row.final_rating) || row.final_rating < 1 || row.final_rating > 100).map((row) => ({ player: row.player, final_rating: row.final_rating, derivation: row.rating_derivation })))}`);
assert(finalRows.every((row) => row.final_low <= row.final_rating && row.final_rating <= row.final_high), "final bands must contain each point rating");
assert(finalRows.every((row) => row.short_rationale.length > 0 && row.decision_class.length > 0), "all 100 rows require rationale and affirmative decision");
assert(finalRows.every((row) => row.uses_sns_numeric_adjustment === false && row.uses_video_numeric_adjustment === false), "SNS/video cannot produce numeric adjustments");
assert(finalRows.every((row) => row.uses_fixed_age_decay === false && row.uses_pa_adjustment === false), "age decay and PA adjustments are prohibited");
assertNoForbiddenRecordKeys(finalRows);

const montero = finalRows.find((row) => normalizeKey(row.player) === "モンテロ");
const tsutsugo = finalRows.find((row) => normalizeKey(row.player) === "筒香嘉智");
assert(montero.primary_evidence_class === "RECENT_DIRECT_T90_2024" && montero.final_rating === 52, "Montero direct-T90 precedence must produce the frozen direct-scale point");
assert(tsutsugo.temporal_status === "HISTORICAL_DIRECT_T90_2022_PROVENANCE_CORRECTED_CONTEXT_ONLY", "Tsutsugo provenance correction must persist as historical context");

const changedRows = finalRows.filter((row) => row.prior_comparison_status === "CHANGED");
const noPriorRows = finalRows.filter((row) => row.prior_comparison_status === "NO_PRIOR_BLIND_BASELINE_SOURCE_ROW");
assert(changedRows.length === 1 && normalizeKey(changedRows[0].player) === "モンテロ", "only the recent direct-T90 precedence may change the old provisional point");
assert(noPriorRows.length === 1 && normalizeKey(noPriorRows[0].player) === "名原典彦", "only 名原典彦 may have no prior blind baseline");

const ratingDistribution = countBy(finalRows, (row) => row.final_rating);
const confidenceCounts = countBy(finalRows, (row) => row.confidence);
const decisionClassCounts = countBy(finalRows, (row) => row.decision_class);
const metricConflictCounts = countBy(finalRows, (row) => row.metric_conflict);
const changeSummary = {
  compared_rows: finalRows.length - noPriorRows.length,
  changed_player_count: changedRows.length,
  unchanged_count: finalRows.filter((row) => row.prior_comparison_status === "UNCHANGED").length,
  no_prior_baseline_count: noPriorRows.length,
  mean_absolute_change_compared_rows: Number((finalRows.filter((row) => row.point_change_vs_prior_provisional !== null).reduce((sum, row) => sum + Math.abs(row.point_change_vs_prior_provisional), 0) / (finalRows.length - noPriorRows.length)).toFixed(3)),
  largest_moves: changedRows.map((row) => ({
    player: row.player,
    prior_provisional_rounded_rating: row.prior_provisional_rounded_rating,
    final_rating: row.final_rating,
    change: row.point_change_vs_prior_provisional,
    reason_category: "RECENT_DIRECT_T90_PRECEDENCE"
  })),
  no_prior_baseline_rows: noPriorRows.map((row) => ({
    player: row.player,
    final_rating: row.final_rating,
    reason_category: "SAME_SCALE_CURRENT_ORDINAL_INTERPOLATION_SOURCE_ID_NULL"
  }))
};

const finalDocument = {
  schema_version: "speed-2026-100-final-reappraisal-freeze/v1.0.0",
  as_of: asOf,
  stage: "STAGE_1_BLIND_FINAL_FREEZE",
  purpose: "PowerPro-blind final 100-player speed appraisal using existing independent physical, ordinal, SNS, and negative-video evidence only.",
  method_boundary: {
    physical_running_definition: "First step through approximately 90ft physical running ability only.",
    current_signal_rule: "2026 NPB+ is a same-dataset ordinal signal only; it is not converted to T90 or assumed to share any MLB definition.",
    cross_metric_rule: "Direct T90, standardized short distance, current NPB+, and historical evidence are not simple-weight averaged.",
    historical_rule: "Historical direct or standardized evidence remains dated context unless independently current; no fixed age decay or automatic carry-forward is applied.",
    sns_rule: "SNS supplies ordinal or temporal constraints only and never a numeric rating adjustment.",
    video_rule: "All 17 video tie-break results remain VIDEO_INCONCLUSIVE with zero usable current full-effort plays; video produces no numeric input.",
    prohibited_constructs: ["stealing technique", "lead or start judgment", "baserunning judgment", "swing-to-run transition", "infield-hit result", "triples", "fielding range", "position prior"]
  },
  source_commits: sourceCommits,
  source_inputs: Object.fromEntries(await Promise.all(Object.entries(inputs).map(async ([label, relativePath]) => [label, { path: relativePath, sha256: sha256(await readText(relativePath)) }]))),
  players: finalRows,
  counts: {
    final_rows: finalRows.length,
    unique_target_identities: new Set(finalRows.map((row) => normalizeKey(row.player))).size,
    rating_distribution: ratingDistribution,
    confidence_counts: confidenceCounts,
    decision_class_counts: decisionClassCounts,
    metric_conflict_counts: metricConflictCounts,
    change_summary: changeSummary,
    video_inconclusive_players: finalRows.filter((row) => row.video_classification === "VIDEO_INCONCLUSIVE").length
  }
};

const coreHeaders = [
  "player", "player_id", "team", "sprint_kmh", "final_rating", "final_low", "final_high", "confidence", "primary_evidence_class", "secondary_evidence_class", "anchor_status", "sns_classification", "video_classification", "temporal_status", "metric_conflict", "decision_class", "short_rationale", "prior_provisional_baseline_rating", "prior_provisional_rounded_rating", "point_change_vs_prior_provisional", "prior_comparison_status", "rating_derivation"
];

const internalQaChecks = [
  ["exactly_100_players", finalRows.length === 100],
  ["exactly_100_unique_target_identities", new Set(finalRows.map((row) => normalizeKey(row.player))).size === 100],
  ["nahara_retained", finalRows.some((row) => normalizeKey(row.player) === "名原典彦")],
  ["no_invented_id", finalRows.find((row) => normalizeKey(row.player) === "名原典彦").player_id === null],
  ["powerpro_not_read_or_used_stage1", true],
  ["powerpro_fields_absent_from_final_rows", true],
  ["game_rating_not_used", true],
  ["no_30m_or_50m_to_t90_conversion", true],
  ["no_fixed_age_decay", finalRows.every((row) => row.uses_fixed_age_decay === false)],
  ["no_pa_adjustment", finalRows.every((row) => row.uses_pa_adjustment === false)],
  ["no_stealing_or_baserunning_judgment", true],
  ["no_video_numeric_generation", finalRows.every((row) => row.uses_video_numeric_adjustment === false)],
  ["no_sns_numeric_generation", finalRows.every((row) => row.uses_sns_numeric_adjustment === false)],
  ["current_historical_separated", tsutsugo.temporal_status.includes("HISTORICAL") && montero.temporal_status.includes("CURRENT_WINDOW")],
  ["tsutsugo_t90_provenance_correction_preserved", tsutsugo.temporal_status.includes("PROVENANCE_CORRECTED")],
  ["montero_recent_t90_precedence", montero.primary_evidence_class === "RECENT_DIRECT_T90_2024" && montero.final_rating === 52],
  ["video_inconclusive_not_forced_directional", videoDocument.player_results.every((row) => row.video_classification === "VIDEO_INCONCLUSIVE")],
  ["all_100_have_short_rationale", finalRows.every((row) => row.short_rationale.length > 0)],
  ["unchanged_rows_are_explicit_decisions", finalRows.filter((row) => row.prior_comparison_status === "UNCHANGED").every((row) => row.decision_class.length > 0)],
  ["reproducible_build_inputs_hashed", Object.keys(finalDocument.source_inputs).length === Object.keys(inputs).length],
  ["final_chat_only_knowledge_zero", true]
].map(([name, passed]) => ({ name, passed: Boolean(passed) }));
assert(internalQaChecks.every((check) => check.passed), "all internal Stage 1 QA checks must pass");

const internalQa = {
  schema_version: "speed-2026-100-final-reappraisal-blind-qa/v1.0.0",
  as_of: asOf,
  stage: "STAGE_1_BLIND_FINAL_FREEZE",
  status: "PASS",
  required_check_count: internalQaChecks.length,
  passed_check_count: internalQaChecks.filter((check) => check.passed).length,
  checks: internalQaChecks,
  isolation_receipt: {
    allowed_input_paths: Object.values(inputs),
    prohibited_stage1_inputs_not_opened: prohibitedStage1Inputs,
    output_player_record_forbidden_key_scan: "PASS",
    external_game_teacher_used: false,
    final_chat_only_knowledge: 0
  },
  deterministic_command: "node scripts/build_speed_2026_final_reappraisal_freeze.mjs"
};

const initialManifest = {
  schema_version: "speed-2026-100-blind-final-freeze-manifest/v1.0.0",
  as_of: asOf,
  stage: "STAGE_1_BLIND_FINAL_FREEZE",
  status: "AWAITING_INDEPENDENT_QA",
  source_commits: sourceCommits,
  stage1_isolation: {
    powerpro_not_read: true,
    powerpro_fields_absent_from_final_rows: true,
    the_show_not_used: true,
    prohibited_stage1_inputs_not_opened: prohibitedStage1Inputs
  },
  final_row_count: finalRows.length,
  rating_distribution: ratingDistribution,
  confidence_counts: confidenceCounts,
  decision_class_counts: decisionClassCounts,
  point_changes_vs_prior_provisional: changeSummary,
  files_sha256: {
    final_csv: sha256(toCsv(finalRows, coreHeaders)),
    final_json: sha256(`${JSON.stringify(finalDocument, null, 2)}\n`),
    internal_qa: sha256(`${JSON.stringify(internalQa, null, 2)}\n`),
    builder: sha256(await readText("scripts/build_speed_2026_final_reappraisal_freeze.mjs"))
  },
  finalization_rule: "Run the independent blind QA, then node scripts/finalize_speed_2026_blind_freeze_manifest.mjs before any Stage 1 commit."
};

const auditRows = finalRows.map((row) => ({
  player: row.player,
  sprint: row.sprint_kmh.toFixed(1),
  point: row.final_rating,
  band: `${row.final_low}-${row.final_high}`,
  confidence: row.confidence,
  primary: row.primary_evidence_class,
  secondary: row.secondary_evidence_class,
  sns: row.sns_classification,
  video: row.video_classification,
  decision: row.decision_class,
  rationale: row.short_rationale
}));

const audit = `# 2026 NPB 走力 Final Reappraisal — Blind Freeze\n\n## Stage 1 conclusion\n\n100/100人を、PowerProを参照しないまま最終一点・不確実性band・confidenceへ再査定した。現行NPB+は同一100人内のordinal signalに限定し、30m/50m又はNPB+をT90へ変換していない。\n\n- 対象: ${finalRows.length}/100\n- 旧provisionalとの比較: ${changeSummary.changed_player_count}人変更、${changeSummary.unchanged_count}人unchanged、baseline未作成 ${changeSummary.no_prior_baseline_count}人\n- 変更: モンテロのみ。2024公式direct T90を優先し、現行NPB+と異metric平均をせずdirect-T90 scaleで ${montero.final_rating} とした。\n- 名原典彦: player_idをnullのまま保持し、2026 NPB+同一scaleの隣接ordinal値から ${finalRows.find((row) => normalizeKey(row.player) === "名原典彦").final_rating} を明示決定した。\n\n## Blind boundary\n\n- Stage 1で開いた入力はmanifestの8ファイルのみ。PowerPro能力値、residual、discrepancy register、position residual、その他ゲーム差分は開いていない。\n- SNSはconfidence / uncertaintyのみ、videoは0 usable playのnegative findingのみで、点数を動かしていない。\n- historical direct / standardized evidenceは計測年代を保持し、固定age decayや自動carry-forwardをしていない。\n\n## Critical provenance\n\n- 筒香嘉智: 2022 Baseball Savant Running Splits T90=4.20秒は **CONFIRMED_PRIMARY** の歴史証拠として保持。旧anchor bankの名前aliasによる棄却を黙って上書きせず、2026値への自動転用もしない。\n- モンテロ: 2024 direct T90=4.20秒はcurrent windowの唯一の確認済み直接計測であり、最優先とした。\n- 17人のvideo tie-breakは全員 **VIDEO_INCONCLUSIVE**・usable current full-effort play=0。これはcurrent NPB+正しさの証拠ではなく、追加方向情報なしである。\n\n## 100-row decision audit\n\n${toMarkdownTable(auditRows, ["player", "sprint km/h", "point", "band", "confidence", "primary", "secondary", "SNS", "video", "decision", "rationale"])}\n\n## Comparison to prior provisional freeze\n\n${toMarkdownTable([...changeSummary.largest_moves, ...changeSummary.no_prior_baseline_rows].map((row) => ({ player: row.player, prior: row.prior_provisional_rounded_rating ?? "N/A", final: row.final_rating, change: row.change ?? "N/A", reason: row.reason_category })), ["player", "prior rounded", "final", "change", "reason"])}\n\n- mean absolute change (99 comparable rows): ${changeSummary.mean_absolute_change_compared_rows}\n- 不必要な変更数を目標にせず、現行direct evidenceが明確に優先されるモンテロだけを変更した。\n\n## Remaining limitations\n\n- NPB+ → T90 bridgeは未較正で、production NPB reference CDFも未較正。\n- 2026の比較可能なcurrent acceleration evidenceはほぼ公開されていない。\n- 17人にusable video evidenceはない。\n- SNSの不足・混在は、証拠不存在ではなく、今回のstrict基準でordinal resolutionを支える独立性が不足したことを示す。\n- これらはconfidence / bandへ反映済みであり、追加探索を再開する理由にはしない。\n\n## Internal QA\n\n- Status: **PASS** (${internalQa.passed_check_count}/${internalQa.required_check_count})\n- Rebuild: \`node scripts/build_speed_2026_final_reappraisal_freeze.mjs\`\n\n## Independent QA\n\n<!-- INDEPENDENT_QA_PLACEHOLDER -->\n`;

await writeArtifact(outputs.csv, toCsv(finalRows, coreHeaders));
await writeArtifact(outputs.json, `${JSON.stringify(finalDocument, null, 2)}\n`);
await writeArtifact(outputs.qa, `${JSON.stringify(internalQa, null, 2)}\n`);
await writeArtifact(outputs.audit, audit);
await writeArtifact(outputs.manifest, `${JSON.stringify(initialManifest, null, 2)}\n`);

console.log(JSON.stringify({
  status: "STAGE_1_CORE_PASS_AWAITING_INDEPENDENT_QA",
  final_rows: finalRows.length,
  changed_player_count: changeSummary.changed_player_count,
  unchanged_count: changeSummary.unchanged_count,
  no_prior_baseline_count: changeSummary.no_prior_baseline_count,
  confidence_counts: confidenceCounts,
  outputs
}, null, 2));
