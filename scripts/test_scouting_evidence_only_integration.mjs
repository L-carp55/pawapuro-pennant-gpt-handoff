// 現行scouting.jsonの鈴木誠也68/88は「Prior/常識チェック」であり、カードを全置換しないことを確認。
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';
import { loadLedger } from '../src/ratings/scouting_input.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const ledger = loadLedger(JSON.parse(await readFile(path.join(ROOT, 'configs', 'scouting.json'), 'utf8')));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);

const without = appraiseCard(ctx, { name: '鈴木　誠也', mode: '2021', cfg, rv, runNorm, fldNorm });
const withScout = appraiseCard(ctx, { name: '鈴木　誠也', mode: '2021', cfg, rv, runNorm, fldNorm, scoutingLedger: ledger });
assert.ok(!without.error, without.error);
assert.ok(!withScout.error, withScout.error);

const a = without.card, b = withScout.card;
// evidence_onlyなので走力/肩力の最終数値は変えない。
assert.equal(b.abilities.基礎能力.走力.value, a.abilities.基礎能力.走力.value);
assert.equal(b.abilities.基礎能力.肩力.value, a.abilities.基礎能力.肩力.value);
assert.equal(b.abilities.基礎能力.走力.from_scouting, undefined);
assert.equal(b.ratings.speed_evidence.decided_by, 'statistical');

// ただし手査定68/88は消さず、証拠束へ残す。
assert.equal(b.ability_evidence.走力.scouting_prior.value, 68);
assert.equal(b.ability_evidence.走力.scouting_prior.application, 'evidence_only');
assert.equal(b.ability_evidence.肩力.scouting_prior.value, 88);
assert.equal(b.ability_evidence.肩力.scouting_prior.application, 'evidence_only');
assert.notEqual(b.ability_evidence.走力.provenance.decided_by, 'scouting_document');
assert.notEqual(b.ability_evidence.肩力.provenance.decided_by, 'scouting_document');

console.log(`scouting evidence-only integration: 10 checks passed; speed=${b.abilities.基礎能力.走力.value}, arm=${b.abilities.基礎能力.肩力.value}`);
db.close();
