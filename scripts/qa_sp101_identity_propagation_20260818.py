#!/usr/bin/env python3
"""Independent fail-closed audit of SP-101 current100 identity propagation.

This does not repair or regenerate SP-101. It proves whether an NPB identity that is
already linked to MLB evidence in the historical crosswalk is incorrectly emitted as
NO_MLB_PROMOTION_FOUND in the current-100 packet, and measures downstream damage.
"""
from __future__ import annotations
import csv, json, re, unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CROSSWALK = ROOT/'data/manual/sp101_npb_mlb_the_show_identity_crosswalk.csv'
CURRENT = ROOT/'outputs/derived/sp101_current100_the_show_evidence.json'
MULTI = ROOT/'outputs/derived/sp101_current100_multibridge_evidence.json'
PAIRS = ROOT/'outputs/derived/sp101_powerpro_the_show_temporal_pairs.csv'
TRANSITIONS = ROOT/'outputs/derived/sp101_npb_mlb_transition_segments.csv'
COVERAGE = ROOT/'outputs/derived/sp101_coverage_qa.json'
RECEIPT = ROOT/'outputs/derived/sp101_inference_route_execution_receipt.json'
OUT = ROOT/'outputs/derived/qa_sp101_identity_propagation_20260818.json'
AUDIT = ROOT/'docs/audits/sp101_identity_propagation_independent_audit_20260818.md'

def norm(v):
    s=unicodedata.normalize('NFKC', str(v or '')).lower()
    return re.sub(r'[\s\u3000\u200b\-‐‑‒–—_・.·,，、()（）]+','',s)

def yes(v): return str(v).strip().lower() in {'true','1','yes'}

def read_json(p): return json.loads(p.read_text(encoding='utf-8'))

def read_csv(p):
    with p.open(encoding='utf-8', newline='') as f: return list(csv.DictReader(f))

for p in [CROSSWALK,CURRENT,MULTI,PAIRS,TRANSITIONS,COVERAGE,RECEIPT]:
    if not p.exists() or p.stat().st_size == 0: raise SystemExit(f'missing/empty: {p.relative_to(ROOT)}')

cw=read_csv(CROSSWALK)
cur=read_json(CURRENT)['players']
multi=read_json(MULTI)['players']
pairs=read_csv(PAIRS)
trans=read_csv(TRANSITIONS)
coverage=read_json(COVERAGE)
receipt=read_json(RECEIPT)

hist_by_name=defaultdict(list)
for r in cw:
    if not str(r.get('current100_queue_orders') or '').strip():
        hist_by_name[norm(r.get('npb_name'))].append(r)

conflicts=[]
ambiguous=[]
positive_controls=[]
for p in cur:
    n=norm(p['player'])
    historical=[r for r in hist_by_name.get(n,[]) if yes(r.get('mlb_evidence'))]
    # Deduplicate by stable historical entity.
    by_key={r['stable_player_key']:r for r in historical}
    historical=list(by_key.values())
    if p['coverage_state']=='ELIGIBLE_MATCHED':
        positive_controls.append({'player':p['player'],'queue_order':p['queue_order'],'stable_player_key':p['stable_player_key'],'source_rows':p['the_show_implied_appraisal_range']['source_rows']})
    if not historical:
        continue
    rec={
        'player':p['player'],'queue_order':p['queue_order'],'current_stable_player_key':p['stable_player_key'],
        'current_coverage_state':p['coverage_state'],'current_identity_state':p['identity_state'],
        'current_show_source_rows':p['the_show_implied_appraisal_range']['source_rows'],
        'historical_candidates':[{
            'stable_player_key':r['stable_player_key'],'npb_name':r['npb_name'],'npb_name_en':r['npb_name_en'],
            'mlbam_ids':r['mlbam_ids'],'the_show_uuid_count':r['the_show_uuid_count'],
            'the_show_live_row_count':r['the_show_live_row_count'],'the_show_seasons':r['the_show_seasons'],
            'identity_state':r['identity_state'],'cohort':r['cohort'],'mlb_evidence':r['mlb_evidence']
        } for r in historical],
    }
    if len(historical)==1:
        h=historical[0]
        rec['classification']='DETERMINISTIC_EXISTING_NPB_NAME_BRIDGE_NOT_PROPAGATED'
        rec['show_evidence_lost']=int(h.get('the_show_live_row_count') or 0)>0 and int(p['the_show_implied_appraisal_range']['source_rows'] or 0)==0
        rec['mlb_promotion_false_negative']=p['coverage_state']=='NO_MLB_PROMOTION_FOUND'
        conflicts.append(rec)
    else:
        rec['classification']='MULTIPLE_HISTORICAL_MLB_CANDIDATES_REQUIRE_IDENTITY_REVIEW'
        ambiguous.append(rec)

multi_by_order={int(r['queue_order']):r for r in multi}
for rec in conflicts:
    m=multi_by_order.get(int(rec['queue_order']))
    if m:
        rec['downstream']={
            'residual_confidence':m['residual_confidence'],
            'sp102_target_selection_state':m['sp102_target_selection_state'],
            'sp102_target_reasons':m['sp102_target_reasons'],
            'route_disagreement_state':m['route_disagreement']['state'],
            'the_show_percentile_context':m['route_disagreement']['the_show_percentile_context'],
            'mb02_state':m['decision_use_receipt']['MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS']['state'],
            'mb04_state':m['decision_use_receipt']['MB-04_WITHIN_PLAYER_TEMPORAL_DELTA']['state'],
            'mb05_state':m['decision_use_receipt']['MB-05_LEAGUE_TRANSITION_FIXED_EFFECTS']['state'],
            'mb09_state':m['decision_use_receipt']['MB-09_THE_SHOW_ROSTER_UPDATE_RESPONSE']['state'],
            'mb16_state':m['decision_use_receipt']['MB-16_CROSS_SOURCE_CONSENSUS_AND_DISAGREEMENT']['state'],
        }

pair_players=sorted({norm(r['npb_name']) for r in pairs})
transition_dirs=Counter(r['transition_direction'] for r in trans)
transition_players=sorted({norm(r['npb_name']) for r in trans})
foreign_hist=[r for r in cw if yes(r.get('mlb_evidence')) and 'MLB_TO_NPB_FOREIGN' in str(r.get('cohort') or '')]
foreign_names=sorted({norm(r['npb_name']) for r in foreign_hist if norm(r['npb_name'])})
foreign_transition_overlap=sorted(set(foreign_names)&set(transition_players))

canaries={name:next((c for c in conflicts if norm(c['player'])==norm(name)),None) for name in ['カリステ','ポランコ','モンテロ','サンタナ']}
canary_fail=[name for name,v in canaries.items() if v is None or not v.get('mlb_promotion_false_negative')]

invalid_artifacts=[
 'outputs/derived/sp101_current100_the_show_evidence.json',
 'outputs/derived/sp101_current100_multibridge_evidence.json',
 'outputs/derived/sp101_requirements_to_decision_utilization.json',
 'outputs/derived/sp101_route_ablation_qa.json',
 'outputs/derived/sp101_residual_low_confidence_target_set.json',
 'outputs/derived/sp101_coverage_qa.json',
 'outputs/derived/sp101_inference_route_execution_receipt.json',
 'outputs/derived/sp101_npb_mlb_transition_segments.csv',
 'outputs/derived/sp101_transition_effects.json',
 'outputs/derived/sp101_powerpro_the_show_temporal_pairs.csv',
 'outputs/derived/sp101_historical_npb_the_show_calibration_panel.csv',
 'outputs/derived/sp101_pairwise_ordinal_graph.json',
 'outputs/derived/sp101_latent_multitrait_speed_model.json',
]
preserved=[
 'raw/pinned The Show source scan and normalized external panel rows (subject to identity rekey)',
 'PowerPro source rows and current physical evidence sources',
 'look-ahead quarantine and non-Live separation controls',
 'append-only SP-078 infrastructure and empty ledger',
 'the multibridge method definitions/design, but not current100 decision outputs generated from the broken entity map',
]
status='FAIL_IDENTITY_PROPAGATION_REPAIR_REQUIRED' if conflicts else 'PASS_NO_CONTRADICTION_FOUND'
result={
 'schema_version':'qa_sp101_identity_propagation_20260818','generated_at':'2026-08-18','status':status,
 'codex_claimed_coverage':coverage['current100_coverage_state_counts'],
 'independent_exact_npb_name_bridge_conflict_count':len(conflicts),
 'ambiguous_exact_name_candidate_count':len(ambiguous),
 'conflicts':conflicts,'ambiguous':ambiguous,'positive_controls':positive_controls,
 'canary_expected_false_negatives':['カリステ','ポランコ','モンテロ','サンタナ'],'canary_failures':canary_fail,
 'downstream_diagnostics':{
   'powerpro_the_show_temporal_pair_rows':len(pairs),
   'powerpro_the_show_temporal_unique_players':len(set(pair_players)),
   'transition_segment_rows':len(trans),
   'transition_unique_players':len(set(transition_players)),
   'transition_direction_counts':dict(transition_dirs),
   'historical_foreign_mlb_to_npb_names_in_crosswalk':len(foreign_names),
   'foreign_mlb_to_npb_names_represented_in_transition_panel':len(foreign_transition_overlap),
   'foreign_transition_overlap_names':foreign_transition_overlap,
 },
 'qa_gap':{
   'coverage_qa_status':coverage['status'],
   'execution_receipt_status':receipt['status'],
   'why_existing_qa_missed_it':'Existing QA checks 100 unique current rows and conservative name-only rejection, but has no referential-integrity assertion that a current NPB entity cannot be NO_MLB_PROMOTION_FOUND when the already-curated destination MLB bridge contains the same unique normalized NPB name with mlb_evidence=true.'
 },
 'invalid_or_must_regenerate_after_identity_repair':invalid_artifacts,
 'preserved_work':preserved,
 'repair_requirements':[
   'Canonicalize entity identity before loading any downstream evidence; do not create separate PROEYE and NPBNAME entities for the same uniquely resolved NPB player.',
   'Use destination curated NPB-name→MLB-person bridges and verified English/MLBAM aliases as reconciliation evidence; do not use raw surname-only matching.',
   'For every current100 row, fail closed if coverage=NO_MLB_PROMOTION_FOUND while any unique reconciled entity has mlb_evidence=true.',
   'Positive canaries 秋山翔吾 and 筒香嘉智 must remain matched.',
   'False-negative canaries カリステ, ポランコ, モンテロ, サンタナ must no longer be NO_MLB_PROMOTION_FOUND; propagate The Show rows where available and THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH otherwise.',
   'ソト remains unresolved unless independently resolved; do not guess from short name alone.',
   'Rebuild transition, temporal-pair, current100 multibridge, decision-use, ablation, residual-target, coverage and execution receipts from the repaired entity graph.',
   'Rerun determinism and all existing SP-077/SP-078 governance QA; owner ledger must remain empty; do not run SP-102/SP-079/shoulder.'
 ]
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8')

lines=[
 '# SP-101 independent identity-propagation audit — 2026-08-18','',
 f'Status: **{status}**','',
 '## Executive finding','',
 f'The SP-101 run emitted {coverage["current100_coverage_state_counts"].get("ELIGIBLE_MATCHED",0)} ELIGIBLE_MATCHED / {coverage["current100_coverage_state_counts"].get("IDENTITY_UNRESOLVED",0)} IDENTITY_UNRESOLVED / {coverage["current100_coverage_state_counts"].get("NO_MLB_PROMOTION_FOUND",0)} NO_MLB_PROMOTION_FOUND, but the canonical crosswalk itself contains exact normalized NPB-name historical entities with MLB evidence that were not merged into current PROEYE entities.',
 '',f'Independent deterministic existing-bridge contradictions: **{len(conflicts)}**.','',
 '## Deterministic conflicts','',
 '| player | current key | historical key | current state | historical Show rows | lost Show evidence |',
 '|---|---|---|---|---:|---|',
]
for c in conflicts:
    h=c['historical_candidates'][0]
    lines.append(f"| {c['player']} | `{c['current_stable_player_key']}` | `{h['stable_player_key']}` | {c['current_coverage_state']} | {h['the_show_live_row_count']} | {c['show_evidence_lost']} |")
lines += ['','## Downstream consequence','',
 f'- PowerPro↔The Show temporal pairs: {len(pairs)} rows / {len(set(pair_players))} unique normalized NPB names.',
 f'- Transition panel: {len(trans)} segments / {len(set(transition_players))} players; directions={dict(transition_dirs)}.',
 f'- Historical crosswalk contains {len(foreign_names)} MLB_TO_NPB_FOREIGN names, but only {len(foreign_transition_overlap)} appear in the transition panel.',
 '- Therefore the Current-100 The Show packet, transition model, temporal pairing, per-player route disagreement, decision-use/ablation and SP-102 target freeze are not approval-ready and must be regenerated after identity repair.',
 '', '## What remains valid','']
lines += [f'- {x}' for x in preserved]
lines += ['','## Repair gate','']+[f'- {x}' for x in result['repair_requirements']]
lines += ['','Machine receipt: `outputs/derived/qa_sp101_identity_propagation_20260818.json`','']
AUDIT.parent.mkdir(parents=True,exist_ok=True)
AUDIT.write_text('\n'.join(lines),encoding='utf-8')

print(json.dumps({'status':status,'conflicts':len(conflicts),'canary_failures':canary_fail,'transition_directions':dict(transition_dirs),'foreign_transition_overlap':len(foreign_transition_overlap)},ensure_ascii=False))
if conflicts:
    raise SystemExit(2)
