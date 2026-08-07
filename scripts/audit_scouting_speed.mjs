// スカウティング走力が台帳→名前照合→カード→共通zまで実際に届くかを監査する。
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard, normName } from '../src/cards/pipeline.mjs';
import { loadLedger, lookup } from '../src/ratings/scouting_input.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const scoutingJson = JSON.parse(await readFile(path.join(ROOT, 'configs', 'scouting.json'), 'utf8'));
const ledger = loadLedger(scoutingJson);
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);

const rows = db.prepare(`SELECT DISTINCT player_id, name FROM v_batting WHERE season=2021 AND name LIKE '%鈴木%'`).all();
console.log('# 2021 鈴木姓のDB名');
for (const r of rows) console.log(`${r.player_id}\t${JSON.stringify(r.name)}\tnorm=${normName(r.name)}`);

const target = rows.find(r => normName(r.name) === normName('鈴木　誠也'));
if (!target) throw new Error('鈴木誠也2021をDBで解決できない');
const directKeyHit = lookup(ledger, target.name, 2021, '走力');
const configKeyHit = lookup(ledger, '鈴木　誠也', 2021, '走力');
console.log(`\nDB名でlookup: ${directKeyHit ? JSON.stringify({ value: directKeyHit.value, player: directKeyHit.player }) : 'null'}`);
console.log(`設定表記でlookup: ${configKeyHit ? JSON.stringify({ value: configKeyHit.value, player: configKeyHit.player }) : 'null'}`);
console.log(`文字列一致: ${target.name === '鈴木　誠也'} / 正規化一致: ${normName(target.name) === normName('鈴木　誠也')}`);

const without = appraiseCard(ctx, { playerId: target.player_id, mode: '2021', cfg, rv, runNorm, fldNorm });
const withScout = appraiseCard(ctx, { playerId: target.player_id, mode: '2021', cfg, rv, runNorm, fldNorm, scoutingLedger: ledger });
if (without.error) throw new Error(without.error);
if (withScout.error) throw new Error(withScout.error);

const a = without.card.abilities.基礎能力.走力;
const b = withScout.card.abilities.基礎能力.走力;
const ev = withScout.card.ratings.speed_evidence;
console.log('\n# カード比較');
console.log(`scoutingなし: ${a?.value ?? 'null'} (${a?.rank ?? '—'})`);
console.log(`scoutingあり: ${b?.value ?? 'null'} (${b?.rank ?? '—'}) from_scouting=${b?.from_scouting ?? false}`);
console.log(`speed_evidence.decided_by=${ev?.decided_by ?? 'null'}`);
console.log(`statistical_final=${ev?.statistical_final_scale ?? 'null'} final=${ev?.final_scale_rating ?? 'null'} z=${ev?.final_z ?? 'null'}`);
console.log(`ability_evidence.decided_by=${withScout.card.ability_evidence.走力.provenance.decided_by}`);
console.log(`scouting_prior=${JSON.stringify(withScout.card.ability_evidence.走力.scouting_prior)}`);

db.close();
