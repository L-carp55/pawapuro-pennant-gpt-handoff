# SP-102 targeted video/comment rescue audit — raw acquisition QA

Status: **PASS_BOUNDED_ACQUISITION_LIMITED_NEGATIVE_FINDING**

- Frozen targets: **30**; non-targets: **70**, with no non-target search.
- Query attempts: **193**; query errors: **0**; minimum per target: **6**.
- Selected video fetches: **116**; failures: **116**.
- Raw layered evidence records: **0**; usable low-influence records: **0**; timed context records: **0**.
- Commenter raw identities are removed before this QA; comment evidence is never a direct physical anchor.
- Binding-task canonical outputs and refined independence clustering are audited separately by qa_sp102_binding_contract_20260819.json.

## Checks

- PASS — `frozen_target_30_non_target_70`
- PASS — `every_target_at_least_three_queries`
- PASS — `no_non_target_search`
- PASS — `errors_explicit`
- PASS — `api_provenance_explicit`
- PASS — `evidence_targeted_only`
- PASS — `fresh_youtube_provenance_only`
- PASS — `comment_influence_low_no_direct_anchor`
- PASS — `video_context_only_comment_not_directional`
- PASS — `commenter_identity_sanitized`
- PASS — `no_final_rating`
- PASS — `50m_no_sprint_conversion`
- PASS — `primary_not_promoted`
- PASS — `event_registry_targeted_only`
- PASS — `summary_scope_guard`
- PASS — `owner_ledger_zero_lock_true`
- PASS — `sp101_done_sp079_shoulder_blocked`

## Governance

- owner_verdict_count: **0**
- SP-079 remains blocked.
- Shoulder remains blocked.
