import assert from 'node:assert/strict';
import { poolAnnualOutcome, inferSpeedAndSkills } from '../src/ratings/speed_skill_factor.mjs';

let checks=0;
const eq=(a,b,msg)=>{assert.equal(a,b,msg);checks++;};
const near=(a,b,e=1e-9,msg)=>{assert.ok(Math.abs(a-b)<=e,msg??`${a} != ${b}`);checks++;};

// ---- annual pooling: skillは消さずannual noiseだけ減らすためのnoise factor ----
const p1=poolAnnualOutcome([{value:1,weight:100,season:2023}]);
near(p1.value,1); near(p1.noise_factor,1); eq(p1.seasons.length,1);

const p2=poolAnnualOutcome([
  {value:1,weight:100,season:2023},
  {value:3,weight:100,season:2024},
]);
near(p2.value,2); near(p2.noise_factor,.5); eq(p2.seasons.join(','),'2023,2024');

const p3=poolAnnualOutcome([
  {value:0,weight:100,season:2022},
  {value:2,weight:300,season:2023},
]);
near(p3.value,1.5); near(p3.noise_factor,.625);
eq(poolAnnualOutcome([]),null);

const cal={
  speed_prior:{mean:0,variance:1},
  metrics:{
    infield_hit:{intercept:0,loading:.5,skill_variance:.25,annual_noise_variance:.75},
    baserunning:{intercept:0,loading:.4,skill_variance:.10,annual_noise_variance:.90},
    gdp_avoid:{intercept:0,loading:.3,skill_variance:.30,annual_noise_variance:.70},
  },
};

// speedが同じでもIH skillだけ高くできること。
const a=inferSpeedAndSkills({
  infield_hit:{value:1.5,noise_factor:.5,seasons:[2023,2024]},
  baserunning:{value:.4,noise_factor:.5,seasons:[2023,2024]},
  gdp_avoid:{value:.3,noise_factor:.5,seasons:[2023,2024]},
},cal);
assert.ok(a.speed_z>0);checks++;
assert.ok(a.skills.infield_hit.z>a.skills.baserunning.z);checks++;
assert.ok(a.skills.infield_hit.z>a.skills.gdp_avoid.z);checks++;
eq(a.used_metrics.length,3);

// 複数年化でannual noiseが下がるぶんspeed posteriorのSDは小さくなる。
const one=inferSpeedAndSkills({
  infield_hit:{value:.5,noise_factor:1},
  baserunning:{value:.4,noise_factor:1},
},cal);
const multi=inferSpeedAndSkills({
  infield_hit:{value:.5,noise_factor:.25},
  baserunning:{value:.4,noise_factor:.25},
},cal);
assert.ok(multi.speed_sd<one.speed_sd);checks++;

// stable skill varianceは複数年で0にしてはいけない。
near(multi.evidence.infield_hit.marginal_variance,.25+.75*.25);
assert.ok(multi.evidence.infield_hit.marginal_variance>.75*.25);checks++;

// skillをspeedへ足し戻さない: IHだけ極端に高い観測でもskill posteriorが独立に残る。
const skillHeavy=inferSpeedAndSkills({
  infield_hit:{value:3,noise_factor:.25},
  baserunning:{value:0,noise_factor:.25},
  gdp_avoid:{value:0,noise_factor:.25},
},cal);
assert.ok(skillHeavy.skills.infield_hit.z>0.5);checks++;
assert.ok(skillHeavy.speed_z<3);checks++;

// 欠損は0とみなさず無視。
const missing=inferSpeedAndSkills({infield_hit:{value:null},baserunning:{value:.4,noise_factor:1}},cal);
eq(missing.used_metrics.join(','),'baserunning');

// calibrationが無ければフェイルファスト。
assert.throws(()=>inferSpeedAndSkills({},{}),/calibration\.metrics/);checks++;
assert.throws(()=>inferSpeedAndSkills({infield_hit:{value:1,noise_factor:0}},cal),/noise_factor/);checks++;

console.log(`speed-skill factor: ${checks} checks passed`);
