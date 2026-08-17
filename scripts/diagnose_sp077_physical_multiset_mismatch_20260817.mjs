import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const norm=v=>String(v??'').normalize('NFKC').replace(/[\s\u3000]/g,'');
const num=v=>(v===null||v===undefined||v==='')?null:(Number.isFinite(Number(v))?Number(v):null);
const arr=v=>Array.isArray(v)?v:[];
const metricText=r=>`${r?.metric??''} ${r?.metric_raw??''} ${r?.metric_canonical??''} ${r?.start_protocol??''}`;
const isShort=r=>/(^|[^0-9])(10m|20m|30m|40m|50m|60yd|60-yard)([^0-9]|$)/i.test(metricText(r));
const compactSource=r=>({measurement_year:num(r.measurement_year),metric:r.metric??r.metric_canonical??r.metric_raw??null,value:num(r.value??r.seconds),source_url:r.source_url??null,raw_id:r.raw_id??null,reclassification_status:r.reclassification_status??null,usage_class:r.usage_class??null});
const compactOut=r=>({measurement_year:num(r.measurement_year),metric:r.metric??null,value:num(r.value??r.seconds),source_url:r.source_url??null,usage_class:r.usage_class??null,confidence:r.confidence??null});
const physical=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual/npb_speed_physical_evidence_full_20260809.json'),'utf8'));
const recovered=JSON.parse(fs.readFileSync(path.join(ROOT,'outputs/derived/sp017_physical_measurement_range_reclassification.json'),'utf8'));
const queue=JSON.parse(fs.readFileSync(path.join(ROOT,'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json'),'utf8'));
for(const target of ['田宮裕涼','小園海斗']){
 const p=arr(physical.players).find(x=>norm(x.player)===target);const rec=arr(recovered.records).filter(x=>norm(x.canonical_name??x.raw_name??x.player)===target);const q=arr(queue.players).find(x=>norm(x.identity?.player)===target);
 const raw=arr(p?.records);
 console.log(JSON.stringify({player:target,source_short:[...raw.filter(isShort),...rec.filter(isShort)].map(compactSource),queue_short:arr(q?.short_distance_physical_evidence?.records).map(compactOut),source_historical:[...raw,...rec].filter(x=>{const y=num(x.measurement_year);return y==null||y<2026;}).map(compactSource),queue_historical:arr(q?.historical_physical_temporal_context?.records).map(compactOut)},null,2));
}
