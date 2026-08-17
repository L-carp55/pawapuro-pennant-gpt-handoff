// Source-derived semantic QA for SP-077 Community propagation.
// Prevents structural "lane exists" PASS when canonical clean-X rows are
// silently dropped or misclassified inside the lane.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'outputs/derived/speed_x_current_powerpro_clean_20260816.jsonl';
const SP075 = 'outputs/derived/sp075_stale_conflict_rediagnosis_v4_20260816.json';
const QUEUE = 'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json';
const OUT = 'outputs/derived/qa_sp077_community_semantic_propagation_20260817.json';
const AUDIT = 'docs/audits/sp077_community_semantic_propagation_qa_20260817.md';
const norm = v => String(v ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const activeDispositions = new Set(['CURRENT_POWERPRO_RATING','CURRENT_REALWORLD_SPEED_PHYSICAL','CURRENT_TECHNIQUE_CONTEXT']);
const sourceRows = read(SRC).split(/\r?\n/).filter(Boolean).map((line,i)=>{try{return JSON.parse(line);}catch(e){throw new Error(`${SRC}:${i+1} ${e.message}`);}});
const sp075 = JSON.parse(read(SP075));
const queue = JSON.parse(read(QUEUE));
const active = sourceRows.filter(r => r.current_100 === true && r.usable_for_current100 === true && activeDispositions.has(String(r.owner_disposition ?? '')));
const errors=[]; const checks=[];
const check=(label,ok,detail='')=>{checks.push({label,pass:!!ok,detail:String(detail??'')}); if(!ok) errors.push(`${label}: ${detail}`);};

check('queue schema', queue?.schema_version === 'sp077_construct_complete_owner_review_queue_20260817', queue?.schema_version);
check('queue population', Array.isArray(queue?.players) && queue.players.length===100, queue?.players?.length);
check('source active rows match SP-075', active.length === Number(sp075?.community_effects?.active_x_rows), `${active.length} vs ${sp075?.community_effects?.active_x_rows}`);
check('source active record ids unique', new Set(active.map(r=>r.record_id)).size===active.length, active.length);
const sourcePlayerNames = new Set(active.map(r=>norm(r.player_name)));
check('source active players match SP-075', sourcePlayerNames.size === Number(sp075?.community_effects?.owner_review_context_players), `${sourcePlayerNames.size} vs ${sp075?.community_effects?.owner_review_context_players}`);

const queueByName = new Map((queue.players??[]).map(r=>[norm(r.identity?.player),r]));
const expectedByPlayer = new Map();
for(const r of active){
  const k=norm(r.player_name);
  if(!expectedByPlayer.has(k)) expectedByPlayer.set(k,[]);
  expectedByPlayer.get(k).push(r);
}
const categoryFor = disposition => disposition === 'CURRENT_REALWORLD_SPEED_PHYSICAL' ? 'physical_observation_rows'
  : disposition === 'CURRENT_TECHNIQUE_CONTEXT' ? 'technique_context_rows'
  : disposition === 'CURRENT_POWERPRO_RATING' ? 'powerpro_rating_context_rows' : null;

let expectedTotal=0, actualTotal=0;
for(const q of queue.players??[]){
  const k=norm(q.identity?.player);
  const expected=expectedByPlayer.get(k)??[];
  expectedTotal += expected.length;
  const c=q.community_physical_context;
  check(`${q.identity?.player} community lane exists`, !!c, '');
  if(!c) continue;
  const actual=[...(c.physical_observation_rows??[]),...(c.technique_context_rows??[]),...(c.powerpro_rating_context_rows??[])];
  actualTotal += actual.length;
  check(`${q.identity?.player} active_source_row_count`, Number(c.active_source_row_count)===expected.length, `${c.active_source_row_count} vs ${expected.length}`);
  check(`${q.identity?.player} evidence_state`, c.evidence_state === (expected.length ? 'AVAILABLE_BOUNDED':'MISSING_BOUNDED'), c.evidence_state);
  const expectedIds=new Set(expected.map(r=>r.record_id));
  const actualIds=new Set(actual.map(r=>r.record_id));
  check(`${q.identity?.player} record-id multiset size`, actual.length===expected.length && actualIds.size===actual.length, `actual=${actual.length} expected=${expected.length}`);
  check(`${q.identity?.player} no missing source ids`, [...expectedIds].every(id=>actualIds.has(id)), [...expectedIds].filter(id=>!actualIds.has(id)).join(','));
  check(`${q.identity?.player} no extra queue ids`, [...actualIds].every(id=>expectedIds.has(id)), [...actualIds].filter(id=>!expectedIds.has(id)).join(','));
  for(const src of expected){
    const field=categoryFor(src.owner_disposition);
    const target=(c[field]??[]).find(x=>x.record_id===src.record_id);
    check(`${src.record_id} category`, !!target, field);
    if(!target) continue;
    check(`${src.record_id} disposition`, target.disposition===src.owner_disposition, `${target.disposition} vs ${src.owner_disposition}`);
    check(`${src.record_id} claim_lane`, target.claim_lane===(src.claim_lane??src.source_claim_lane??null), `${target.claim_lane} vs ${src.claim_lane??src.source_claim_lane}`);
    check(`${src.record_id} text`, target.text===(src.text_or_excerpt??null), 'text mismatch');
    check(`${src.record_id} url`, target.url===(src.source_url??null), 'url mismatch');
    check(`${src.record_id} source_date`, target.source_date===(src.published_at??src.temporal_context??null), `${target.source_date} vs ${src.published_at}`);
    check(`${src.record_id} usable`, target.usable_for_current100===true, target.usable_for_current100);
  }
}
check('global active source/queue row count', actualTotal===active.length && expectedTotal===active.length, `source=${active.length} expected=${expectedTotal} queue=${actualTotal}`);

const known = [
  ['中川圭太','physical_observation_rows'],
  ['古賀悠斗','physical_observation_rows'],
  ['山口航輝','physical_observation_rows'],
  ['山口航輝','technique_context_rows'],
  ['塩見泰隆','physical_observation_rows'],
  ['岩田幸宏','physical_observation_rows'],
  ['柳田悠岐','physical_observation_rows'],
];
for(const [name,field] of known){
  const q=queueByName.get(norm(name));
  const srcExpected=(expectedByPlayer.get(norm(name))??[]).filter(r=>categoryFor(r.owner_disposition)===field);
  check(`regression source fixture ${name} ${field}`, srcExpected.length>0, `source rows=${srcExpected.length}`);
  check(`regression queue fixture ${name} ${field}`, (q?.community_physical_context?.[field]??[]).length===srcExpected.length && srcExpected.length>0,
    `queue=${q?.community_physical_context?.[field]?.length??0} source=${srcExpected.length}`);
}

const byDisposition=Object.fromEntries([...activeDispositions].map(d=>[d,active.filter(r=>r.owner_disposition===d).length]));
const output={
  schema_version:'qa_sp077_community_semantic_propagation_20260817', generated_at:'2026-08-17', status:errors.length?'FAIL':'PASS',
  source:{path:SRC,active_rule:'current_100=true && usable_for_current100=true && owner_disposition in SP-075 active dispositions',active_rows:active.length,active_players:sourcePlayerNames.size,by_disposition:byDisposition},
  queue:QUEUE, sp075_expected:{active_x_rows:sp075?.community_effects?.active_x_rows,owner_review_context_players:sp075?.community_effects?.owner_review_context_players},
  checks_total:checks.length, checks_passed:checks.filter(x=>x.pass).length, checks_failed:errors.length, errors, checks,
};
fs.mkdirSync(path.dirname(path.join(ROOT,OUT)),{recursive:true}); fs.writeFileSync(path.join(ROOT,OUT),JSON.stringify(output,null,2)+'\n');
const md=[
  '# SP-077 Community semantic propagation QA — 2026-08-17','',`Status: **${output.status}**`,`Checks: ${output.checks_passed}/${output.checks_total} PASS; ${output.checks_failed} FAIL`,'',
  `- canonical active source rows: ${active.length}`,
  `- canonical active players: ${sourcePlayerNames.size}`,
  `- dispositions: ${JSON.stringify(byDisposition)}`,
  '- comparison is record_id exact and category exact; lane existence alone cannot pass.','',
  ...(errors.length?['## Errors','',...errors.map(e=>`- ${e}`),'']:[]),
].join('\n');
fs.mkdirSync(path.dirname(path.join(ROOT,AUDIT)),{recursive:true}); fs.writeFileSync(path.join(ROOT,AUDIT),md+'\n');
console.log(JSON.stringify({status:output.status,active_rows:active.length,active_players:sourcePlayerNames.size,checks_total:output.checks_total,checks_failed:output.checks_failed}));
if(errors.length) process.exit(1);
