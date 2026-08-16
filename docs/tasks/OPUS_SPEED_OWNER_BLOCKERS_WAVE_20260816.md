# Opus Task — Speed owner-review blocker closure wave

Date: 2026-08-16
Branch: `review/opus-speed-owner-blockers-wave-20260816`
Immutable base SHA: `0ed31354b160676ba5cb246e39ceccec21e6c45e`

## Mission

Resolve the remaining blockers that directly keep SP-075 from becoming a trustworthy owner-review input, then regenerate SP-075 **once at the end**.

This is intentionally one broad wave to avoid repeated micro-cycles. Work autonomously through implementation, execution, QA, registry update, commit, push, and remote-SHA verification.

In-scope tasks:

- SP-036 — weak generic SNS labels
- SP-022 — evidence-weighted pairwise/range appraisal
- SP-043 — veteran case studies
- SP-074 — project evidence conflict diagnosis
- SP-075 — final refresh after the four decisions above

Do not start SP-077, SP-078, SP-079, shoulder appraisal, or global Speed Gate closure.

## Highest-priority project rules

1. Annual appraisal estimates ability at the appraisal year/current point. It is not a future projection.
2. Next-year repeatability / Y→Y+1 correlation / RMSE must not determine annual material selection, weights, shrinkage, or final points.
3. Same-time measurement reliability/sampling error is relevant.
4. Historical evidence is allowed only for an explicit reason such as low current sample, injury, underperformance, or temporal bridging. Record reason/weight/provenance.
5. Missing/weak/confounded evidence is not zero information. Missingness stays missing.
6. Negative findings apply only to the exact tested question/lane.
7. Pure foot speed is separate from baserunning technique, stealing skill, acceleration context, gameplay mechanics, and generic injury/aging context.
8. PowerPro individual labels are forbidden as physical teachers or player-level regression targets. They may be used only for global display-scale context, stale/odd QA after model freeze, and Rating Consensus context.
9. Prospi rating evidence is not independent physical truth. For active Community appraisal consensus in this wave, **exclude Prospi game/rating evidence rather than treating it as an independent vote**. It may remain archived/contextual for provenance, but must contribute zero directional consensus and zero automatic stale support.
10. NPB+ `hp_to_1b_sec` is MISATTRIBUTED_SOURCE and must never re-enter as NPB+ direct measurement. Current NPB+ direct speed measure is top/max speed only; generic NPB+ reliability is NOT_IDENTIFIABLE.
11. Do not use NPB official as a new collection source. Do not perform new X/YouTube/web collection in this wave.
12. A check must be capable of failing. Existence-only checks, hard-coded pass/fail constants, tautological z-score checks, or self-referential validation are forbidden.
13. Every generated decision artifact must be rerunnable, source-hashed, and fail closed on missing/renamed fields.

## Important new X owner correction (immutable input)

Use the already-completed cleanup at base SHA. Do not re-search X.

Canonical cleanup artifacts:

- `outputs/derived/speed_x_current_powerpro_clean_20260816.jsonl`
- `outputs/derived/speed_x_current_powerpro_summary_20260816.csv`
- `outputs/derived/speed_x_historical_trajectory_20260816.jsonl`
- `outputs/derived/speed_x_excluded_prospi_20260816.jsonl`
- `outputs/derived/speed_x_current_powerpro_qa_20260816.json`
- `docs/audits/speed_x_current_powerpro_cleanup_20260816.md`

Verified owner-filtered X counts:

- current PowerPro rating claims = 19
- directional PowerPro claims = 11
- current100 players with PowerPro evidence = 12
- current100 players with directional PowerPro evidence = 8
- current real-world speed-specific physical observations = 10
- current100 players with physical observations = 6
- current technique-only rows = 2
- historical PowerPro rows archived = 41
- Prospi rows excluded = 180
- cleanup QA = PASS
- value judgment = `X_COLLECTION_LIMITED_VALUE`

The old aggregate `138 X speed-relevant / 55 current100 players with Community evidence` is superseded for active current appraisal use.

## Known consistency defect to fix during this wave

At base SHA, registry text for SP-075 already says the owner-filtered X layer is used, but the existing artifact
`outputs/derived/sp075_stale_conflict_rediagnosis_v3_20260815.json`
still contains the pre-cleanup Community aggregation (`owner_review_context_players=55` and per-player Prospi context counts).

Do not pretend that artifact is already refreshed.

Until the end-of-wave SP-075 regeneration, treat the 2026-08-15 SP-075 Community portion as stale/superseded. The final wave must make registry wording and actual artifact contents agree.

---

# A. SP-036 — weak generic SNS labels

Current issue from registry:

- namespace/origin double counting was repaired
- 7 origins became 4
- only one row was actually attributable as player evidence (Yamakawa)
- one gameplay joke was correctly separated
- the prior proposition that “mass rejection was too strict” is not supported by one usable row
- task stayed PARTIAL only because a re-judgment was still required

## Required decision

Do **not** collect more SNS data merely to force a positive result.

Re-evaluate the exact SP-036 hypothesis using:

- existing SP-036 artifacts
- the final Terra Community V3 semantic audit
- the 2026-08-16 owner-filtered X layer

Allowed outcomes include `DONE_NEGATIVE_FINDING` if the bounded evidence shows that generic-label rescue has little systematic decision value. A negative result is a valid completion if the exact question was genuinely tested.

Do not keep PARTIAL solely because the hoped-for positive evidence did not materialize.

## Acceptance

Produce a machine-readable SP-036 v2 decision artifact and readable audit that state:

- exact tested question
- input hashes/counts
- rows/events/origins surviving as player evidence
- what is generic physical context vs rating context vs technique/gameplay/noise
- whether the original “mass rejection too strict” claim is supported, unsupported, or not identifiable
- exact reason for final status

No evidence may be deleted just because it is weak; weak evidence can remain contextual with explicit weight/role.

---

# B. SP-022 — evidence-weighted pairwise/range appraisal

Current defects:

- uncertainty floor `0.2` causes 96/156 draws to hit the same floor, so evidence quality barely matters
- `CLEARLY_SLOWER` / `LEAN_SLOWER` are structurally zero because pairs are formed from an F-descending list using only `i < j`
- previous output therefore does not establish evidence-sensitive pairwise uncertainty

## Required repair

Rebuild the pairwise/range design so that:

1. uncertainty actually varies with evidence quality / effective sample / source reliability available at the same appraisal time;
2. no arbitrary floor dominates most pairs unless empirically justified and explicitly tested;
3. pair ordering cannot structurally eliminate one direction;
4. the same pair represented in reversed order gives a logically symmetric result;
5. evidence-poor cases widen ranges / reduce directional confidence rather than becoming zero information;
6. no PowerPro individual labels train the physical model;
7. no next-year outcome is used to choose weights or acceptance;
8. output contains real enumerated player pairs and can fail meaningful QA.

You may redesign the current formula if necessary. Do not preserve a bad formula merely for compatibility.

## Minimum QA

Include at least:

- uncertainty distribution with quantiles and floor/ceiling hit counts
- result-count distribution by directional class
- explicit reverse-pair symmetry regression
- perturbation test: degrading/removing a source must not make a pair more certain without an explained countervailing mechanism
- missing-evidence regression
- at least one deliberately malformed/degenerate fixture that the validator rejects

Final status may be DONE_VALIDATED only if these tests are substantive and pass.

---

# C. SP-043 — veteran case studies

Current defects:

- Matsuyama has `snf/stale = null` and no actual speed evidence
- Community prose asserted conclusions without evidence reconciliation
- `peers_same_pattern` was merely the first eight `low_pa_extremes`, not genuine same-pattern peers

## Required repair

Rebuild the veteran case-study artifact around explicit evidence, not narrative expectations.

For Akiyama, Matsuyama, and any peers:

- enumerate the actual speed evidence available at relevant dates
- separate current direct/physical evidence, statistical context, PowerPro stale/odd context, injury/aging context, and missingness
- do not infer physical decline simply from age or low PA
- do not call a player a “same-pattern peer” unless a stated, reproducible matching rule supports it
- if Matsuyama truly has no usable speed evidence, say `NO_DIRECT_SPEED_EVIDENCE` (or equivalent) and do not invent a verdict

Use existing repository data only in this wave. If the exact case-study question cannot be answered from existing data, a scoped negative/missing-data finding is preferable to fabricated evidence or a new web-collection detour.

## Peer rule

Any peer set must have a reproducible rule based on fields that actually exist. Report the candidate universe, filters, and resulting peers. A simple “first N rows” rule is invalid.

---

# D. SP-074 — project evidence conflict diagnosis

Current defects:

- old check was effectively guaranteed to pass because S and N were both standardized z values
- `|corr| > 0.9` threshold was not a meaningful failure mode; observed corr was around -0.595
- S is 2025 while N is 2026, yet the old artifact treated the gap as if it were same-time conflict

## Required redesign

A conflict diagnosis must distinguish:

1. **same-time disagreement** — legitimate evidence conflict;
2. **different-time disagreement** — temporal change/bridge problem, not immediate source conflict;
3. **different-construct disagreement** — e.g. statistical proxy vs max-speed measurement; contextual, not necessarily contradiction;
4. **missing evidence** — not conflict.

Do not silently align S2025 to N2026.

Where same-time evidence exists, test actual player-level disagreement using meaningful quantities (e.g. rank/percentile/direction plus source-specific uncertainty), not mean≈0 / sd≈1 tautologies.

Where same-time alignment does not exist, mark conflict strength as NOT_IDENTIFIABLE / TEMPORALLY_CONFOUNDED rather than manufacturing a score.

## Minimum QA

- exact year/date provenance for every compared source
- at least one true same-time or explicitly alignable comparison if available
- explicit test fixture where a large constructed disagreement fails/passes as expected
- permutation/order sanity if rank-based logic is used
- missing-source regression
- no test whose result follows automatically from standardization

---

# E. SP-075 — regenerate once, only after A-D

After A-D decisions and implementations are complete, regenerate SP-075 exactly once.

## Active Community evidence policy

### X
Use only the owner-filtered clean layer:

- current PowerPro rating context
- current game-independent real-world physical speed observations
- technique rows only as technique context

Exclude from active appraisal consensus:

- all Prospi X game/rating/gameplay rows
- pre-2025 PowerPro rows (archive/trajectory only)
- PowerPro app/mobile rows
- unresolved/review-required rows unless this wave explicitly resolves them with traceable evidence

### YouTube
Retain only semantically valid evidence from the final Terra canonical layer.

For active appraisal consensus:

- PowerPro rating context may be retained as context only
- Prospi rating evidence contributes zero independent consensus vote and zero stale support
- gameplay/technique does not become physical speed
- unresolved identity/sarcasm remains unresolved

Do not re-scrape YouTube.

## SP-075 role

Community remains `OWNER_REVIEW_CONTEXT_ONLY`.

Required invariants:

- automatic rating changes = 0
- automatic stale promotions = 0
- PowerPro individual labels as physical teacher = 0
- Prospi stale-support claims used = 0
- missing Community evidence is not negative evidence

Integrate the repaired SP-022 / SP-043 / SP-074 outputs as owner-review context according to their valid scope; do not force conflicts into a single numeric truth if they are temporally or construct-confounded.

## Required SP-075 outputs

Create a new dated artifact/audit (20260816) rather than silently overwriting the old 20260815 file unless the repository convention explicitly requires replacement.

At minimum include:

- source hashes
- 100-player coverage
- exact current Community owner-review player count under the new rules
- per-player source counts split by PowerPro rating / real-world physical / technique / YouTube PowerPro / excluded Prospi
- stale/conflict diagnostic state
- explicit temporal-confounding flags
- changed-player/context summary versus the old 20260815 SP-075 output
- list of remaining blockers after this wave

The old 55-player Community count must not survive unless independently reproduced under the cleaned policy.

---

# F. Status / registry rules

Update only the task rows materially affected by this wave: SP-036, SP-022, SP-043, SP-074, SP-075 (and an exclusion row only if logically inseparable and fully justified).

Valid task outcomes are not restricted to DONE_VALIDATED. Use the truthful status:

- `DONE_VALIDATED` — positive/usable result, fully validated
- `DONE_NEGATIVE_FINDING` — exact question tested and negative result is itself informative/complete
- `PARTIAL` — real work remains and is achievable with defined missing work
- `BLOCKED_MISSING_DATA` / `BLOCKED_DEPENDENCY` — only when the missing dependency/data is concrete and not merely an undesired result

Never mark DONE merely because a file exists.

Important: fix the current registry/artifact inconsistency around SP-075. Registry wording must describe what the final generated artifact actually contains.

Run registry QA/regressions after updates. Any validator must inspect content, not only paths.

---

# G. Scope prohibitions

Do not:

- search X
- scrape YouTube
- perform broad web collection
- use NPB official as a source
- start shoulder appraisal
- close the global Speed Gate
- start SP-077 owner queue
- change the production default away from the current fail-closed SP-016 `current_year_first_hard`
- reintroduce NPB+ hp-to-1B contamination
- use future-year prediction to tune annual appraisal
- use PowerPro individual ratings as a physical teacher
- manufacture evidence to force a task to DONE

If a truly essential new large collection is discovered, stop that subpart at a precise data requirement and continue all independent in-scope work. Do not launch the collection yourself.

---

# H. Final execution / deliverables

Implement and run the work, not just write a review memo.

Expected deliverables:

- rerunnable scripts/config changes as needed
- new machine-readable outputs for SP-036/SP-022/SP-043/SP-074/SP-075
- readable audits for each repaired area or one clearly sectioned integrated audit
- updated registry rows with evidence-backed status
- regression/QA outputs
- clean worktree
- commit and push to this branch
- verify remote head SHA

Final report must contain only:

1. branch name
2. remote SHA
3. SP-036 final status + one-line basis
4. SP-022 final status + one-line basis
5. SP-043 final status + one-line basis
6. SP-074 final status + one-line basis
7. SP-075 final status + new owner-review Community player count
8. number of automatic rating changes / stale promotions (must be 0/0 unless owner policy was explicitly changed; it is not changed here)
9. remaining SP-075 blockers, if any
10. QA verdict and failed checks
11. confirmation that no new X/YouTube/web collection and no shoulder work occurred
