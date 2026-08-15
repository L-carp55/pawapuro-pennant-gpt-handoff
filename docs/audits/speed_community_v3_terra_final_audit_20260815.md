# Community V3 final integration and semantic audit

Date: 2026-08-15

## Result

This integration re-audits the bounded sources without new collection: 38,455 YouTube comments/replies, 2,171 YouTube recall-first candidates, and 373 X canonical-input rows. It produces a single canonical evidence layer; it does not calculate a speed point, change production logic, or use game labels as physical teachers.

## Canonical evidence counts

- YouTube raw comments/replies: 38,455
- YouTube semantic-review candidates: 2171
- Final canonical records: 2548 (2171 YouTube candidates plus 377 X records after semantic splits).
- Final canonical YouTube speed-relevant claims: 4
- Final canonical X speed-relevant claims: 138
- Current-100 players with usable Community evidence: 55
- Deduplicated usable source events: 119. Attributable author-origin keys: 21 across 20 authors; unattributed source events: 98 (their person-level independence is not verified).

## Semantic decisions

- A recalled candidate is not automatically a usable claim. The final pass uses the comment text for the ability predicate; parent/root/title are only identity context and cannot by themselves make a broad player mapping.
- Full name is preferred. A unique surname is accepted only in direct text; ambiguous or unmatched names remain AMBIGUOUS, UNRESOLVED, or OUTSIDE_CURRENT_100.
- 走塁, 盗塁, start/jump, and game effects are retained in separate context lanes, never converted into pure-speed teaching data.
- Laugh markers preserve a literal claim as joke_but_claim_present; they do not make a claim noise. Source-marked sarcasm remains review-only.
- Reaction volume is stored but never summed into evidence. Source events use platform/root/author-or-unattributed/semantic-subject; verified same-post copies collapse by semantic slot, and events without an author are not claimed as independent people.

### X correction regressions

- X-1: all three Fukudome power-only replies are NOISE / excluded from speed.
- X-2: the unspecified stolen-base king is AMBIGUOUS; Shiomi is comparison-only.
- X-3: the predicate 足めっちゃ早い is attached to 岩田幸宏, not 丸山和郁.
- X-4: the record is split: Akiyama shoulder context is excluded from speed; Muramatsu is tactical/base-to-base context only.
- X-5/X-6: Nishikawa Shoki and Yamamoto Taido remain outside current-100 and are not false-mapped.

## Status judgment

- SP-033, SP-034, and SP-035 are DONE_VALIDATED as bounded evidence lanes: scope, discovery/recovery, recall-first candidate extraction, semantic audit, identity resolution, missingness, and regression QA are all recorded. This does not claim all-platform completeness or convert acquisition gaps into negative evidence.
- SP-075 remains PARTIAL. Its Community input is regenerated, but SP-036 remains open. It also preserves the non-Community owner-review blockers SP-022, SP-043, and SP-074.

## SP-075 safeguards

- Live SP-042 coverage is 95/100. The 5 uncovered players are STALE_NOT_COVERED rather than silently treated as NONE.
- Community has OWNER_REVIEW_CONTEXT_ONLY effect. Automatic rating changes: 0; automatic stale promotions: 0; Prospi claims used as stale support: 0.

## QA

- Stratified semantic sample: 94
- All 2171 YouTube candidates and 377 X canonical rows were re-audited.
- Confirmed reproducible source errors: 39 (YouTube 4; required X 6; complete X subject/lane audit 13; physical-vs-rating lane 5; gameplay/duplicate/split 4; fan-profile/comparison/multi-subject 5; final verified-copy dedup 2), repaired: 39. Conservative ambiguity/no-claim safeguards: 4; total safety corrections: 43.
- X-1 through X-6: PASS. YouTube A through G: A=PASS, B=PASS, C=PASS, D=PASS, E=PASS, F=PASS, G=PASS
- Machine checks: 59 PASS; remaining detected canonical errors: 0.

## Canonical artifacts

- outputs/derived/speed_community_v3_canonical_20260815.jsonl
- outputs/derived/speed_community_v3_current100_player_summary_20260815.csv
- outputs/derived/speed_community_v3_consensus_20260815.json
- outputs/derived/speed_community_v3_semantic_audit_qa_20260815.json
- outputs/derived/sp075_stale_conflict_rediagnosis_v3_20260815.json

No further Community V3 collection is required for this bounded lane. Collection completeness remains explicitly unknown rather than being interpreted as the absence of criticism.
