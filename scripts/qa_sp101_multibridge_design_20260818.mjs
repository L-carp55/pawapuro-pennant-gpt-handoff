import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = rel => path.join(ROOT, rel);
const read = rel => fs.readFileSync(p(rel), 'utf8');
const json = rel => JSON.parse(read(rel));
const sha = text => createHash('sha256').update(text).digest('hex');

const paths = {
  activation: 'docs/state/speed_sp101_activation_state_20260818.json',
  addendum: 'docs/tasks/SP101_MULTI_BRIDGE_INFERENCE_ADDENDUM_20260818.md',
  routes: 'outputs/derived/sp101_inference_route_registry_20260818.json',
  feasibility: 'outputs/derived/sp101_common_metric_bridge_feasibility_20260818.json',
  feasibilityAudit: 'docs/audits/sp101_common_metric_bridge_feasibility_20260818.md',
  registry: 'docs/state/speed_task_registry.tsv',
  lock: 'docs/state/speed_owner_review_integrity_lock_20260817.json',
  ledger: 'outputs/derived/sp078_owner_verdict_ledger_20260816.json'
};

for (const [name, rel] of Object.entries(paths)) {
  if (!fs.existsSync(p(rel))) throw new Error(`${name}: missing ${rel}`);
  if (fs.statSync(p(rel)).size === 0) throw new Error(`${name}: empty ${rel}`);
}

const activation = json(paths.activation);
const routes = json(paths.routes);
const feasibility = json(paths.feasibility);
const lock = json(paths.lock);
const ledgerText = read(paths.ledger);
const ledger = JSON.parse(ledgerText);

if (activation.status !== 'DISPATCH_READY_WITH_MANDATORY_MULTI_BRIDGE_ADDENDUM') throw new Error(`activation status=${activation.status}`);
if (activation.mandatory_task_addendum !== paths.addendum) throw new Error('activation/addendum path mismatch');
if (activation.inference_route_registry !== paths.routes) throw new Error('activation/route registry path mismatch');
if (activation.common_metric_feasibility_receipt !== paths.feasibility) throw new Error('activation/feasibility path mismatch');
if (activation.common_metric_feasibility_audit !== paths.feasibilityAudit) throw new Error('activation/feasibility audit mismatch');

if (routes.status !== 'DESIGN_REGISTERED_NOT_YET_EXECUTED') throw new Error(`route registry status=${routes.status}`);
if (!Array.isArray(routes.routes) || routes.routes.length !== 18) throw new Error(`route count=${routes.routes?.length}`);
const routeIds = routes.routes.map(r => `${r.route_id}_${r.name}`);
if (new Set(routeIds).size !== routeIds.length) throw new Error('duplicate route id/name');
const p0FromRoutes = routes.routes.filter(r => r.priority === 'P0').map(r => `${r.route_id}_${r.name}`).sort();
const p0FromActivation = [...activation.mandatory_route_policy.p0_routes].sort();
if (JSON.stringify(p0FromRoutes) !== JSON.stringify(p0FromActivation)) {
  throw new Error(`P0 route mismatch\nregistry=${p0FromRoutes.join(',')}\nactivation=${p0FromActivation.join(',')}`);
}
for (const id of ['MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE','MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS','MB-03_MULTI_TRAIT_LATENT_MEASUREMENT_MODEL','MB-18_DECISION_USE_AND_ABLATION_RECEIPT']) {
  if (!routeIds.includes(id)) throw new Error(`mandatory route missing: ${id}`);
}

if (feasibility.status !== 'FEASIBLE_AS_GAME_APPRAISAL_QA_NOT_PHYSICAL_TRUTH') throw new Error(`feasibility status=${feasibility.status}`);
if (feasibility.decision?.route_id !== 'MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE' || feasibility.decision?.priority !== 'P0') throw new Error('MB-01 feasibility decision invalid');
if (feasibility.available_data_counts?.same_year_powerpro_batting_rows !== 1879) throw new Error('same-year PowerPro/batting count changed');
if (feasibility.proofs_of_concept?.the_show_speed_vs_statcast_sprint_speed?.population == null) throw new Error('The Show/Sprint POC missing');
if (!(feasibility.proofs_of_concept?.npb_common_metric_neighborhood_to_powerpro_speed?.r_squared > 0.45)) throw new Error('analog POC below declared feasibility floor');

if (lock.locked !== true || lock.reason_code !== 'THE_SHOW_ELIGIBLE_UNIVERSE_UNDERCOUNT_AND_EVIDENCE_UTILIZATION_INCOMPLETE') throw new Error('owner review lock not preserved');
if (ledger.owner_verdict_count !== 0 || ledger.records?.length !== 0) throw new Error('owner ledger not empty');

const lines = read(paths.registry).replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/).map(line => line.split('\t'));
const header = lines[0];
const rows = lines.slice(1).map(cells => Object.fromEntries(header.map((h,i) => [h,cells[i]])));
const sp101 = rows.filter(r => r.task_id === 'SP-101');
const sp079 = rows.find(r => r.task_id === 'SP-079');
if (sp101.length !== 1 || sp101[0].status !== 'PARTIAL' || sp101[0].owner_review_block !== '1' || sp101[0].gate_block !== '1') throw new Error('canonical SP-101 row invalid');
if (!sp079 || sp079.status !== 'BLOCKED_DEPENDENCY' || sp079.owner_review_block !== '1' || sp079.gate_block !== '1' || !sp079.depends_on.split(/[,;]/).includes('SP-101')) throw new Error('SP-079 dependency invalid');

const addendum = read(paths.addendum);
for (const needle of [
  'COMMON_METRIC_NEIGHBORHOOD_BRIDGE',
  'The Show-implied appraisal range',
  'Historical PowerPro-behavior expectation range',
  'mutual k-nearest neighbors',
  'optimal-transport',
  'no forced analog outside the caliper',
  '100-player × route decision-use matrix'
]) {
  if (!addendum.includes(needle)) throw new Error(`addendum missing requirement: ${needle}`);
}

const receipt = {
  schema_version: 'qa_sp101_multibridge_design_20260818',
  generated_at: new Date().toISOString(),
  status: 'PASS',
  route_count: routes.routes.length,
  p0_route_count: p0FromRoutes.length,
  p0_routes: p0FromRoutes,
  feasibility: {
    the_show_sprint_pearson_r: feasibility.proofs_of_concept.the_show_speed_vs_statcast_sprint_speed.pearson_r,
    npb_analog_group_cv_r2: feasibility.proofs_of_concept.npb_common_metric_neighborhood_to_powerpro_speed.r_squared,
    npb_analog_group_cv_mae: feasibility.proofs_of_concept.npb_common_metric_neighborhood_to_powerpro_speed.mae_powerpro_points
  },
  governance: {
    owner_review_locked: lock.locked,
    owner_verdict_count: ledger.owner_verdict_count,
    sp101_status: sp101[0].status,
    sp079_status: sp079.status,
    shoulder_work: false
  },
  source_hashes: Object.fromEntries(Object.entries(paths).map(([name,rel]) => [name, sha(read(rel))]))
};

const out = p('outputs/derived/qa_sp101_multibridge_design_20260818.json');
fs.mkdirSync(path.dirname(out), {recursive:true});
fs.writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
