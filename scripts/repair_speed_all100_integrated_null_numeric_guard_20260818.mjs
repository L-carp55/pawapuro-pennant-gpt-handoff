// Idempotent repair: JavaScript Number(null) is 0, but missing evidence/targets must stay null.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rel='scripts/build_speed_all100_integrated_owner_review_20260818.mjs';
const target=path.join(ROOT,rel);
const before=fs.readFileSync(target,'utf8');
const oldLine="const finite = v => Number.isFinite(Number(v)) ? Number(v) : null;";
const newLine="const finite = v => (v === null || v === undefined || v === '') ? null : (Number.isFinite(Number(v)) ? Number(v) : null);";
let after=before;
if(after.includes(oldLine)) after=after.replace(oldLine,newLine);
if(!after.includes(newLine)) throw new Error('null-preserving finite() guard not present');
if(after!==before) fs.writeFileSync(target,after,'utf8');
console.log(JSON.stringify({status:'PASS',changed:after!==before,target:rel}));
