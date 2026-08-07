import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateFieldingResponseSurface,
  fieldingOutProbability,
  invertFieldingRating,
} from '../src/engine/fielding_response.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const placeholder=JSON.parse(await readFile(path.join(ROOT,'configs','fielding_response_surface.json'),'utf8'));
assert.throws(()=>validateFieldingResponseSurface(placeholder),/未較正/,'本番placeholderは較正まで拒否');

// テスト専用の合成surface。ここに置く数値は本番係数ではなく、補間と単調性を検査するfixtureのみ。
const surface={
  calibrated:true,
  axes:{difficulty:[0,0.5,1],speed:[20,60,100],fielding:[20,60,100]},
  probabilities:[
    [[0.50,0.65,0.80],[0.60,0.75,0.88],[0.70,0.84,0.94]],
    [[0.25,0.42,0.60],[0.35,0.54,0.70],[0.48,0.65,0.80]],
    [[0.05,0.12,0.22],[0.10,0.20,0.32],[0.17,0.30,0.44]],
  ],
};
assert.equal(validateFieldingResponseSurface(surface),true);

const base=fieldingOutProbability({difficulty:0.5,speed:60,fielding:60},surface);
const faster=fieldingOutProbability({difficulty:0.5,speed:80,fielding:60},surface);
const better=fieldingOutProbability({difficulty:0.5,speed:60,fielding:80},surface);
const harder=fieldingOutProbability({difficulty:0.8,speed:60,fielding:60},surface);
assert.ok(faster>base,'同じ守備力なら走力上昇で到達率が上がる');
assert.ok(better>base,'同じ走力でも守備力上昇で到達率が上がる');
assert.ok(harder<base,'難しい打球ほどアウト率が下がる');

const target=fieldingOutProbability({difficulty:0.5,speed:60,fielding:73},surface);
const recovered=invertFieldingRating({targetProbability:target,difficulty:0.5,speed:60},surface);
assert.ok(Math.abs(recovered-73)<1e-6,`逆算で守備力を復元: ${recovered}`);
assert.equal(invertFieldingRating({targetProbability:0.99,difficulty:1,speed:20},surface),null,'表現範囲外の能力を端へ押し込まない');
assert.throws(()=>fieldingOutProbability({difficulty:1.2,speed:60,fielding:60},surface),/範囲/,'較正範囲外を外挿しない');

const broken=structuredClone(surface);
broken.probabilities[1][1][2]=0.20; // fieldingを上げると悪化
assert.throws(()=>validateFieldingResponseSurface(broken),/守備力に対して非単調/);

console.log('fielding response surface: 9 checks passed');
