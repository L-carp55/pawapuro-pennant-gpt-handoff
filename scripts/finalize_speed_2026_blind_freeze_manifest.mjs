#!/usr/bin/env node
/**
 * Finalize the Stage 1 freeze only after an independent blind QA artifact is
 * present.  This script does not alter any player rating or band.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const asOf = "2026-08-11";
const abs = (relativePath) => path.join(root, relativePath);
const sha256 = (body) => createHash("sha256").update(body).digest("hex");
const readText = async (relativePath) => readFile(abs(relativePath), "utf8");
const readJson = async (relativePath) => JSON.parse(await readText(relativePath));
const writeText = async (relativePath, body) => writeFile(abs(relativePath), body, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

const paths = {
  finalCsv: "outputs/derived/speed_2026_100_final_reappraisal_freeze_20260811.csv",
  finalJson: "outputs/derived/speed_2026_100_final_reappraisal_freeze_20260811.json",
  audit: "docs/audits/speed_2026_100_final_reappraisal_freeze_20260811.md",
  internalQa: "outputs/derived/speed_2026_100_final_reappraisal_blind_qa_20260811.json",
  independentQa: "data/manual/speed_2026_final_reappraisal_blind_independent_qa_20260811.json",
  manifest: "outputs/derived/speed_2026_100_blind_final_freeze_manifest_20260811.json",
  builder: "scripts/build_speed_2026_final_reappraisal_freeze.mjs",
  finalizer: "scripts/finalize_speed_2026_blind_freeze_manifest.mjs"
};

const [finalDocument, internalQa, independentQa, auditText] = await Promise.all([
  readJson(paths.finalJson),
  readJson(paths.internalQa),
  readJson(paths.independentQa),
  readText(paths.audit)
]);

assert(finalDocument.stage === "STAGE_1_BLIND_FINAL_FREEZE", "wrong final document stage");
assert(finalDocument.players.length === 100, "final document must retain 100 rows");
assert(internalQa.status === "PASS" && internalQa.checks.every((check) => check.passed), "internal blind QA must pass");
assert(independentQa.status === "PASS" && independentQa.checks.every((check) => check.passed), "independent blind QA must pass");
assert(auditText.includes("<!-- INDEPENDENT_QA_PLACEHOLDER -->"), "audit must be freshly rebuilt before finalization");

const independentSection = `- Status: **PASS** (${independentQa.passed_check_count}/${independentQa.required_check_count})\n- Artifact: \`${paths.independentQa}\`\n- Independent reviewer opened only Stage 1 allowlisted evidence and freeze artifacts; no external game value was used.\n`;
const finalizedAudit = `${auditText.replace("<!-- INDEPENDENT_QA_PLACEHOLDER -->", independentSection).replace(/\n+$/u, "")}\n`;
await writeText(paths.audit, finalizedAudit);

const fileBodies = Object.fromEntries(await Promise.all(Object.entries(paths)
  .filter(([label]) => !["manifest", "independentQa"].includes(label))
  .map(async ([label, relativePath]) => [label, await readText(relativePath)])));

const manifest = {
  schema_version: "speed-2026-100-blind-final-freeze-manifest/v1.0.0",
  as_of: asOf,
  stage: "STAGE_1_BLIND_FINAL_FREEZE",
  status: "READY_FOR_BLIND_FREEZE_COMMIT",
  blind_final_freeze_sha: null,
  source_commits: finalDocument.source_commits,
  stage1_isolation: {
    powerpro_not_read: true,
    powerpro_fields_absent_from_final_rows: true,
    the_show_not_used: true,
    no_post_freeze_external_qa_read_before_commit: true
  },
  final_row_count: finalDocument.players.length,
  rating_distribution: finalDocument.counts.rating_distribution,
  confidence_counts: finalDocument.counts.confidence_counts,
  decision_class_counts: finalDocument.counts.decision_class_counts,
  point_changes_vs_prior_provisional: finalDocument.counts.change_summary,
  qa: {
    internal: { path: paths.internalQa, status: internalQa.status, passed_check_count: internalQa.passed_check_count, required_check_count: internalQa.required_check_count },
    independent: { path: paths.independentQa, status: independentQa.status, passed_check_count: independentQa.passed_check_count, required_check_count: independentQa.required_check_count }
  },
  files_sha256: Object.fromEntries(Object.entries(fileBodies).map(([label, body]) => [label, sha256(body)])),
  finalization_rule: "This manifest is committed and pushed before any PowerPro or other external QA file is opened."
};

await writeText(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({
  status: "STAGE_1_READY_FOR_COMMIT",
  final_rows: manifest.final_row_count,
  internal_qa: manifest.qa.internal,
  independent_qa: manifest.qa.independent,
  files_hashed: Object.keys(manifest.files_sha256)
}, null, 2));
