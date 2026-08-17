# Speed appraisal spec-drift incident and permanent guard — 2026-08-17

## Status

**OWNER REVIEW LOCKED. No new SP-078 owner verdict may be written until the construct traceability gate is satisfied.**

Machine lock: `docs/state/speed_owner_review_integrity_lock_20260817.json`  
Machine contract: `docs/state/speed_construct_traceability_contract_20260817.tsv`

## Incident

On 2026-08-17, the owner identified that the proposed player-level owner review had drifted toward a narrow interpretation of the current SP-100 N-primary layer. The review over-emphasized 2026 NPB+ top speed plus exposure/S/community/PowerPro context and did not prove that the full speed construct and all retained physical evidence lanes were represented in the owner-review artifact.

This is not a data-collection failure. The repository already contained requirements and evidence for H2F/acceleration, short-distance physical measurements, historical physical anchors, mixed game evidence, technique separation, and scoped negative findings.

## Root cause

The prior governance validator proved that immutable requirements were mapped to at least one task and that a closed queue had all of its *declared* dependencies closed. It did **not** prove end-to-end propagation:

`immutable requirement -> evidence lane -> implementation/output -> per-player owner-review field -> owner verdict -> final appraisal`

Therefore a narrower downstream task contract could become internally consistent and pass QA while omitting evidence lanes required by the higher-level construct.

The specific conceptual collapse was:

`SP-100 = safe implementation of the 2026 NPB+ top-speed physical/rank lane`

being treated in review practice as if it were equivalent to:

`complete player-level speed construct for final owner review`.

That equivalence is false. SP-100 explicitly does not create SP-079 final practical appraisal.

A second contributing error was failure to keep source-specific negative findings scoped. `hp_to_1b_sec` could not be verified as NPB+ direct evidence and correctly remained fail-closed, but that does not invalidate independently sourced H2F/90ft/acceleration evidence or the acceleration construct itself.

## Impact

- The ten player recommendations discussed immediately before this incident are **withdrawn as owner-verdict candidates**.
- No owner verdict was persisted; the SP-078 ledger remained at `owner_verdict_count=0` at incident discovery.
- SP-016, SP-098, SP-100 and other valid component work remain valid within their stated scopes.
- The current SP-077 artifact may be retained as a technical snapshot, but it is **not sufficient to unlock owner verdict capture** until the new traceability contract is satisfied.

## Permanent rules

### R1. Full construct beats latest task shorthand

The canonical speed target is baseball physical running ability over roughly the first-step-to-90ft window. Top speed is one component. Acceleration/early split and speed maintenance/short-distance evidence must not be silently collapsed into a single top-speed statistic.

### R2. Requirement mapping is not enough

A requirement is not considered preserved merely because it maps to a closed task. For every required owner-review lane, the final per-player queue must contain either:

1. evidence/value/range with confidence and provenance, or
2. explicit bounded missingness, or
3. a narrowly scoped exclusion with a recorded reason.

An absent field is not an acceptable representation of missing evidence.

### R3. Source failure may not erase a construct

A negative finding applies only to the tested source/field/transformation unless an explicit broader audit proves otherwise. In particular, a provenance failure for one `hp_to_1b_sec` field cannot remove the H2F/90ft/acceleration lane.

### R4. No single-lane owner review

Player-level owner review and SP-079 are forbidden if the queue can be explained primarily by one physical component while other retained required lanes are not represented.

### R5. Owner verdict write path must fail closed

SP-078 capture must check the integrity lock before accepting any real owner event. Manual or programmatic changes that create nonzero owner verdicts while the lock is true are invalid and must fail CI.

### R6. CI must validate traceability, not only dependency closure

CI must run the existing registry QA **and** a construct-traceability QA. Unlocking owner review requires both.

### R7. Unlock requires positive proof

Setting the lock flag to false is not itself sufficient. The traceability QA must independently verify:

- required lane IDs exist;
- requirement references and source tasks exist;
- all owner-review-required lanes are no longer `UNRESOLVED`;
- every integrated lane has the declared per-player queue field for all 100 rows;
- the owner ledger is still empty while locked;
- SP-079 has not been closed while locked.

### R8. Independent re-review before unlock

After the queue is rebuilt, an independent review must compare it against the immutable requirements and the 2026-08-11 reopened gap-audit intent. Only then may the lock be removed and the empty ledger rebound to the new queue hash.

## Required evidence lanes before unlock

The machine-readable list lives in `docs/state/speed_construct_traceability_contract_20260817.tsv`. At minimum it covers:

- canonical first-step-to-90ft construct;
- current top speed;
- H2F/90ft/acceleration;
- 30m/50m/short-distance physical evidence;
- historical/temporal physical evidence;
- current statistical proxy context;
- mixed game-result proxy breakdown;
- physical-observation community context;
- technique separation;
- PowerPro review/stale context;
- source-scope guard;
- explicit missingness and provenance.

## Non-negotiable operational consequence

Until the lock is legitimately cleared:

- do not ask the owner to approve Batch 1 or any later batch;
- do not write SP-078 verdict records;
- do not run SP-079;
- do not describe the speed owner review as ready;
- do not proceed to shoulder.

The next speed work is a bounded reconstruction/audit of the final owner-review queue against the traceability contract, not new broad data collection.
