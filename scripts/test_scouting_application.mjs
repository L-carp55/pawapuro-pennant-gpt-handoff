// スカウティング値が evidence_only と decision を区別し、直接計測を最優先することを固定する。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEntry, reconcile } from '../src/ratings/scouting_input.mjs';
import { reconcileSpeedEvidence, speedRawToFinalScale } from '../src/ratings/speed_evidence.mjs';
import { buildAbilityEvidence } from '../src/ratings/ability_evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const scouting = JSON.parse(await readFile(path.join(ROOT, 'configs', 'scouting.json'), 'utf8'));
const base = { player: 'X', season: 2024, ability: '走力', value: 68, evaluator: 'owner', basis: 'test', source: 'test' };

const evidenceOnly = validateEntry({ ...base, application: 'evidence_only' });
const decision = validateEntry({ ...base, application: 'decision' });
assert.equal(evidenceOnly.application, 'evidence_only');
assert.equal(decision.application, 'decision');
assert.throws(() => validateEntry({ ...base, application: 'bad' }), /application/);

// generic reconcile: evidence_onlyは統計値を数値決定に使い、証拠自体は残す。
const rEvidence = reconcile(55, evidenceOnly);
assert.equal(rEvidence.value, 55);
assert.equal(rEvidence.source, 'statistical');
assert.equal(rEvidence.scouting.application, 'evidence_only');
const rDecision = reconcile(55, decision);
assert.equal(rDecision.value, 68);
assert.match(rDecision.source, /scouting/);

const stat = { rating: 55, zFinal: 0.1, detail: {} };
// speed path: evidence_onlyなら統計を変えない。
const sEvidence = reconcileSpeedEvidence(stat, { scouting: evidenceOnly }, cfg);
assert.equal(sEvidence.evidence.decided_by, 'statistical');
assert.equal(sEvidence.finalRating, speedRawToFinalScale(55, cfg));
// decisionならスカウティング値を使える。
const sDecision = reconcileSpeedEvidence(stat, { scouting: decision }, cfg);
assert.equal(sDecision.evidence.decided_by, 'scouting');
assert.equal(sDecision.finalRating, 68);
// 第1階層の直接計測が同時にあるなら、decision scoutingよりdirectを優先。
const direct = { value: 75, source: 'MLB Statcast Sprint Speed' };
const sBoth = reconcileSpeedEvidence(stat, { scouting: decision, direct }, cfg);
assert.equal(sBoth.evidence.decided_by, 'direct_blend');
assert.match(sBoth.evidence.external_source, /Statcast/);

// ability_evidenceでもevidence_onlyをposterior候補にしないが、scouting_prior欄には残す。
const ev = buildAbilityEvidence({
  ability: '走力',
  prior: { value: 68, tier: 'scouting_document', application: 'evidence_only', source: 'test', basis: 'prior only' },
  proxies: { value: 55, components: ['proxy'], reliability: 0.35 },
});
assert.notEqual(ev.provenance.decided_by, 'scouting_document');
assert.equal(ev.scouting_prior.application, 'evidence_only');
assert.equal(ev.scouting_prior.value, 68);

// 現行の鈴木誠也2件は明示的にevidence_only。
assert.equal(scouting.entries.length, 2);
assert.ok(scouting.entries.every(e => e.application === 'evidence_only'));

console.log('scouting application: 18 checks passed');
