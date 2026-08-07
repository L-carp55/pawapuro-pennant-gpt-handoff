import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAbilitySheet } from '../src/cards/ability_sheet.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cfg=JSON.parse(await readFile(path.join(ROOT,'configs','ratings.json'),'utf8'));
const gates=JSON.parse(await readFile(path.join(ROOT,'configs','model_gates.json'),'utf8'));

assert.equal(gates.speed_ability.status,'PROVISIONAL_REDESIGN');
assert.equal(gates.catching_ability.status,'PROVISIONAL_REDESIGN');

const sheet=buildAbilitySheet({
  bat:{meet:50,power:60,contact:50,eye:50},trajectory:2,
  run:{speed:60,stealing:{rating:50},baserunning:null},
  fld:[{pos:'SS',inn:1000,isPrimary:true,fielding:{rating:null},catching:{rating:55},arm:{rating:null}}],
  durability:0.8,
  provisionalStatus:{走力:gates.speed_ability,捕球:gates.catching_ability},
},cfg);
assert.equal(sheet.基礎能力.走力.provisional,true);
assert.equal(sheet.基礎能力.走力._status,'PROVISIONAL_REDESIGN');
assert.match(sheet.基礎能力.走力._note_provisional,/sanity|未確定|暫定/);
assert.equal(sheet.基礎能力.捕球.provisional,true);
assert.equal(sheet.基礎能力.捕球._status,'PROVISIONAL_REDESIGN');
assert.equal(sheet.基礎能力.ミート.provisional,undefined);
assert.equal(sheet.基礎能力.パワー.provisional,undefined);

console.log('provisional markers: 8 checks passed');
