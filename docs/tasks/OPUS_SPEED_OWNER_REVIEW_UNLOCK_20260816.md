# OPUS SPEED OWNER-REVIEW UNLOCK WAVE — 2026-08-16

## Objective

Close the remaining work that currently prevents the **final speed owner-review queue (SP-077)** from becoming eligible, without generating SP-077 yet.

Work only on:

- SP-016 — current-year-first / history-prior policy and implementation
- SP-060 — scouting evidence integration
- SP-061 — pinch-runner weak-context lane
- SP-062 — defensive straight-line chase evidence lane
- inseparable exclusion decisions: EX-004, EX-009, EX-016, EX-017, EX-018

Base snapshot / immutable starting point:

- branch base SHA: `4022cc54a5ad6ea0869468a6c3c6a3360cb13337`

Do **not** work on SP-020, SP-039, SP-044/045, SP-063, SP-071/072, SP-078+, SP-090, SP-098/099/100, shoulder, or the global Speed Gate in this wave.

Do **not** perform new X, YouTube, Web, scouting-site, NPB-site, or other external collection. This is a frozen-repository integration/methodology wave. `NOT_COLLECTED` must remain distinct from `MEASURED_NEGATIVE`.

Use subagents in parallel for genuinely independent tracks if available, but consolidate all final changes on this one branch. One agent should own SP-016; another may own SP-060/061/062 + exclusions; run an independent QA/review pass after integration.

---

# Non-negotiable appraisal policy

1. Annual appraisal estimates ability **in that appraisal year/current point**, not future performance.
2. Next-year repeatability, Y→Y+1 correlation, future RMSE, or future outcomes may not select inputs, weights, shrinkage, prior strength, or final annual points.
3. Same-time measurement reliability / sampling error may affect uncertainty.
4. History may influence the annual estimate only for an explicit, provenance-bearing reason such as:
   - insufficient current-year evidence,
   - documented injury/recovery,
   - documented obvious current underperformance / measurement anomaly,
   - explicit temporal bridging.
5. Once current-year evidence is sufficient, automatic historical contribution must be **exactly zero**.
6. Do not infer injury from low PA alone.
7. PowerPro individual player labels are never a physical-speed teacher, shrinkage target, component weight target, or per-player numeric conversion target.
8. Prospi is not independent physical truth.
9. Imperfect/confounded evidence is not automatically zero information. Preserve it in the appropriate lower-confidence/context lane.
10. Pure foot speed remains distinct from baserunning technique, stealing technique, route/reaction/positioning, and managerial role choice.

---

# Track A — SP-016 / EX-009

Current registry defects to repair or explicitly retire:

- A-1 non-monotonic historical shrinkage
- A-3 formula differs from a coherent single-pool shrinkage expression and changes error sign by PA
- A-4 substantial history remains for regular/full current-year PA
- B wrong lambda population (`0.2703` derived from median 185 instead of applicable median ~520; old rule would imply ~0.0962)
- F acceptance gate is algebraically incapable of failing
- X-1 duplicate player-season rows inflate historical PA
- X-2 non-idempotent apply script
- X-4 current observations can disappear before sufficiency logic because of the PA>=100 control filter

## Required design outcome

Do not merely tune constants in the broken `continuous_prior` implementation.

Build/validate a **current-year-first, reason-gated history policy** (name may differ) with these invariants:

- current-year observations are never discarded merely because PA is below an arbitrary threshold;
- current-year evidence contribution is monotone non-decreasing with more valid current-year evidence, all else equal;
- historical contribution is monotone non-increasing with stronger current-year evidence;
- historical contribution becomes **exactly 0** once a clearly declared current-evidence sufficiency condition is reached;
- non-low-sample reasons (injury/recovery, anomaly, temporal bridge) require an explicit reason/provenance input and are never inferred from PA alone;
- if no explicit reason exists and current evidence is sufficient, history = 0;
- duplicate player-season joins are deterministically collapsed before PA/evidence aggregation;
- implementation is idempotent;
- no PowerPro individual label and no future-year performance is used anywhere in the prior/shrinkage design or acceptance test.

A safe outcome is allowed to be either:

A. `DONE_VALIDATED`: a reason-gated implementation passes substantive tests; or
B. `DONE_NEGATIVE_FINDING`: no repository-supported automatic historical prior can be validated, so production remains current-year-only/hard and history is owner-review context only.

Do not force `DONE_VALIDATED`.

## Mandatory SP-016 tests

At minimum include machine-readable tests for:

1. **Monotonic current evidence**: fixed current signal/history, increasing current PA/effective evidence may not increase history weight or perversely reduce current contribution.
2. **Sufficiency cutoff**: above declared sufficiency, history weight equals exactly 0, not approximately 0.
3. **Low-sample continuity**: 1, 20, 50, 99 etc. current PA/evidence remain observations rather than becoming `NO_CURRENT_YEAR_OBSERVATION` because of a prefilter.
4. **No-history control**: with no history, output remains defined from current evidence when current evidence exists.
5. **Duplicate invariance**: duplicating a historical player-season input cannot change the result after deterministic dedupe.
6. **Idempotence**: running the generation/apply process twice from the same immutable inputs produces identical hashes/results and does not use its prior output as a new input.
7. **Reason gate**: injury/underperformance/bridge history cannot activate without an explicit reason/provenance field.
8. **Future-outcome prohibition**: scan relevant code/config/output for next-year/future RMSE/correlation fields participating in formulas; must be zero.
9. **PowerPro-teacher prohibition**: scan relevant code/config/output for individual PowerPro labels participating in formula/fit; must be zero.
10. **Fail-able acceptance test**: include at least one deliberately bad fixture that must fail and one valid fixture that must pass. Do not use a statistic whose pass condition follows algebraically from how outputs were standardized.

Production default must remain fail-closed. Do not switch to a new mode unless all adoption criteria are explicitly met; if changed, prove why the change is policy-compliant. It is acceptable to leave `current_year_first_hard` as default and expose the validated reason-gated mode explicitly for later owner-reviewed use.

Update EX-009 only after the above evidence is reviewed. If policy conflict is resolved, move it out of `POLICY_CONFLICT_REOPEN` to the appropriate terminal verdict. Preserve the historical broken implementation as a diagnostic/control if useful; do not silently erase provenance.

---

# Track B — SP-060 scouting

Current measured repository inventory already shows:

- 31 structured files / 2,840 records scanned
- lane A config speed entries: 1 (outside current100)
- lane B: 23 named players, 21 inside current100
- lane C: weaker free-text quoted scouting context
- broad external scouting sweep = `NOT_COLLECTED`

The task is **integration of available evidence**, not proof of platform/public-web exhaustiveness.

Required:

- rebuild a canonical player-level scouting-context artifact from the frozen repository;
- separate direct measurement/provenance-bearing scouting material from free-text quotations and generic draft/scout mentions;
- preserve source/date/basis/identity/confidence;
- do not convert scouting text into a numeric physical-speed teacher;
- missing scouting rows must remain missing, not evidence of average/slow/fast;
- dedupe same underlying measurement/source;
- report current100 coverage and actual independently attributable evidence count;
- explicitly distinguish historical physical measurements originally sourced from scouting/profile material from current-year observations.

Close SP-060 if the bounded integration requirement is actually met. Broad external recollection may remain `NOT_COLLECTED` without forcing PARTIAL if it is not required by the task's bounded integration purpose. Reassess EX-016 from the new measured inventory; do not leave stale text claiming only 1 record if the actual repository inventory is materially larger.

---

# Track C — SP-061 pinch-runner usage / EX-017

Current measured inventory:

- 165 files / 174,194 records scanned
- 65 matched rows
- 29 unique source identities
- 22 unique single posts
- 5 single posts attributable to a player
- 16 single posts matched only via surrounding search blob
- 4 CSV-only files with 18 raw occurrences remain unparsed / `NOT_COLLECTED`

Required:

- identify the actual player-attributable observations and their independent origins;
- do not count search-response blob duplication, prompts, mirrors, or repeated transcriptions as independent evidence;
- classify each usable player-attributable observation by what it actually supports:
  - foot-speed context,
  - baserunning/stealing role context,
  - injury/availability context,
  - managerial-role-only context,
  - unresolved;
- never treat pinch-runner selection itself as a direct speed measurement;
- retain weak information rather than zeroing it;
- choose and document the final policy lane. A valid outcome may be `WEAK_CONTEXT_ONLY_NOT_NUMERIC_TEACHER` with no numeric model weight if the evidence cannot identify a defensible weight.

Reassess EX-017 using the corrected measured corpus. If the old blanket exclusion was too broad, replace it with the appropriate terminal downgrade/context policy. Do not force a numeric weight merely to close the task.

---

# Track D — SP-062 defensive straight-line chase / EX-018

Current measured inventory already establishes:

- DB: 38 objects / 626 columns scanned;
- no column isolates defensive **straight-line chase speed**;
- corpus: range/RngR/UZR/守備範囲 mentions exist, but 0 rows pass the existing isolation condition for a straight-line measured chase;
- `npb_plus_measurement.chase_pct` is plate-discipline chase, not fielding pursuit;
- `web_collected_measurements.json` contains 607 structured range-type metrics (RngR / UZR / UZR_1200 / UZR_200 / range_runs), but these mix route, reaction, positioning and other fielding factors;
- external NPB tracking beyond frozen repo is `NOT_COLLECTED`.

Required:

- rerun/validate the inventory from real DB/corpus inputs;
- explicitly evaluate the 607 range metrics and record why they are or are not admissible for **pure speed**;
- do not throw them away: if unsuitable for pure foot speed, route them to a clearly named defense-context/non-speed lane or preserve as evidence for future fielding appraisal;
- distinguish `MEASURED_NEGATIVE` for the frozen repository's separable straight-line chase measure from `NOT_COLLECTED` external tracking;
- do not infer that public/NPB straight-line tracking does not exist simply because it is absent from this repository.

If the bounded repository search genuinely finds zero isolatable chase-speed observations, `DONE_NEGATIVE_FINDING` is an acceptable and likely correct SP-062 terminal state. Reassess EX-018 accordingly.

---

# EX-004 integrated reassessment

EX-004 currently over-broadly groups base-to-base, infield-grounder/hit, GIDP, triples, extra-base outcomes and several weak contextual lanes.

Use the completed SP-019 result plus this wave's SP-060/061/062 results to rewrite EX-004 so that:

- proxy/statistical information that is confounded is not automatically zeroed;
- direct-speed use remains prohibited where construct contamination is material;
- lower-confidence/context use is preserved where justified;
- no defense-range, pinch-runner, scouting, baserunning-technique or stealing-technique evidence is silently converted into pure foot-speed measurement;
- the corrected policy is narrower than the old blanket exclusion and supported by measured artifacts.

Only move EX-004 out of `OVERBROAD_REOPEN` if the evidence actually supports a terminal policy.

---

# Registry / QA requirements

Update only the task rows and exclusion rows inseparable from this wave:

- tasks: SP-016, SP-060, SP-061, SP-062
- exclusions: EX-004, EX-009, EX-016, EX-017, EX-018

Do **not** update SP-077 to DONE or generate the final owner-review queue in this wave.

Run the standard registry QA and an additional independent machine-readable QA for this wave.

The wave QA must report at least:

- each task status and evidence status;
- each changed exclusion verdict;
- owner-review task blocker count after the wave;
- owner-review open-exclusion blocker count after the wave;
- global gate blocker counts (informational only; do not close Gate);
- SP-016 monotonic/sufficiency/idempotence/dedupe/reason-gate/bad-fixture results;
- SP-060 current100 player coverage and independent-source counts;
- SP-061 matched → deduped → player-attributable → semantically usable counts;
- SP-062 DB objects/columns scanned, corpus matched rows, isolatable chase-speed rows, and preserved range-metric counts;
- proof no new network/external collection was performed;
- proof no shoulder or SP-077+ work was performed.

A status change is not sufficient evidence. Artifacts must enumerate real records or explicitly carry `EVIDENCE_STATUS=MEASURED_NEGATIVE` for a measured zero-result.

---

# Deliverables

Use clear 20260816-v2/v3 filenames rather than overwriting audit history where practical. At minimum produce:

1. SP-016 machine-readable design/QA artifact
2. SP-060 canonical scouting-context artifact
3. SP-061 final pinch-runner context artifact
4. SP-062 final defensive-chase decision artifact
5. one readable audit for this wave
6. one independent machine-readable QA artifact
7. updated `docs/state/speed_task_registry.tsv`
8. updated `docs/state/speed_exclusion_reason_ledger.tsv`
9. any implementation/config changes required by SP-016, with regression tests

Run relevant tests and `scripts/qa_speed_task_registry.mjs` before commit.

Commit and push all work to this branch. Verify local HEAD equals remote branch HEAD.

---

# Final response format — exactly these items

1. Branch
2. Remote SHA
3. SP-016 status + one-sentence design outcome + production default
4. SP-060 status + current100 coverage + independent/usable scouting count
5. SP-061 status + matched/deduped/player-attributable/usable counts + final role
6. SP-062 status + isolatable straight-line chase count + 607-range-metric disposition
7. EX-004 / EX-009 / EX-016 / EX-017 / EX-018 final verdicts
8. Owner-review task blockers remaining
9. Owner-review exclusion blockers remaining
10. Global gate blockers remaining (task + exclusion counts; do not close them)
11. QA verdict + checks/failures
12. Confirmation: no new X/YouTube/Web/NPB/scouting collection; no shoulder; no SP-077+
