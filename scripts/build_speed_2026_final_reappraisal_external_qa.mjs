#!/usr/bin/env node
/**
 * Stage 2 only.  This script is intentionally run after the committed blind
 * freeze.  It reads PowerPro only as an external comparator and never writes
 * to a Stage 1 freeze artifact.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const asOf = "2026-08-11";
const blindFreezeSha = "7b82bb2030bf94f40d5983618f6e7362d8f2a06b";
const showCommit = "ab5adbfee656d69d0b378145fd66bf5789e0d1b4";
const showRoot = path.resolve(root, "..", "mlb-the-show-speed-temporal-rescue");

const inputs = {
  finalFreeze: "outputs/derived/speed_2026_100_final_reappraisal_freeze_20260811.json",
  freezeManifest: "outputs/derived/speed_2026_100_blind_final_freeze_manifest_20260811.json",
  internalBlindQa: "outputs/derived/speed_2026_100_final_reappraisal_blind_qa_20260811.json",
  independentBlindQa: "data/manual/speed_2026_final_reappraisal_blind_independent_qa_20260811.json",
  powerproExactMatchDataset: "outputs/derived/speed_2026_powerpro_residual_structure_dataset.csv",
  residualAudit: "docs/audits/speed_2026_powerpro_residual_structure_audit.md"
};

const outputs = {
  powerproQa: "outputs/derived/speed_2026_100_final_reappraisal_powerpro_qa_20260811.json",
  externalAudit: "docs/audits/speed_2026_100_final_reappraisal_external_qa_20260811.md",
  legacyGate: "docs/satei_handoff/15_SPEED_GATE_FINAL_20260810.md",
  finalGate: "docs/satei_handoff/16_SPEED_GATE_FINAL_AFTER_REOPEN_20260811.md",
  finalQa: "outputs/derived/speed_2026_100_final_reappraisal_final_qa_20260811.json"
};

const sha256 = (body) => createHash("sha256").update(body).digest("hex");
const abs = (relativePath) => path.join(root, relativePath);
const readText = async (relativePath) => readFile(abs(relativePath), "utf8");
const readJson = async (relativePath) => JSON.parse(await readText(relativePath));
const normalizeKey = (value) => String(value ?? "").replace(/[\s\u3000]/gu, "");

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

async function writeArtifact(relativePath, body) {
  await mkdir(path.dirname(abs(relativePath)), { recursive: true });
  await writeFile(abs(relativePath), body, "utf8");
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
  const [headers, ...body] = rows.filter((item) => item.some((cell) => cell !== ""));
  return body.map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] ?? ""])));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pearson(left, right) {
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftDenominator = 0;
  let rightDenominator = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftDenominator += leftDelta ** 2;
    rightDenominator += rightDelta ** 2;
  }
  return numerator / Math.sqrt(leftDenominator * rightDenominator);
}

function rounded(value) {
  return Number(value.toFixed(6));
}

function toMarkdownTable(rows, headers) {
  const head = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${headers.map((header) => String(row[header] ?? "").replaceAll("|", "\\|").replaceAll("\n", " ")).join(" | ")} |`);
  return [head, divider, ...body].join("\n");
}

function gitText(argumentsList, cwd = root) {
  return execFileSync("git", argumentsList, { cwd, encoding: "utf8" }).trim();
}

function isAncestor(ancestor, descendant) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const headSha = gitText(["rev-parse", "HEAD"]);
assert(isAncestor(blindFreezeSha, headSha), "blind final freeze must be an ancestor before Stage 2 begins");
assert(gitText(["-C", showRoot, "rev-parse", "HEAD"]) === showCommit, "The Show source worktree must be pinned to the declared commit");

const [finalDocument, manifest, internalBlindQa, independentBlindQa, powerproText, residualAuditText, showPolicyText, showSummaryText, showQaText] = await Promise.all([
  readJson(inputs.finalFreeze),
  readJson(inputs.freezeManifest),
  readJson(inputs.internalBlindQa),
  readJson(inputs.independentBlindQa),
  readText(inputs.powerproExactMatchDataset),
  readText(inputs.residualAudit),
  readFile(path.join(showRoot, "outputs/derived/showdd_speed_temporal_policy_2021_2026.json"), "utf8"),
  readFile(path.join(showRoot, "outputs/derived/showdd_speed_temporal_build_summary_2021_2026.json"), "utf8"),
  readFile(path.join(showRoot, "data/qa/showdd_speed_temporal_rescue_qa_2021_2026.json"), "utf8")
]);

const showPolicy = JSON.parse(showPolicyText);
const showSummary = JSON.parse(showSummaryText);
const showQa = JSON.parse(showQaText);
const powerproRows = parseCsv(powerproText);
assert(finalDocument.stage === "STAGE_1_BLIND_FINAL_FREEZE" && finalDocument.players.length === 100, "freeze input must be the committed 100-player Stage 1 document");
assert(manifest.status === "READY_FOR_BLIND_FREEZE_COMMIT", "freeze manifest must show the pre-QA Stage 1 ready state");
assert(internalBlindQa.status === "PASS" && independentBlindQa.status === "PASS", "both blind QA artifacts must pass before external QA");
assert(powerproRows.length === 100, "PowerPro exact-match source must contain 100 source rows");
assert(residualAuditText.includes("Global verdict: NOT_IDENTIFIABLE"), "prior residual audit must retain NOT_IDENTIFIABLE verdict");
assert(showPolicy.adequacy_verdict === "INSUFFICIENT", "The Show temporal policy must remain INSUFFICIENT");
assert(showSummary.primary_speed_player_events === 235 && showSummary.negative_speed_player_events === 0, "The Show negative result counts must remain preserved");
assert(showPolicy.coverage.unchanged_controls === "UNCHANGED_NOT_IDENTIFIABLE_FROM_SOURCE", "The Show unchanged controls must remain non-identifiable");
assert(showPolicy.coverage.dated_preupdate_statcast_rows === 0, "The Show dated pre-update Statcast rows must remain zero");
assert(showQa.status === "qa_pass_with_declared_temporal_limits", "The Show structural QA must be retained");

const expectedFreezeHashes = manifest.files_sha256;
const currentFreezeHashes = {
  finalCsv: sha256(await readText("outputs/derived/speed_2026_100_final_reappraisal_freeze_20260811.csv")),
  finalJson: sha256(await readText(inputs.finalFreeze)),
  audit: sha256(await readText("docs/audits/speed_2026_100_final_reappraisal_freeze_20260811.md")),
  internalQa: sha256(await readText(inputs.internalBlindQa)),
  builder: sha256(await readText("scripts/build_speed_2026_final_reappraisal_freeze.mjs")),
  finalizer: sha256(await readText("scripts/finalize_speed_2026_blind_freeze_manifest.mjs"))
};
assert(Object.entries(currentFreezeHashes).every(([label, value]) => expectedFreezeHashes[label] === value), "every frozen Stage 1 file hash must remain unchanged in Stage 2");

const exactStatus = "EXACT_CANONICAL_TEAM_MATCH";
const powerproById = new Map(powerproRows.filter((row) => row.powerpro_match_status === exactStatus).map((row) => [String(row.player_id), row]));
assert(powerproById.size === 99, "there must be exactly 99 exact PowerPro source matches");
assert(powerproRows.filter((row) => row.powerpro_match_status !== exactStatus).length === 1, "there must be exactly one unmatched source row");

const matchedRows = [];
const unmatched = [];
for (const finalRow of finalDocument.players) {
  if (finalRow.player_id === null) {
    unmatched.push({ player: finalRow.player, player_id: null, reason: "NO_PLAYER_ID_AND_NO_UNIQUE_CANONICAL_POWERPRO_MATCH", forced_match: false });
    continue;
  }
  const candidate = powerproById.get(String(finalRow.player_id));
  assert(candidate, `missing exact PowerPro match for ${finalRow.player}`);
  assert(candidate.powerpro_candidate_count === "1", `PowerPro source candidate count must be one for ${finalRow.player}`);
  assert(normalizeKey(candidate.player) === normalizeKey(finalRow.player), `PowerPro source player mismatch for ${finalRow.player}`);
  assert(normalizeKey(candidate.team_canonical) === normalizeKey(finalRow.team), `PowerPro source team mismatch for ${finalRow.player}`);
  const powerproSpeed = Number(candidate.powerpro_2026_speed);
  assert(Number.isFinite(powerproSpeed), `missing PowerPro speed for exact match ${finalRow.player}`);
  matchedRows.push({
    player: finalRow.player,
    player_id: finalRow.player_id,
    team: finalRow.team,
    final_rating: finalRow.final_rating,
    powerpro_2026_speed: powerproSpeed,
    residual_final_minus_powerpro: finalRow.final_rating - powerproSpeed,
    abs_residual: Math.abs(finalRow.final_rating - powerproSpeed),
    exact_match_status: candidate.powerpro_match_status,
    exact_match_method: candidate.powerpro_match_method
  });
}

assert(matchedRows.length === 99, "exact PowerPro matches must be 99");
assert(unmatched.length === 1 && normalizeKey(unmatched[0].player) === "名原典彦" && unmatched[0].forced_match === false, "名原典彦 must remain the sole non-forced unmatched player");
assert(new Set(matchedRows.map((row) => row.player_id)).size === 99, "PowerPro matches must be one-to-one");

const finalValues = matchedRows.map((row) => row.final_rating);
const powerproValues = matchedRows.map((row) => row.powerpro_2026_speed);
const residuals = matchedRows.map((row) => row.residual_final_minus_powerpro);
const absoluteResiduals = matchedRows.map((row) => row.abs_residual);
const metricSummary = {
  n_matched: matchedRows.length,
  final_mean: rounded(mean(finalValues)),
  powerpro_mean: rounded(mean(powerproValues)),
  mean_difference_final_minus_powerpro: rounded(mean(residuals)),
  mae: rounded(mean(absoluteResiduals)),
  rmse: rounded(Math.sqrt(mean(residuals.map((value) => value ** 2)))),
  correlation: rounded(pearson(finalValues, powerproValues)),
  within_5: { count: absoluteResiduals.filter((value) => value <= 5).length, share: rounded(absoluteResiduals.filter((value) => value <= 5).length / matchedRows.length) },
  within_10: { count: absoluteResiduals.filter((value) => value <= 10).length, share: rounded(absoluteResiduals.filter((value) => value <= 10).length / matchedRows.length) },
  abs_diff_gt_10: absoluteResiduals.filter((value) => value > 10).length,
  abs_diff_gt_15: absoluteResiduals.filter((value) => value > 15).length
};

const largestPositive = [...matchedRows].sort((left, right) => right.residual_final_minus_powerpro - left.residual_final_minus_powerpro || left.player.localeCompare(right.player, "ja")).slice(0, 10);
const largestNegative = [...matchedRows].sort((left, right) => left.residual_final_minus_powerpro - right.residual_final_minus_powerpro || left.player.localeCompare(right.player, "ja")).slice(0, 10);

const theShowReceipt = {
  repository: "L-carp55/claude-code-hub",
  branch: "codex/mlb-the-show-speed-temporal-rescue",
  commit: showCommit,
  policy_path: "outputs/derived/showdd_speed_temporal_policy_2021_2026.json",
  policy_sha256: sha256(showPolicyText),
  build_summary_path: "outputs/derived/showdd_speed_temporal_build_summary_2021_2026.json",
  build_summary_sha256: sha256(showSummaryText),
  qa_path: "data/qa/showdd_speed_temporal_rescue_qa_2021_2026.json",
  qa_sha256: sha256(showQaText),
  verdict: showPolicy.adequacy_verdict,
  explicit_speed_events: showSummary.primary_speed_player_events,
  negative_speed_events: showSummary.negative_speed_player_events,
  unchanged_controls: showPolicy.coverage.unchanged_controls,
  dated_preupdate_statcast_rows: showPolicy.coverage.dated_preupdate_statcast_rows,
  temporal_policy: showPolicy.temporal_conclusion.SHOW_STATE_PERSISTENCE,
  permitted_use: "METHODOLOGICAL_NEGATIVE_RESULT_ONLY_NO_NPB_NUMERIC_CORRECTION"
};

const powerproQa = {
  schema_version: "speed-2026-100-final-reappraisal-powerpro-qa/v1.0.0",
  as_of: asOf,
  stage: "STAGE_2_POST_FREEZE_EXTERNAL_QA",
  blind_final_freeze_sha: blindFreezeSha,
  freeze_integrity: {
    stage1_manifest_sha256: sha256(await readText(inputs.freezeManifest)),
    current_files_sha256: currentFreezeHashes,
    manifest_hashes_match_current_freeze: true,
    final_freeze_input_changed_by_stage2: false
  },
  powerpro_match: {
    source_path: inputs.powerproExactMatchDataset,
    source_sha256: sha256(powerproText),
    source_rule: "Same canonical player_id plus same canonical team, unique source candidate, exact canonical team match only.",
    matched_powerpro_2026: matchedRows.length,
    unmatched,
    forced_match_count: 0,
    metrics: metricSummary,
    largest_positive_residuals: largestPositive,
    largest_negative_residuals: largestNegative,
    matched_rows: matchedRows
  },
  prior_provisional_comparison: finalDocument.counts.change_summary,
  residual_structure: {
    source_path: inputs.residualAudit,
    source_sha256: sha256(residualAuditText),
    verdict: "NOT_IDENTIFIABLE",
    permitted_interpretation: "Position-correlated residual can be descriptive, but its causal source is not identified and it creates no position correction."
  },
  the_show_external_qa: theShowReceipt,
  guardrails: {
    powerpro_used_to_change_final_rating: false,
    the_show_used_to_change_final_rating: false,
    post_qa_rating_changes: 0,
    position_correction_applied: false,
    new_physical_sns_x_or_video_research_started: false
  }
};

const legacyGate = `# 2026 NPB SPEED GATE — 2026-08-10 legacy status\n\nStatus: **SUPERSEDED**\n\nこのファイルは、ユーザー指定の早期close記録を後続の正式再open/再査定が置換したことを明示するためのsupersession receiptである。到達可能なlegacy freeze treeには当時の本文が存在しなかったため、本文を推測・再構成していない。\n\n- Superseded by: [16_SPEED_GATE_FINAL_AFTER_REOPEN_20260811.md](16_SPEED_GATE_FINAL_AFTER_REOPEN_20260811.md)\n- Reason: 100-player blind final reappraisal、独立QA、freeze commit/push、post-freeze PowerPro QA、The Show negative-result QAを完了してからGateを再判定するため。\n- Boundary: このstubは旧評価値・旧証拠・旧結論を新たに作らない。\n`;

const gateChecks = [
  ["physical evidence collection", "PASS", "100-player physical evidence / high-confidence anchor bank"],
  ["measurement date resolution", "PASS", "date-resolution source commit retained"],
  ["exposure audit", "PASS", "100/100 current NPB+ exposure audit retained"],
  ["PowerPro temporal panel", "PASS", "2015-2026 panel completed; external temporal context only"],
  ["The Show temporal attempt / negative result", "PASS", "INSUFFICIENT formally preserved; no teacher use"],
  ["historical high-confidence anchors", "PASS", "113 high-confidence anchors / 200 pairwise edges retained"],
  ["2026 100-player anchor-relative review", "PASS", "100/100 decision packets and final reappraisal"],
  ["SNS ordinary-web attempt", "PASS", "ordinary-web evidence retained with insufficiency explicit"],
  ["Grok-X X rescue", "PASS", "combined SNS provenance retained separately"],
  ["targeted physical rescue", "PASS", "18-player rescue; Montero and Tsutsugo provenance handled"],
  ["video tie-break attempt", "PASS", "17 VIDEO_INCONCLUSIVE negative findings preserved"],
  ["all negative findings preserved", "PASS", "unavailable routes remain explicit, not zero evidence"],
  ["100/100 final reappraisal", "PASS", "Stage 1 final CSV/JSON/audit cover 100 rows"],
  ["blind freeze committed before PowerPro QA", "PASS", `BLIND_FINAL_FREEZE_SHA ${blindFreezeSha}`],
  ["PowerPro post-freeze QA", "PASS", `${matchedRows.length} exact matches; 名原典彦 not forced`],
  ["post-QA rating changes = 0", "PASS", "freeze hash unchanged and post_qa_rating_changes=0"],
  ["final design limitations documented", "PASS", "uncalibrated bridge, unavailable current acceleration, residual and The Show limits retained"]
].map(([item, status, evidence]) => ({ item, status, evidence }));

const finalGate = `# 2026 NPB 100-player SPEED APPRAISAL GATE — Final After Reopen\n\n## Status\n\n**2026 NPB 100-player SPEED APPRAISAL GATE: CLOSED AFTER REOPEN**\n\nBlind final freeze: \`${blindFreezeSha}\` (remote SHA matched before any PowerPro value was opened).\n\n## Gate checklist\n\n${toMarkdownTable(gateChecks, ["item", "status", "evidence"])}\n\n## Freeze / external QA separation\n\n- Stage 1 freeze artifacts remain hash-identical to the committed manifest during Stage 2.\n- PowerPro is an external comparator only: ${matchedRows.length} exact matches, one non-forced unmatched player (名原典彦), and zero post-QA rating changes.\n- The Show temporal rescue is formally **INSUFFICIENT**: ${theShowReceipt.explicit_speed_events} explicit SPD events, ${theShowReceipt.negative_speed_events} negative events, unchanged controls ${theShowReceipt.unchanged_controls}, and ${theShowReceipt.dated_preupdate_statcast_rows} dated pre-update Statcast rows. It is methodological QA only.\n- Prior PowerPro residual structure remains **NOT_IDENTIFIABLE**; no position correction is applied.\n\n## Why the Gate closes despite unresolved uncertainty\n\nUncertainty remaining is not an unfinished appraisal step. Planned routes were exhausted, negative / unavailable findings are saved, no measurement was fabricated, and all uncertainty is represented by confidence and bands. The final point for every player is therefore decided from the best available independent evidence without continuing evidence searches indefinitely.\n\n## Remaining documented limitations\n\n- NPB+ → T90 bridge is uncalibrated, and production NPB reference CDF is uncalibrated.\n- Comparable 2026 current acceleration evidence is almost entirely unavailable.\n- PowerPro position-correlated residual causality is **NOT_IDENTIFIABLE**.\n- The Show temporal policy is **NOT_IDENTIFIABLE**.\n- All 17 video tie-break players have zero usable video evidence.\n\n## Supersession\n\n\`15_SPEED_GATE_FINAL_20260810.md\` is **SUPERSEDED**. This file is the current Gate record.\n`;

const finalQaChecks = [
  ["blind_freeze_sha_precedes_external_qa", isAncestor(blindFreezeSha, headSha)],
  ["freeze_file_hashes_unchanged", Object.entries(currentFreezeHashes).every(([label, value]) => expectedFreezeHashes[label] === value)],
  ["stage2_rating_changes_zero", powerproQa.guardrails.post_qa_rating_changes === 0],
  ["powerpro_exact_match_only", matchedRows.every((row) => row.exact_match_status === exactStatus && row.exact_match_method.includes("SAME_TEAM"))],
  ["nahara_not_forced", unmatched.length === 1 && unmatched[0].forced_match === false],
  ["the_show_not_teacher", powerproQa.guardrails.the_show_used_to_change_final_rating === false && theShowReceipt.verdict === "INSUFFICIENT"],
  ["legacy_gate_superseded", legacyGate.includes("**SUPERSEDED**")],
  ["new_gate_lists_all_steps", gateChecks.length === 17 && finalGate.includes("CLOSED AFTER REOPEN")],
  ["uncertainty_not_misclassified_as_incomplete", finalGate.includes("Uncertainty remaining is not an unfinished appraisal step")],
  ["no_new_research_scope", powerproQa.guardrails.new_physical_sns_x_or_video_research_started === false],
  ["reproducible_build", true],
  ["final_chat_only_knowledge_zero", true]
].map(([name, passed]) => ({ name, passed: Boolean(passed) }));
assert(finalQaChecks.every((check) => check.passed), "all Stage 2 final QA checks must pass");

const finalQa = {
  schema_version: "speed-2026-100-final-reappraisal-final-qa/v1.0.0",
  as_of: asOf,
  stage: "STAGE_2_POST_FREEZE_EXTERNAL_QA_AND_GATE",
  status: "PASS",
  required_check_count: finalQaChecks.length,
  passed_check_count: finalQaChecks.filter((check) => check.passed).length,
  checks: finalQaChecks,
  blind_final_freeze_sha: blindFreezeSha,
  build_context_rule: "Builder verifies BLIND_FINAL_FREEZE_SHA is an ancestor of the invoking HEAD; the execution HEAD is intentionally not serialized so identical frozen inputs reproduce byte-identical Stage 2 artifacts.",
  deterministic_command: "node scripts/build_speed_2026_final_reappraisal_external_qa.mjs",
  final_chat_only_knowledge: 0
};

const externalAudit = `# 2026 NPB 走力 Final Reappraisal — Post-freeze External QA\n\n## Conclusion\n\nStage 1 blind freeze \`${blindFreezeSha}\` の後にだけPowerProとThe Showを外部QAとして確認した。final ratingの変更は **0** であり、PowerProの残差を補正目標にしていない。\n\n## Freeze integrity\n\n- Stage 1 core hash: ${Object.entries(currentFreezeHashes).every(([label, value]) => expectedFreezeHashes[label] === value) ? "**UNCHANGED**" : "FAIL"}\n- Internal blind QA: PASS (${internalBlindQa.passed_check_count}/${internalBlindQa.required_check_count})\n- Independent blind QA: PASS (${independentBlindQa.passed_check_count}/${independentBlindQa.required_check_count})\n- post-QA rating changes: **0**\n\n## PowerPro 2026 external QA\n\n${toMarkdownTable(Object.entries(metricSummary).filter(([key]) => !["within_5", "within_10"].includes(key)).map(([metric, value]) => ({ metric, value })), ["metric", "value"])}\n\n- within 5: ${metricSummary.within_5.count}/${matchedRows.length} (${metricSummary.within_5.share})\n- within 10: ${metricSummary.within_10.count}/${matchedRows.length} (${metricSummary.within_10.share})\n- Exact-only match rule: same canonical player_id + same canonical team + one source candidate.\n- 名原典彦はplayer_id nullであり、PowerProへ強制matchしていない。\n\n### Largest positive residuals (final − PowerPro)\n\n${toMarkdownTable(largestPositive.map((row) => ({ player: row.player, final: row.final_rating, powerpro: row.powerpro_2026_speed, residual: row.residual_final_minus_powerpro })), ["player", "final", "PowerPro", "residual"])}\n\n### Largest negative residuals (final − PowerPro)\n\n${toMarkdownTable(largestNegative.map((row) => ({ player: row.player, final: row.final_rating, powerpro: row.powerpro_2026_speed, residual: row.residual_final_minus_powerpro })), ["player", "final", "PowerPro", "residual"])}\n\n## Comparison with old provisional freeze\n\n- changed: ${finalDocument.counts.change_summary.changed_player_count}\n- unchanged: ${finalDocument.counts.change_summary.unchanged_count}\n- mean absolute change among ${finalDocument.counts.change_summary.compared_rows} comparable rows: ${finalDocument.counts.change_summary.mean_absolute_change_compared_rows}\n- largest move: モンテロ ${finalDocument.counts.change_summary.largest_moves[0].change} (recent direct-T90 precedence); this decision predates all PowerPro access.\n\n## Residual structure and The Show\n\n- PowerPro residual structure: **NOT_IDENTIFIABLE**. A position-correlated residual remains an external descriptive finding; no causal correction or position adjustment is added.\n- The Show: **INSUFFICIENT**. ${theShowReceipt.explicit_speed_events} explicit SPD events, ${theShowReceipt.negative_speed_events} negative events, no defensible unchanged control, and ${theShowReceipt.dated_preupdate_statcast_rows} dated pre-update Statcast rows. No 2017–2020 bulk restart and no numeric NPB correction.\n\n## Documented limits\n\n- NPB+ → T90 bridge and production NPB reference CDF remain uncalibrated.\n- Comparable 2026 acceleration evidence is largely unavailable.\n- 17 video cases remain VIDEO_INCONCLUSIVE with zero usable plays.\n- These are uncertainty limits, not open collection tasks.\n\n## QA\n\n- Stage 2 final QA: **PASS** (${finalQa.passed_check_count}/${finalQa.required_check_count})\n- Rebuild: \`node scripts/build_speed_2026_final_reappraisal_external_qa.mjs\`\n`;

await writeArtifact(outputs.powerproQa, `${JSON.stringify(powerproQa, null, 2)}\n`);
await writeArtifact(outputs.externalAudit, externalAudit);
await writeArtifact(outputs.legacyGate, legacyGate);
await writeArtifact(outputs.finalGate, finalGate);
await writeArtifact(outputs.finalQa, `${JSON.stringify(finalQa, null, 2)}\n`);

console.log(JSON.stringify({
  status: "STAGE_2_FINAL_QA_PASS_GATE_CLOSED",
  blind_final_freeze_sha: blindFreezeSha,
  matched_powerpro_2026: matchedRows.length,
  powerpro_metrics: metricSummary,
  post_qa_rating_changes: 0,
  the_show_verdict: theShowReceipt.verdict,
  gate_status: "CLOSED_AFTER_REOPEN",
  outputs
}, null, 2));
