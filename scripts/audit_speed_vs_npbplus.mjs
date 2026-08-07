// 走力の代理指標を、NPB+の直接計測（最高走行速度）で答え合わせする研究用監査。
// 最終能力値は生成しない。特に三塁打割合を主要材料に残す価値と、
// 1球データの内野ゴロ結果が既存proxyへ独立情報を足せるかを検査する。
//
// 使い方: node scripts/audit_speed_vs_npbplus.mjs

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const normName = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');
const pearson = pairs => {
  if (pairs.length < 5) return null;
  const xs = pairs.map(x => x[0]), ys = pairs.map(x => x[1]);
  const mx = xs.reduce((a,b)=>a+b,0)/xs.length, my = ys.reduce((a,b)=>a+b,0)/ys.length;
  let xy=0, xx=0, yy=0;
  for (let i=0;i<xs.length;i++) { const dx=xs[i]-mx, dy=ys[i]-my; xy+=dx*dy; xx+=dx*dx; yy+=dy*dy; }
  return xx>0 && yy>0 ? xy/Math.sqrt(xx*yy) : null;
};
const rank = a => {
  const s = a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]);
  const out = Array(a.length);
  for (let i=0;i<s.length;) {
    let j=i+1; while (j<s.length && s[j][0]===s[i][0]) j++;
    const r=(i+j-1)/2+1; for(let k=i;k<j;k++) out[s[k][1]]=r; i=j;
  }
  return out;
};
const spearman = pairs => pairs.length<5 ? null : pearson(rank(pairs.map(x=>x[0])).map((x,i)=>[x,rank(pairs.map(x=>x[1]))[i]]));

const direct = db.prepare(`SELECT player_id,name,top_speed_kmh,hp_to_1b_sec
  FROM npb_plus_measurement WHERE top_speed_kmh IS NOT NULL`).all();

const statStmt = db.prepare(`
  SELECT b.season,b.pa,b.ab,b.so,b.b2,b.b3,b.gdp,bm.ubr,m.gb_pct,t.ih
  FROM v_batting b
  LEFT JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  LEFT JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  WHERE b.player_id=? AND b.season BETWEEN ? AND ? AND b.position<>'投' AND b.pa>=50
  ORDER BY b.season`);

const grounderStmt = db.prepare(`
  SELECT COUNT(*) n,
         SUM(CASE WHEN kind='infield_hit' THEN 1 ELSE 0 END) ih
  FROM infield_grounder_events
  WHERE batter_norm=? AND season BETWEEN ? AND ?
    AND kind IN ('out','infield_hit')`);

function grounderEventRate(name, y0, y1) {
  const r = grounderStmt.get(normName(name), y0, y1);
  // 少数イベントをそのまま速度の証拠にしない。10件未満は欠損として比較から外す。
  if (!(r?.n >= 10)) return { rate: null, n: r?.n ?? 0 };
  return { rate: (r.ih ?? 0) / r.n, n: r.n };
}

function features(playerId, y0, y1) {
  const rows = statStmt.all(playerId,y0,y1);
  if (!rows.length) return null;
  let pa=0, inplay=0, b2=0, b3=0, gdp=0, gb=0, ubr=0, ubrHave=0, ih=0, ihHave=0;
  for (const r of rows) {
    pa += r.pa ?? 0;
    const ip = Math.max(0,(r.ab??0)-(r.so??0));
    inplay += ip; b2 += r.b2??0; b3 += r.b3??0; gdp += r.gdp??0;
    gb += ip * ((r.gb_pct ?? 45)/100);
    if (r.ubr != null) { ubr += r.ubr; ubrHave += r.pa??0; }
    if (r.ih != null) { ih += r.ih; ihHave += ip; }
  }
  if (!(pa>0)) return null;
  return {
    triple_share: b2+b3>0 ? b3/(b2+b3) : null,
    gdp_avoid: gb>0 ? -gdp/gb : null,
    ubr_pa: ubrHave>0 ? ubr/ubrHave : null,
    ih_inplay: ihHave>0 ? ih/ihHave : null,
  };
}

function fullFeatures(playerId, name, y0, y1) {
  const f = features(playerId, y0, y1);
  if (!f) return null;
  const ge = grounderEventRate(name, y0, y1);
  return { ...f, event_ih_rate: ge.rate, event_ih_n: ge.n };
}

const rows=[];
for (const d of direct) {
  const f=fullFeatures(d.player_id,d.name,2023,2025);
  if (f) rows.push({...d,...f});
}
console.log('# NPB+ direct speed proxy audit');
console.log(`direct=${direct.length} / matched recent stats=${rows.length}`);
for (const k of ['triple_share','gdp_avoid','ubr_pa','ih_inplay','event_ih_rate']) {
  const p=rows.filter(r=>Number.isFinite(r[k])).map(r=>[r[k],r.top_speed_kmh]);
  const q=rows.filter(r=>Number.isFinite(r[k]) && Number.isFinite(r.hp_to_1b_sec)).map(r=>[r[k],r.hp_to_1b_sec]);
  console.log(`${k.padEnd(14)} top_speed r=${pearson(p)?.toFixed(3) ?? '—'} n=${p.length}`
    + ` / home_to_first r=${pearson(q)?.toFixed(3) ?? '—'} n=${q.length}`);
}

// 標準化Ridge。固定係数を採用するのではなく、alpha候補を5-fold CVで比較する。
function solve(A,b) {
  const n=A.length, M=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<n;c++) {
    let p=c; for(let r=c+1;r<n;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r;
    if(Math.abs(M[p][c])<1e-12) return null;
    [M[c],M[p]]=[M[p],M[c]];
    const d=M[c][c]; for(let j=c;j<=n;j++) M[c][j]/=d;
    for(let r=0;r<n;r++) if(r!==c) { const m=M[r][c]; for(let j=c;j<=n;j++) M[r][j]-=m*M[c][j]; }
  }
  return M.map(r=>r[n]);
}
function ridgeFit(train, keys, alpha) {
  const means=keys.map(k=>train.reduce((s,r)=>s+r[k],0)/train.length);
  const sds=keys.map((k,j)=>Math.sqrt(train.reduce((s,r)=>s+(r[k]-means[j])**2,0)/train.length)||1);
  const ym=train.reduce((s,r)=>s+r.top_speed_kmh,0)/train.length;
  const X=train.map(r=>keys.map((k,j)=>(r[k]-means[j])/sds[j]));
  const y=train.map(r=>r.top_speed_kmh-ym);
  const p=keys.length, A=Array.from({length:p},()=>Array(p).fill(0)), b=Array(p).fill(0);
  for(let i=0;i<X.length;i++) for(let a=0;a<p;a++) { b[a]+=X[i][a]*y[i]; for(let c=0;c<p;c++) A[a][c]+=X[i][a]*X[i][c]; }
  for(let a=0;a<p;a++) A[a][a]+=alpha;
  const beta=solve(A,b); if(!beta) return null;
  return r=>ym+beta.reduce((s,v,j)=>s+v*((r[keys[j]]-means[j])/sds[j]),0);
}
const foldOf=id=>[...String(id)].reduce((s,c)=>s+c.charCodeAt(0),0)%5;
function cv(keys,alpha) {
  const usable=rows.filter(r=>keys.every(k=>Number.isFinite(r[k])));
  const pred=[];
  for(let f=0;f<5;f++) {
    const tr=usable.filter(r=>foldOf(r.player_id)!==f), te=usable.filter(r=>foldOf(r.player_id)===f);
    const model=ridgeFit(tr,keys,alpha); if(!model) continue;
    for(const r of te) pred.push([model(r),r.top_speed_kmh]);
  }
  const rmse=Math.sqrt(pred.reduce((s,[p,y])=>s+(p-y)**2,0)/pred.length);
  return {n:pred.length,rmse,r:pearson(pred),rho:spearman(pred)};
}
const ALPHAS=[0,1,3,10,30,100];
function bestCv(keys) {
  const all=ALPHAS.map(alpha=>({alpha,...cv(keys,alpha)}));
  return all.reduce((a,b)=>b.rmse<a.rmse?b:a);
}

const BASE_KEYS=['gdp_avoid','ubr_pa','ih_inplay'];
const EVENT_KEYS=[...BASE_KEYS,'event_ih_rate'];
for (const keys of [
  ['triple_share','gdp_avoid','ubr_pa','ih_inplay'],
  BASE_KEYS,
  EVENT_KEYS,
]) {
  console.log(`\nfeatures=${keys.join('+')}`);
  for (const a of ALPHAS) {
    const v=cv(keys,a);
    console.log(`  alpha=${String(a).padStart(3)} n=${v.n} rmse=${v.rmse.toFixed(3)} r=${v.r?.toFixed(3)} rho=${v.rho?.toFixed(3)}`);
  }
}

// sanity checkは教師ラベルにしない。2023-25の直接計測学習モデルを使い、
// 2022-24/2023-25の統計窓で3選手の相対順だけ表示する。
// event版も同時表示し、追加proxyで順位問題が本当に解けるかを確認する。
const baseBest=bestCv(BASE_KEYS);
const eventBest=bestCv(EVENT_KEYS);
const baseTrain=rows.filter(r=>BASE_KEYS.every(k=>Number.isFinite(r[k])));
const eventTrain=rows.filter(r=>EVENT_KEYS.every(k=>Number.isFinite(r[k])));
const baseModel=ridgeFit(baseTrain,BASE_KEYS,baseBest.alpha);
const eventModel=ridgeFit(eventTrain,EVENT_KEYS,eventBest.alpha);
console.log('\n# sanity ordering (not training labels)');
console.log(`base best alpha=${baseBest.alpha} rmse=${baseBest.rmse.toFixed(3)} / event best alpha=${eventBest.alpha} rmse=${eventBest.rmse.toFixed(3)}`);
for (const [y0,y1] of [[2022,2024],[2023,2025]]) {
  const base=[], evt=[];
  for (const [name,id] of [['周東 佑京','21925136'],['近本 光司',db.prepare(`SELECT player_id FROM v_batting WHERE season=2024 AND name LIKE '%近本%' LIMIT 1`).get()?.player_id],['源田 壮亮','71775134']]) {
    if (!id) continue;
    const f=fullFeatures(id,name,y0,y1); if(!f)continue;
    if(BASE_KEYS.every(k=>Number.isFinite(f[k]))) base.push({name,p:baseModel(f)});
    if(EVENT_KEYS.every(k=>Number.isFinite(f[k]))) evt.push({name,p:eventModel(f),n:f.event_ih_n});
  }
  base.sort((a,b)=>b.p-a.p); evt.sort((a,b)=>b.p-a.p);
  console.log(`${y0}-${y1} base : ${base.map(x=>`${x.name} ${x.p.toFixed(2)}km/h`).join(' > ')}`);
  console.log(`${y0}-${y1} event: ${evt.map(x=>`${x.name} ${x.p.toFixed(2)}km/h(n=${x.n})`).join(' > ')}`);
}

console.log('\n判定: event_ih_rateは既存3特徴に対する追加価値だけを見る。CVが改善してもsanity順が直らなければ本番走力には採用しない。');
db.close();
