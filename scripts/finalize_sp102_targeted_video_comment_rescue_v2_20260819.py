#!/usr/bin/env python3
from __future__ import annotations
import csv,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'outputs'/'derived';REG=ROOT/'docs/state/speed_task_registry.tsv'
def j(p):return json.loads(p.read_text(encoding='utf-8'))
contract=j(OUT/'qa_sp102_binding_contract_20260819.json')
if contract.get('status')!='PASS_SP102_BINDING_CONTRACT':raise RuntimeError('binding contract QA has not passed')
# Reuse the earlier governance-preserving finalizer after stronger binding QA passes.
subprocess.run([sys.executable,str(ROOT/'scripts/finalize_sp102_targeted_video_comment_rescue_20260819.py')],check=True)
raw=REG.read_text(encoding='utf-8-sig').strip().splitlines();head=raw[0].split('\t');rs=[dict(zip(head,x.split('\t'))) for x in raw[1:]];by={r['task_id']:r for r in rs};sp=by['SP-102']
arts=[x for x in sp.get('artifacts','').replace(',', ';').split(';') if x]
for a in ['outputs/derived/sp102_video_candidate_manifest.json','outputs/derived/sp102_video_comment_collection_manifest.json','outputs/derived/sp102_video_comment_normalized.jsonl','outputs/derived/sp102_origin_event_clusters.json','outputs/derived/sp102_player_evidence_summary.json','outputs/derived/sp102_primary_source_discovery_receipts.json','outputs/derived/sp102_decision_use_and_ablation.json','outputs/derived/sp102_coverage_qa.json','docs/audits/sp102_targeted_video_comment_rescue.md','outputs/derived/sp102_query_contract_coverage_20260819.json','outputs/derived/sp102_canonical_determinism_qa_20260819.json','outputs/derived/qa_sp102_binding_contract_20260819.json']:
    if a not in arts:arts.append(a)
sp['artifacts']=';'.join(arts)
sp['next_action_or_blocker'] += ' Binding-task canonical contract QA PASS: canonical video manifest/collection manifest/normalized evidence/origin clusters/player summaries/primary-discovery receipts/decision-use ablation/coverage QA/audit are committed; deterministic re-materialization from frozen collection snapshot is byte-identical.'
REG.write_text('\n'.join(['\t'.join(head)]+['\t'.join(str(r.get(h,'')).replace('\t',' ').replace('\n',' ') for h in head) for r in rs])+'\n',encoding='utf-8')
print(json.dumps({'status':sp['status'],'binding_contract':contract['status'],'SP-079':by['SP-079']['status'],'SP-082':by['SP-082']['status']},ensure_ascii=False))
