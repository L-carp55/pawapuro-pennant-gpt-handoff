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
TRANSITION_EFFECTS = ROOT/'outputs/derived/sp101_transition_effects.json'
COVERAGE = ROOT/'outputs/derived/sp101_coverage_qa.json'
RECEIPT = ROOT/'outputs/derived/sp101_inference_route_execution_receipt.json'
OUT = ROOT/'outputs/derived/qa_sp101_identity_propagation_20260818.json'
AUDIT = ROOT/'docs/audits/sp101_identity_propagation_independent_audit_20260818.md'
REPAIRED_OUT = ROOT/'outputs/derived/qa_sp101_identity_propagation_repaired_20260818.json'
REPAIRED_AUDIT = ROOT/'docs/audits/sp101_identity_propagation_repaired_audit_20260818.md'

def norm(v):
    s=unicodedata.normalize('NFKC', str(v or '')).lower()
    return re.sub(r'[\s\u3000\u200b\-‐‑‒–—_・.·,，、()（）]+','',s)

def yes(v): return str(v).strip().lower() in {'true','1','yes'}

def read_json(p): return json.loads(p.read_text(encoding='utf-8'))

def read_csv(p):
    with p.open(encoding='utf-8', newline='') as f: return list(csv.DictReader(f))

for p in [CROSSWALK,CURRENT,MULTI,PAIRS,TRANSITIONS,TRANSITION_EFFECTS,COVERAGE,RECEIPT]:
    if not p.exists() or p.stat().st_size == 0: raise SystemExit(f'missing/empty: {p.relative_to(ROOT)}')

cw=read_csv(CROSSWALK)
current_doc=read_json(CURRENT)
cur=current_doc['players']
repaired_mode=str(current_doc.get('schema_version') or '').startswith('sp101_current100_the_show_evidence_repaired_')
multi=read_json(MULTI)['players']
pairs=read_csv(PAIRS)
trans=read_csv(TRANSITIONS)
transition_effects=read_json(TRANSITION_EFFECTS)
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
foreign_cohort=transition_effects.get('cohort_denominators',{}).get('FOREIGN_MLB_TO_NPB',{})
foreign_screened_count=int(foreign_cohort.get('screened',len(foreign_names)) or 0)
foreign_represented_count=int(foreign_cohort.get('represented',len(foreign_transition_overlap)) or 0)

canary_names=['カリステ','ポランコ','モンテロ','サンタナ']
current_by_name={norm(p.get('player')):p for p in cur}
if repaired_mode:
    canaries={name:current_by_name.get(norm(name)) for name in canary_names}
    canary_fail=[name for name,v in canaries.items() if v is None or v.get('coverage_state') == 'NO_MLB_PROMOTION_FOUND' or not str(v.get('stable_player_key') or '').startswith('PROEYE:')]
    canary_states={name:(v or {}).get('coverage_state') for name,v in canaries.items()}
else:
    canaries={name:next((c for c in conflicts if norm(c['player'])==norm(name)),None) for name in canary_names}
    canary_fail=[name for name,v in canaries.items() if v is None or not v.get('mlb_promotion_false_negative')]
    canary_states={name:(v or {}).get('current_coverage_state') for name,v in canaries.items()}

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
if repaired_mode:
    status='PASS_REPAIRED_NO_CONTRADICTION_FOUND' if not conflicts and not canary_fail else 'FAIL_REPAIRED_IDENTITY_PROPAGATION'
    output_path=REPAIRED_OUT
    audit_path=REPAIRED_AUDIT
else:
    status='FAIL_IDENTITY_PROPAGATION_REPAIR_REQUIRED' if conflicts else 'PASS_NO_CONTRADICTION_FOUND'
    output_path=OUT
    audit_path=AUDIT
result={
 'schema_version':'qa_sp101_identity_propagation_repaired_20260818' if repaired_mode else 'qa_sp101_identity_propagation_20260818','generated_at':'2026-08-18','status':status,
 'mode':'repaired_run' if repaired_mode else 'historical_failure_audit',
 'historical_failure_receipt_retained':True,
 'codex_claimed_coverage':coverage['current100_coverage_state_counts'],
 'independent_exact_npb_name_bridge_conflict_count':len(conflicts),
 'ambiguous_exact_name_candidate_count':len(ambiguous),
 'conflicts':conflicts,'ambiguous':ambiguous,'positive_controls':positive_controls,
 'canary_contract':'all four must be reconciled and must not be NO_MLB_PROMOTION_FOUND' if repaired_mode else 'historical false-negative canaries are expected to be present in this pre-repair audit','canary_current_states':canary_states,'canary_failures':canary_fail,
 'downstream_diagnostics':{
   'powerpro_the_show_temporal_pair_rows':len(pairs),
   'powerpro_the_show_temporal_unique_players':len(set(pair_players)),
   'transition_segment_rows':len(trans),
   'transition_unique_players':len(set(transition_players)),
   'transition_direction_counts':dict(transition_dirs),
   'historical_foreign_mlb_to_npb_names_in_crosswalk':foreign_screened_count,
   'foreign_mlb_to_npb_names_represented_in_transition_panel':foreign_represented_count,
   'foreign_transition_overlap_names':foreign_transition_overlap,
   'foreign_cohort_source':foreign_cohort.get('screened_source','transition_effects.cohort_denominators'),
 },
 'qa_gap':{
   'coverage_qa_status':coverage['status'],
   'execution_receipt_status':receipt['status'],
   'why_existing_qa_missed_it':'Existing QA checks 100 unique current rows and conservative name-only rejection, but has no referential-integrity assertion that a current NPB entity cannot be NO_MLB_PROMOTION_FOUND when the already-curated destination MLB bridge contains the same unique normalized NPB name with mlb_evidence=true.'
 },
 'invalid_or_must_regenerate_after_identity_repair':[] if repaired_mode else invalid_artifacts,
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
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(result,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8')

if repaired_mode:
    lines=[
     '# SP-101 repaired identity-propagation audit — 2026-08-18','',
     f'Status: **{status}**','',
     '## Repaired-run finding','',
     f'The repaired SP-101 run emitted {coverage["current100_coverage_state_counts"].get("ELIGIBLE_MATCHED",0)} ELIGIBLE_MATCHED / {coverage["current100_coverage_state_counts"].get("IDENTITY_UNRESOLVED",0)} IDENTITY_UNRESOLVED / {coverage["current100_coverage_state_counts"].get("NO_MLB_PROMOTION_FOUND",0)} NO_MLB_PROMOTION_FOUND.',
     f'Independent exact-bridge contradictions remaining: **{len(conflicts)}**; repaired canary failures: **{len(canary_fail)}**.','',
     '## Repaired canaries','',
     '| player | coverage state | stable key |',
     '|---|---|---|',
    ]
    for name in canary_names:
        value=canaries.get(name) or {}
        lines.append(f"| {name} | {value.get('coverage_state','MISSING')} | `{value.get('stable_player_key','')}` |")
    lines += ['','## Downstream receipt','',
     f'- PowerPro↔The Show temporal pairs: {len(pairs)} rows / {len(set(pair_players))} unique normalized NPB names.',
     f'- Transition panel: {len(trans)} segments / {len(set(transition_players))} players; directions={dict(transition_dirs)}.',
     f'- The foreign MLB→NPB cohort screen contains {foreign_screened_count} names, with {foreign_represented_count} represented and {foreign_screened_count-foreign_represented_count} bounded missing.',
     '- Current-100 identity-dependent packets, transitions, decision-use/ablation and target freeze were regenerated from the repaired entity graph.',
     '- The historical pre-repair failure receipt and audit remain unchanged at their original paths.',
     '', '## Gate','']
else:
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
     f'- The foreign MLB→NPB cohort screen contains {foreign_screened_count} names, but only {foreign_represented_count} appear in the transition panel.',
     '- Therefore the Current-100 The Show packet, transition model, temporal pairing, per-player route disagreement, decision-use/ablation and SP-102 target freeze are not approval-ready and must be regenerated after identity repair.',
     '', '## What remains valid','']
    lines += [f'- {x}' for x in preserved]
    lines += ['','## Repair gate','']
lines += [f'- {x}' for x in result['repair_requirements']]
lines += ['',f'Machine receipt: `{output_path.relative_to(ROOT)}`','']
audit_path.parent.mkdir(parents=True,exist_ok=True)
audit_path.write_text('\n'.join(lines),encoding='utf-8')

print(json.dumps({'status':status,'mode':'repaired_run' if repaired_mode else 'historical_failure_audit','conflicts':len(conflicts),'canary_failures':canary_fail,'transition_directions':dict(transition_dirs),'foreign_transition_overlap':foreign_represented_count,'output':str(output_path.relative_to(ROOT))},ensure_ascii=False))
if conflicts or canary_fail:
    raise SystemExit(2)
