import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { physicalRunningPerformance, validateRunningResponseConfig } from '../src/engine/running_response.mjs';

const cfg=JSON.parse(readFileSync(new URL('../configs/baseball_running_response.json',import.meta.url),'utf8'));
let checks=0;
const near=(a,b,e=1e-6)=>{assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

assert.doesNotThrow(()=>validateRunningResponseConfig(cfg));checks++;

const avg=physicalRunningPerformance({topSpeedZ:0,accelerationZ:0},cfg);
eq(avg.status,'COMPLETE');near(avg.performance_z,0);

const top=physicalRunningPerformance({topSpeedZ:1,accelerationZ:0},cfg);
near(top.performance_z,0.95612);

const accel=physicalRunningPerformance({topSpeedZ:0,accelerationZ:1},cfg);
near(accel.performance_z,0.21059);

const both=physicalRunningPerformance({topSpeedZ:1,accelerationZ:1},cfg);
near(both.performance_z,1.16671);
assert.ok(both.performance_z>top.performance_z);checks++;

const missingAccel=physicalRunningPerformance({topSpeedZ:2,accelerationZ:null},cfg);
eq(missingAccel.status,'PARTIAL_MISSING_PHYSICAL_AXIS');
eq(missingAccel.performance_z,null);
near(missingAccel.partial.top_speed_contribution,1.91224);

const missingTop=physicalRunningPerformance({topSpeedZ:null,accelerationZ:2},cfg);
eq(missingTop.performance_z,null);
eq(missingTop.partial,null);

assert.throws(()=>validateRunningResponseConfig({...cfg,calibrated:false}),/not calibrated/);checks++;
assert.throws(()=>validateRunningResponseConfig({...cfg,model:{...cfg.model,top_speed_coef:null}}),/top_speed_coef/);checks++;

console.log(`running response: ${checks} checks passed`);
