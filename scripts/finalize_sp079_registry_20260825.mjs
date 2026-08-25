#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REGISTRY = path.join(ROOT, 'docs', 'state', 'speed_task_registry.tsv');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(`SP-079 finalization fail-closed: ${message}`);
}

function main() {
  const qa = readJson('outputs/derived/qa_sp079_final_practical_reappraisal.json');
  const final = readJson('outputs/derived/sp079_final_practical_speed_100.json');
  const owner = readJson('outputs/derived/sp078_owner_verdict_ledger_20260816.json');
  assert(qa.status === 'PASS_INDEPENDENT_RED_TEAM', `independent QA status=${qa.status}`);
  assert(final.players.length === 100 && final.owner_verdict_count === 0, 'final output is not exact 100 or owner count is nonzero');
  assert(owner.owner_verdict_count === 0 && (owner.records?.length ?? 0) === 0, 'owner ledger is not empty');

  const raw = fs.readFileSync(REGISTRY, 'utf8');
  const lines = raw.trimEnd().split(/\r?\n/);
  const header = lines[0].split('\t');
  const index = Object.fromEntries(header.map((key, i) => [key, i]));
  const rows = lines.slice(1).map((line) => line.split('\t'));
  const byId = new Map(rows.map((row) => [row[index.task_id], row]));
  const sp079 = byId.get('SP-079');
  const sp080 = byId.get('SP-080');
  const sp081 = byId.get('SP-081');
  const sp082 = byId.get('SP-082');
  const sp103 = byId.get('SP-103');
  const sp104 = byId.get('SP-104');
  assert(sp079 && sp080 && sp081 && sp082 && sp103 && sp104, 'required registry rows missing');
  assert(sp079[index.status] === 'PARTIAL', `SP-079 expected PARTIAL before finalization, got ${sp079[index.status]}`);
  assert(sp103[index.status] === 'DONE_VALIDATED' && sp104[index.status] === 'DONE_VALIDATED', 'SP-103/SP-104 prerequisites are not closed');
  assert(sp080[index.status] === 'NOT_STARTED' && sp081[index.status] === 'NOT_STARTED' && sp082[index.status] === 'BLOCKED_DEPENDENCY', 'SP-080/SP-081/shoulder scope changed');

  const artifactPaths = [
    'docs/tasks/CODEX_SP079_EXECUTION_20260825.md',
    'scripts/reconcile_sp079_registry_20260825.mjs',
    'scripts/sp079_final_practical_reappraisal_20260825.mjs',
    'scripts/qa_sp079_final_practical_reappraisal_20260825.mjs',
    'scripts/finalize_sp079_registry_20260825.mjs',
    'outputs/derived/sp079_appraisal_policy.json',
    'outputs/derived/sp079_frozen_input_manifest.json',
    'outputs/derived/sp079_player_evidence_synthesis.jsonl',
    'outputs/derived/sp079_final_practical_speed_100.csv',
    'outputs/derived/sp079_final_practical_speed_100.json',
    'outputs/derived/sp079_final_value_component_ablation.json',
    'outputs/derived/sp079_powerpro_posthoc_qa.json',
    'outputs/derived/sp079_global_consistency_qa.json',
    'outputs/derived/qa_sp079_final_practical_reappraisal.json',
    'docs/reports/sp079_final_practical_speed_100.md',
    'docs/audits/sp079_final_practical_reappraisal_independent_audit.md'
  ];
  const existingArtifacts = (sp079[index.artifacts] ?? '').split(';').filter(Boolean);
  sp079[index.status] = 'DONE_VALIDATED';
  sp079[index.next_action_or_blocker] = 'EVIDENCE_STATUS=DONE_VALIDATED; all 100 final practical speed rows, 800-cell actual component ablation, PowerPro posthoc-only QA, byte-identical deterministic rerun, and independent red-team audit PASS. owner_verdict_count=0 remains locked; SP-080/SP-081 and shoulder were not run.';
  sp079[index.artifacts] = [...new Set([...existingArtifacts, ...artifactPaths])].join(';');
  sp103[index.next_action_or_blocker] = 'EVIDENCE_STATUS=DONE_VALIDATED; 71-row universe remains accepted and SP-104 browser override is effective. SP-079 final practical reappraisal completed with independent QA PASS; preserve owner_verdict_count=0 and do not run SP-080/SP-081 or shoulder.';
  fs.writeFileSync(REGISTRY, `${[header.join('\t'), ...rows.map((row) => row.join('\t'))].join('\n')}\n`);
  console.log(JSON.stringify({ status: 'SP079_DONE_VALIDATED', owner_verdict_count: 0, sp079: sp079[index.status], sp080: sp080[index.status], sp081: sp081[index.status], shoulder: sp082[index.status], sp103: sp103[index.status], sp104: sp104[index.status], artifact_count: sp079[index.artifacts].split(';').length }, null, 2));
}

main();
