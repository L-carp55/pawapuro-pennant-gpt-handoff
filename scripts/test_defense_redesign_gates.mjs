import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appraiseAllPositions } from '../src/ratings/fielding.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cfg=JSON.parse(await readFile(path.join(ROOT,'configs','ratings.json'),'utf8'));
const norm=JSON.parse(await readFile(path.join(ROOT,'configs','fielding_norms.json'),'utf8'));
const gates=JSON.parse(await readFile(path.join(ROOT,'configs','model_gates.json'),'utf8'));

assert.equal(gates.fielding_ability.enabled,false);
assert.equal(gates.infield_arm_ability.enabled,false);
assert.equal(gates.catching_ability.enabled,true);

const ss=[{
  season:2024,pos:'SS',inn:1000,rngr:5,errr:1,arm:null,dpr:1,
  framing:null,blocking:null,chances:500,dps:25,dpt:30,
}];
const a=appraiseAllPositions(ss,0,norm,cfg,gates)[0];
assert.equal(a.fielding.rating,null,'旧守備力は最終値に出さない');
assert.ok(Number.isFinite(a.fielding.legacy_rating),'旧守備力は監査用legacyとして保持');
assert.equal(a.arm.rating,null,'内野位置推定肩は最終値に出さない');
assert.ok(Number.isFinite(a.arm.legacy_rating),'位置推定肩は監査用legacyとして保持');
assert.ok(Number.isFinite(a.catching.rating),'捕球は再設計中でもprovisional値を保持');
assert.equal(a.catching._status,'PROVISIONAL_REDESIGN');

const cf=[{
  season:2024,pos:'CF',inn:1000,rngr:5,errr:0.1,arm:3,dpr:null,
  framing:null,blocking:null,chances:300,
}];
const b=appraiseAllPositions(cf,0,norm,cfg,gates)[0];
assert.equal(b.fielding.rating,null,'外野も旧RngR-speed守備力は停止');
assert.ok(Number.isFinite(b.fielding.legacy_rating));
assert.ok(Number.isFinite(b.arm.rating),'実測ARM由来の肩は停止しない');
assert.equal(b.arm.is_estimated,undefined);

console.log('defense redesign gates: 12 checks passed');
