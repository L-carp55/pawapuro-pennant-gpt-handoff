// 最高速度(top-speed)と短距離加速(5->30ft residual)を、野球距離の直線走パフォーマンスへどう統合するか監査する。
// 50m走は使わない。ターゲットは batter-box exitの影響を減らした 5->90ft = 85ft（約25.9m）。
// ベース間90ftに近い距離の「身体的な直線走」の応答として使う。
//
// player-level 5-foldで:
//   A: 5->90 performance_z ~ Sprint Speed_z
//   B: 5->90 performance_z ~ Sprint Speed_z + acceleration_z
//   C: B + interaction
// を比較。係数は各foldのtrainだけでfitする。
//
// acceleration_z:
//   5->30ft time ~ Sprint Speed_z + bat side + year
// の残差を反転・標準化（高いほど、同じ最高速度でも加速区間が速い）。
//
// 最終100段階は作らない。ここでは物理軸→野球距離走行のresponseだけを測る。

const YEARS=[2017,2018,2019,2020,2021,2022,2023,2024,2025];
const finite=Number.isFinite;
function splitCsvLine(line){const out=[];let f='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'){if(line[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){out.push(f);f='';}else f+=c;}out.push(f);return out;}
const linesOf=t=>t.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(Boolean);
function parseSplits(text,year){const lines=linesOf(text),h=splitCsvLine(lines[0]),I=n=>h.indexOf(n),i5=I('seconds_since_hit_005'),i30=I('seconds_since_hit_030'),i90=I('seconds_since_hit_090');return lines.slice(1).map(line=>{const r=splitCsvLine(line),t5=Number(r[i5]),t30=Number(r[i30]),t90=Number(r[i90]);return{year,player_id:String(r[I('player_id')]),bats:r[I('bat_side')],early:t30-t5,post_exit:t90-t5};}).filter(r=>finite(r.early)&&finite(r.post_exit));}
function parseSprint(text,year){const lines=linesOf(text),h=splitCsvLine(lines[0]),I=n=>h.indexOf(n);return lines.slice(1).map(line=>{const r=splitCsvLine(line);return{year,player_id:String(r[I('player_id')]),sprint:Number(r[I('sprint_speed')])};}).filter(r=>finite(r.sprint));}
async function fetchText(url,label){const r=await fetch(url,{headers:{'user-agent':'pawapuro-pennant-gpt-handoff research audit'}});if(!r.ok)throw new Error(`${label}: HTTP ${r.status}`);return r.text();}
function solve(A,b){const n=A.length,M=A.map((r,i)=>[...r,b[i]]);for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;if(Math.abs(M[p][c])<1e-12)return null;[M[c],M[p]]=[M[p],M[c]];const d=M[c][c];for(let j=c;j<=n;j++)M[c][j]/=d;for(let r=0;r<n;r++)if(r!==c){const m=M[r][c];for(let j=c;j<=n;j++)M[r][j]-=m*M[c][j];}}return M.map(r=>r[n]);}
function fit(rows,feature,target,lambda=0){const p=feature(rows[0]).length,A=Array.from({length:p},()=>Array(p).fill(0)),B=Array(p).fill(0);for(const r of rows){const x=feature(r),y=r[target];for(let i=0;i<p;i++){B[i]+=x[i]*y;for(let j=0;j<p;j++)A[i][j]+=x[i]*x[j];}}for(let i=1;i<p;i++)A[i][i]+=lambda;const beta=solve(A,B);return beta?{beta,predict:r=>feature(r).reduce((s,x,i)=>s+x*beta[i],0)}:null;}
function meanSd(a){const v=a.filter(finite),m=v.reduce((s,x)=>s+x,0)/v.length,sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1))||1;return{m,sd,n:v.length};}
function cor(p){if(p.length<3)return null;const mx=p.reduce((s,x)=>s+x[0],0)/p.length,my=p.reduce((s,x)=>s+x[1],0)/p.length;let xy=0,xx=0,yy=0;for(const[x,y]of p){const a=x-mx,b=y-my;xy+=a*b;xx+=a*a;yy+=b*b;}return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;}
function rmse(p){return Math.sqrt(p.reduce((s,[x,y])=>s+(x-y)**2,0)/p.length);}
function foldOf(id){let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return Math.abs(h)%5;}

const splits=[],sprints=[];
for(const year of YEARS){const[a,b]=await Promise.all([
  fetchText(`https://baseballsavant.mlb.com/running_splits?type=raw&bats=&year=${year}&position=&team=&min=5&csv=true`,`splits ${year}`),
  fetchText(`https://baseballsavant.mlb.com/sprint_speed_leaderboard?year=${year}&position=&team=&min=5&csv=true`,`sprint ${year}`)]);
  splits.push(...parseSplits(a,year));sprints.push(...parseSprint(b,year));
}
const sprintBy=new Map(sprints.map(r=>[`${r.player_id}|${r.year}`,r.sprint]));
const rows=splits.map(r=>({...r,sprint:sprintBy.get(`${r.player_id}|${r.year}`)})).filter(r=>finite(r.sprint));
console.log(`# rows=${rows.length} players=${new Set(rows.map(r=>r.player_id)).size}`);

const predictions={top:[],two:[],interaction:[]};
for(let fold=0;fold<5;fold++){
  const train=rows.filter(r=>foldOf(r.player_id)!==fold),test=rows.filter(r=>foldOf(r.player_id)===fold),years=[...new Set(train.map(r=>r.year))].sort();
  const stat=new Map();for(const y of years){const a=train.filter(r=>r.year===y);stat.set(y,{s:meanSd(a.map(r=>r.sprint)),p:meanSd(a.map(r=>r.post_exit))});}
  const enrich=r=>{const st=stat.get(r.year);if(!st)return null;return{...r,sprint_z:(r.sprint-st.s.m)/st.s.sd,post_exit_z:-(r.post_exit-st.p.m)/st.p.sd};}; // high = faster
  const tr=train.map(enrich).filter(Boolean),te=test.map(enrich).filter(Boolean);
  // acceleration nuisance fit on train. time residual negative=faster, so accel_z is -resid/sd.
  const early=fit(tr,r=>[1,r.sprint_z,r.bats==='L'?1:0,...years.slice(1).map(y=>r.year===y?1:0)],'early');
  const residTr=tr.map(r=>r.early-early.predict(r)),rs=meanSd(residTr);
  for(const r of tr)r.accel_z=-(r.early-early.predict(r)-rs.m)/rs.sd;
  for(const r of te)r.accel_z=-(r.early-early.predict(r)-rs.m)/rs.sd;

  const models={
    top: fit(tr,r=>[1,r.sprint_z],'post_exit_z',3),
    two: fit(tr,r=>[1,r.sprint_z,r.accel_z],'post_exit_z',3),
    interaction: fit(tr,r=>[1,r.sprint_z,r.accel_z,r.sprint_z*r.accel_z],'post_exit_z',3),
  };
  for(const [name,m] of Object.entries(models))for(const r of te)predictions[name].push([m.predict(r),r.post_exit_z]);
}
for(const [name,p] of Object.entries(predictions))console.log(`${name.padEnd(12)} n=${p.length} r=${cor(p).toFixed(4)} rmse_z=${rmse(p).toFixed(4)}`);

// Full-data response coefficients for diagnostics. 年内標準化で物差しを統一。
const stats=new Map();for(const y of YEARS){const a=rows.filter(r=>r.year===y);stats.set(y,{s:meanSd(a.map(r=>r.sprint)),p:meanSd(a.map(r=>r.post_exit))});}
const full=rows.map(r=>{const st=stats.get(r.year);return{...r,sprint_z:(r.sprint-st.s.m)/st.s.sd,post_exit_z:-(r.post_exit-st.p.m)/st.p.sd};});
const early=fit(full,r=>[1,r.sprint_z,r.bats==='L'?1:0,...YEARS.slice(1).map(y=>r.year===y?1:0)],'early');
const rs=meanSd(full.map(r=>r.early-early.predict(r)));for(const r of full)r.accel_z=-(r.early-early.predict(r)-rs.m)/rs.sd;
const response=fit(full,r=>[1,r.sprint_z,r.accel_z],'post_exit_z',3);
console.log(`\nfull standardized response: post_exit_performance_z = ${response.beta[0].toFixed(5)} + ${response.beta[1].toFixed(5)}*top_speed_z + ${response.beta[2].toFixed(5)}*accel_z`);
console.log(`relative absolute coefficient share (diagnostic only): top=${(Math.abs(response.beta[1])/(Math.abs(response.beta[1])+Math.abs(response.beta[2]))).toFixed(3)} accel=${(Math.abs(response.beta[2])/(Math.abs(response.beta[1])+Math.abs(response.beta[2]))).toFixed(3)}`);

// axes independence / observed segment relation
console.log(`top_speed_z vs accel_z r=${cor(full.map(r=>[r.sprint_z,r.accel_z])).toFixed(4)}`);
console.log(`top_speed_z vs post_exit_perf r=${cor(full.map(r=>[r.sprint_z,r.post_exit_z])).toFixed(4)}`);
console.log(`accel_z vs post_exit_perf r=${cor(full.map(r=>[r.accel_z,r.post_exit_z])).toFixed(4)}`);

console.log('\n判定: top+accelがtop-onlyをplayer-holdoutで明確に改善した場合、1つの表示走力は任意重みではなく「予測5→90ft physical performance」を経由して作る。加速不明の選手は推測で埋めず不確実性/欠損を保持する。');
