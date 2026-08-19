#!/usr/bin/env python3
from __future__ import annotations
import csv,gzip,json,sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'outputs'/'derived';O=OUT/'qa_sp102_binding_contract_20260819.json'
def j(p):return json.loads(p.read_text(encoding='utf-8'))
def jl(p):return [json.loads(x) for x in p.read_text(encoding='utf-8').splitlines() if x.strip()]
def reg():return {r['task_id']:r for r in csv.DictReader((ROOT/'docs/state/speed_task_registry.tsv').open(encoding='utf-8-sig'),delimiter='\t')}
checks=[]
def ck(n,ok,d=None):checks.append({'name':n,'pass':bool(ok),'detail':d})
def youtube_url(url):return (urlparse(str(url or '')).hostname or '').lower() in {'youtube.com','www.youtube.com','m.youtube.com'}
normalized_path=OUT/'sp102_video_comment_normalized.jsonl'
required=[OUT/'sp102_video_candidate_manifest.json',OUT/'sp102_video_comment_collection_manifest.json',normalized_path,OUT/'sp102_origin_event_clusters.json',OUT/'sp102_player_evidence_summary.json',OUT/'sp102_primary_source_discovery_receipts.json',OUT/'sp102_decision_use_and_ablation.json',OUT/'sp102_coverage_qa.json',ROOT/'docs/audits/sp102_targeted_video_comment_rescue.md']
missing=[p for p in required if not p.exists()]
empty_non_jsonl=[p for p in required if p != normalized_path and p.exists() and p.stat().st_size==0]
ck('all_binding_outputs_exist',not missing and not empty_non_jsonl,[str(p.relative_to(ROOT)) for p in missing+empty_non_jsonl])
raw_evidence_path=OUT/'sp102_comment_evidence_records.jsonl.gz'
with gzip.open(raw_evidence_path,'rt',encoding='utf-8') as f:
    raw_evidence_count=sum(bool(line.strip()) for line in f)
ck('empty_normalized_jsonl_requires_zero_raw_evidence',normalized_path.exists() and (normalized_path.stat().st_size>0 or raw_evidence_count==0),{'raw_evidence_records':raw_evidence_count,'normalized_bytes':normalized_path.stat().st_size if normalized_path.exists() else None})
target=j(OUT/'sp101_residual_low_confidence_target_set.json');targeted=[p for p in target['players'] if p.get('comment_search_allowed_in_SP102') is True];non=[p for p in target['players'] if not p.get('comment_search_allowed_in_SP102')];tkeys={p['stable_player_key'] for p in targeted};nkeys={p['stable_player_key'] for p in non}
manifest=j(OUT/'sp102_video_candidate_manifest.json');attempts=manifest.get('search_attempts',[]);aby=Counter(r['stable_player_key'] for r in attempts)
ck('frozen_30_70_contract',len(targeted)==30 and len(non)==70 and not(tkeys&nkeys))
ck('every_target_searched_explicit_denominator',set(aby)==tkeys and min(aby.values(),default=0)>=3,dict(aby))
ck('zero_result_queries_retained',manifest.get('search_attempt_count')==len(attempts) and all('result_count' in r and 'error' in r for r in attempts))
ck('no_non_target_query',not any(r.get('stable_player_key') in nkeys for r in attempts))
query_cov=j(OUT/'sp102_query_contract_coverage_20260819.json');qplayers=query_cov.get('players',[])
ck('query_contract_coverage_exact_30',len(qplayers)==30 and {p['stable_player_key'] for p in qplayers}==tkeys)
ck('compact_name_variant_covered',all(p.get('compact_name_variant_searched') is True for p in qplayers))
ck('current_team_query_covered_or_measured_missing',all('current_team_query' in p for p in qplayers))
foreign={'ソト','ファビアン','モンテロ'}
ck('foreign_romanized_alias_queries_covered',all(p.get('romanized_english_aliases_searched') for p in qplayers if p['player'] in foreign),{p['player']:p.get('romanized_english_aliases_searched') for p in qplayers if p['player'] in foreign})
ck('nickname_gap_not_fabricated',all('NO_CURATED_NICKNAME_SOURCE' in p.get('nickname_search_status','') for p in qplayers))

norm=jl(normalized_path);allowed_layers={'VIDEO_NARRATION_OR_EDITORIAL','QUOTED_2CH_5CH_THREAD_TEXT','YOUTUBE_TOP_LEVEL_COMMENT','YOUTUBE_COMMENT_REPLY'};allowed_classes={'CURRENT_REALWORLD_SPEED_PHYSICAL','CURRENT_INITIAL_ACCELERATION_OR_H2F','CURRENT_END_TO_END_OR_FULL_EFFORT','CURRENT_TECHNIQUE_CONTEXT','HISTORICAL_TRAJECTORY','INJURY_AGE_DECLINE_CONTEXT','RELATIVE_ORDINAL_COMPARISON','CURRENT_POWERPRO_RATING_OPINION','PRIMARY_SOURCE_DISCOVERY','AMBIGUOUS_TIME_OR_PLAYER','REPOST_OR_QUOTE_NOT_INDEPENDENT','MEME_SARCASM_JOKE','GENERAL_FANDOM_NO_SPEED_CLAIM','SPAM_OR_BOT'}
ck('normalized_records_targeted_only',all(r.get('stable_player_key') in tkeys for r in norm))
ck('source_layers_separate_and_valid',all(r.get('source_layer') in allowed_layers for r in norm),sorted({r.get('source_layer') for r in norm}))
ck('semantic_classes_valid',all(r.get('semantic_class') in allowed_classes for r in norm),sorted({r.get('semantic_class') for r in norm}))
comments=[r for r in norm if r.get('source_layer') in {'YOUTUBE_TOP_LEVEL_COMMENT','YOUTUBE_COMMENT_REPLY'}]
ck('fresh_youtube_provenance_only',all(r.get('reused_existing_corpus') is False and r.get('source_origin')=='FRESH_TARGETED_YOUTUBE' and youtube_url(r.get('source_url')) for r in comments),[r.get('record_id') for r in comments if r.get('reused_existing_corpus') is not False or r.get('source_origin')!='FRESH_TARGETED_YOUTUBE' or not youtube_url(r.get('source_url'))])
ck('no_public_username_profile_persistence',all(r.get('public_username_persisted') is False and 'author' not in r and 'author_id' not in r for r in comments))
ck('comment_origin_token_is_only_cluster_token',all('commenter_origin_cluster_token' in r for r in comments))
ck('comment_never_direct_measurement_or_numeric_rating',all(r.get('direct_physical_measurement') is False and r.get('final_numeric_rating_allowed') is False for r in comments))
ck('likes_not_independent_votes',all(r.get('reaction_volume_used_as_independent_evidence') is False for r in norm))
ck('field_50m_not_converted',all(r.get('field_50m_converted_to_sprint_speed') is False for r in norm))

clusters=j(OUT/'sp102_origin_event_clusters.json');cl=clusters.get('clusters',[]);rids={r['record_id'] for r in norm}
ck('origin_cluster_members_valid',all(set(c.get('member_record_ids',[]))<=rids for c in cl))
ck('same_event_inflation_zero',all(c.get('same_event_inflation_after_cluster')==0 and c.get('reaction_volume_used_as_votes') is False for c in cl))
ck('origin_independence_policy_explicit',all('same video/channel/transient-author/near-template/quote/same-timing' in c.get('independence_policy','') for c in cl))

primary=j(OUT/'sp102_primary_source_discovery_receipts.json');pr=primary.get('records',[])
ck('linked_primary_separate_layer',all(r.get('source_layer')=='LINKED_PRIMARY_SOURCE_DISCOVERED_IN_COMMENT' for r in pr))
ck('no_unfetched_primary_promotion',all((not r.get('promoted_to_primary_evidence')) or r.get('independently_fetched') for r in pr))

ps=j(OUT/'sp102_player_evidence_summary.json');players=ps.get('players',[]);allowed_states={'CHANGED_DIRECTION','SUPPORTED_EXISTING_DIRECTION','CONTRADICTED_EXISTING_DIRECTION','NARROWED_UNCERTAINTY','WIDENED_UNCERTAINTY','DISCOVERED_PRIMARY_SOURCE','AVAILABLE_NOT_DECISION_EFFECTIVE','NO_USABLE_EVIDENCE'}
ck('per_player_output_exact_30',len(players)==30 and {p['stable_player_key'] for p in players}==tkeys)
ck('per_player_query_and_video_denominators',all(p.get('query_denominator',0)>=3 and 'searched_video_denominator' in p for p in players))
ck('per_player_required_use_state',all(p.get('final_use_state') in allowed_states for p in players),dict(Counter(p.get('final_use_state') for p in players)))
ck('before_after_receipts_exist_no_numeric_rating',all(p.get('before') and p.get('after') and p['before'].get('numeric_rating_interval') is None and p['after'].get('numeric_rating_interval') is None and p.get('final_numeric_rating_created') is False for p in players))
ck('claim_event_source_provenance_per_player',all('claim_event_source_provenance' in p for p in players))

ab=j(OUT/'sp102_decision_use_and_ablation.json');ar=ab.get('players',[])
ck('decision_use_ablation_exact_30',len(ar)==30 and {p['stable_player_key'] for p in ar}==tkeys)
ck('sp102_ablation_no_rating_or_owner_change',all(p.get('numeric_rating_change') is False and p.get('owner_verdict_change') is False for p in ar))
coverage=j(OUT/'sp102_coverage_qa.json')
ck('full100_consistency_rerun_pass',coverage.get('status')=='PASS' and coverage.get('all100_selection_count')==100 and coverage.get('frozen_target_count')==30 and coverage.get('non_target_count')==70 and not coverage.get('non_target_keys_present_in_sp102_evidence'))
ck('semantic_canaries_pass',coverage.get('canaries',{}).get('pass') is True,coverage.get('canaries'))
ck('independence_canaries_present',all(str(v).startswith('PASS') for v in coverage.get('independence_canaries',{}).values()),coverage.get('independence_canaries'))
ck('comment_high_confidence_and_powerpro_guards',coverage.get('influence_guard',{}).get('comment_only_high_confidence') is False and coverage.get('influence_guard',{}).get('field_50m_to_sprint_speed') is False and coverage.get('influence_guard',{}).get('final_numeric_rating_created') is False)
not_found=[r for r in norm if str(r.get('text_excerpt') or '').startswith('NOT_FOUND:')]
ck('missingness_not_classified_as_usable_claim',all(r.get('usable_directional_context') is False and r.get('semantic_class') in {'AMBIGUOUS_TIME_OR_PLAYER','GENERAL_FANDOM_NO_SPEED_CLAIM'} for r in not_found),[r.get('record_id') for r in not_found if r.get('usable_directional_context') is not False or r.get('semantic_class') not in {'AMBIGUOUS_TIME_OR_PLAYER','GENERAL_FANDOM_NO_SPEED_CLAIM'}])

detp=OUT/'sp102_canonical_determinism_qa_20260819.json'
ck('deterministic_given_frozen_source_snapshot',detp.exists() and j(detp).get('status')=='PASS_BYTE_IDENTICAL',j(detp) if detp.exists() else 'missing')
privacy=j(OUT/'qa_sp102_commenter_privacy_20260819.json');ck('privacy_qa_pass',privacy.get('status')=='PASS_COMMENTER_PRIVACY',privacy.get('status'))
r=reg();ledger=j(OUT/'sp078_owner_verdict_ledger_20260816.json');lock=j(ROOT/'docs/state/speed_owner_review_integrity_lock_20260817.json')
ck('sp101_done',r.get('SP-101',{}).get('status')=='DONE_VALIDATED')
ck('owner_ledger_zero_lock_true',ledger.get('owner_verdict_count')==0 and not ledger.get('records') and lock.get('locked') is True)
ck('sp079_and_shoulder_blocked',r.get('SP-079',{}).get('status')=='BLOCKED_DEPENDENCY' and r.get('SP-082',{}).get('status')=='BLOCKED_DEPENDENCY')
status='PASS_SP102_BINDING_CONTRACT' if all(c['pass'] for c in checks) else 'FAIL_SP102_BINDING_CONTRACT'
out={'schema_version':'qa_sp102_binding_contract_20260819','generated_at':'2026-08-19','status':status,'pass_count':sum(c['pass'] for c in checks),'fail_count':sum(not c['pass'] for c in checks),'checks':checks}
O.write_text(json.dumps(out,ensure_ascii=False,sort_keys=True,indent=2)+'\n',encoding='utf-8')
failed=[{'name':c['name'],'detail':c.get('detail')} for c in checks if not c['pass']]
print(json.dumps({'status':status,'pass':out['pass_count'],'fail':out['fail_count'],'failed_checks':failed},ensure_ascii=False));sys.exit(0 if status.startswith('PASS') else 2)
