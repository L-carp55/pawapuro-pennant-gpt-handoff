// Idempotent syntax repair: object-literal property names 30M/50M must be quoted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rel='scripts/build_speed_all100_integrated_owner_review_20260818.mjs';
const target=path.join(ROOT,rel);
const before=fs.readFileSync(target,'utf8');
const after=before.replace(/([,{])\s*(30M|50M)\s*:/g, (_,prefix,key)=>`${prefix}'${key}':`);
if (!after.includes("'30M':") || !after.includes("'50M':")) throw new Error('numeric metric key repair did not materialize');
if (/([,{])\s*(30M|50M)\s*:/.test(after)) throw new Error('unquoted numeric-leading metric key remains');
if (after!==before) fs.writeFileSync(target,after,'utf8');
console.log(JSON.stringify({status:'PASS',changed:after!==before,target:rel}));
