# SPEED HANDOFF — 2026-08-14

## 0. Purpose

This is the durable continuation point for the PowerPro-style **speed (走力)** appraisal work. It records only the current state, binding owner corrections, and the next execution step. Older audits/registries remain authoritative for their detailed history.

**Do not start shoulder/arm-strength work until the Speed Gate is explicitly closed.**

---

## 1. Repository / review coordinates

Repository:
`L-carp55/pawapuro-pennant-gpt-handoff`

Architecture-wave base branch:
`review/grok-medium-batch-20260813`

Architecture-wave base SHA:
`3ebab0449ad63cec912b192142c8f61eab5da1fa`

Grok Large Wave branch:
`agent/grok-speed-large-wave-20260814`

Grok Large Wave completion SHA:
`f6ee09bfa06f47d27931f412b5ca0820b1018c22`

Luna provenance-audit SHA / state snapshot before this handoff commit:
`b7e7bcc3c57483608c2c7e17ac971968b4f29dae`

Next review range:
`3ebab0449ad63cec912b192142c8f61eab5da1fa -> b7e7bcc3c57483608c2c7e17ac971968b4f29dae`

The next milestone is **Opus Bulk Review**, not another small execution wave.

---

## 2. Operating model (binding workflow preference)

To avoid slow stop/review cycles, use large waves and review in batches.

- **Luna**: cheap deterministic/mechanical work: inventories, grep/audits, exact matching, JSON/CSV transforms, batch runs, registry/artifact checks, simple rule-following edits.
- **Grok Build**: easy-to-medium implementation/analysis where interpretation is needed.
- **Claude Code / Opus**: difficult methodology/architecture plus bulk review of Luna/Grok output; fix issues directly when possible.
- **GPT**: user-facing coordinator and milestone-level integrity auditor, not the main implementer.

Default flow:
`Luna/Grok execution wave -> Opus bulk review/fix -> GPT milestone audit`

A single blocked task must not stop the whole wave. Record the blocker and continue independent work.

---

## 3. Binding methodology / owner policy

- Annual appraisal estimates **ability in that year/current point**, not next-year projection.
- Next-year repeatability / Y->Y+1 correlation/RMSE must not determine annual material selection, weights, shrinkage, or final points.
- Same-time measurement reliability and sampling error are relevant.
- History is allowed only for explicit reasons such as low current sample, injury, obvious underperformance, or temporal bridging; retain reason/weight/provenance.
- Imperfect/confounded evidence is not automatically zero information.
- Sample size changes uncertainty, not existence.
- Negative findings apply only to the exact tested question/transformation/lane.
- Pure foot speed must remain conceptually separate from baserunning technique, stealing skill, and acceleration context.

### PowerPro role

Allowed provisionally:
- global display-scale center/width / rank feel,
- stale/odd reference after model freeze,
- Rating Consensus reference/context.

Not allowed:
- player-level teacher for input selection,
- component weights,
- shrinkage,
- per-player direct conversion driving final appraisal,
- PowerPro-mapped NPB+ test correlation as physical reliability weight.

### Prospi

Collected rows were Prospi A (mobile), not suitable for PowerPro stale/odd QA. Raw is retained. Console Prospi need not be collected because owner judges it nearly identical to PowerPro and therefore not independent evidence. SR-027/028/029 execution premise is superseded by SR-059.

### The Show

Same-time numeric bridge was tested and is not identifiable. Cross-time numeric bridge is intentionally not used because it introduces temporal confounding. Raw/context evidence can remain.

---

## 4. Architecture work already established

### SP-015

`DONE_VALIDATED` in the current registry. Final annual statistical-component weights were redesigned without next-year repeatability or PowerPro player labels.

Current weights:
- infield-hit rate: 0.300
- GDP avoidance: 0.189
- UBR: 0.189 (reliability still proxied by median because event decomposition is unavailable)
- triple share: 0.164
- advance proxy: 0.093

Validation axis uses **NPB+ raw maximum/sprint speed only**; Luna audit found no `hp_to_1b_sec` contamination in SP-015.

### SP-016

Continuous historical prior design exists and Grok implemented the candidate together with display-scale rederivation. Hard gate remains as control. Current registry status is still `PARTIAL`; Opus must independently decide whether the continuous version is methodology/QA-ready as production policy.

### SP-046

PowerPro role policy established as above.

### SP-052/053

SP-052 same-time The Show bridge = `DONE_NEGATIVE_FINDING`; SP-053 cross-time numeric bridge superseded by owner policy.

---

## 5. Grok Large Wave snapshot

Grok reported the following as completed from existing data and wrote artifacts/registry changes for them:

- SP-020 physical measurement date ledger
- SP-022 evidence-weighted pairwise/range appraisal
- SP-036 generic-label sweep
- SP-039 existing video lane
- SP-042 PowerPro stale detector
- SP-043 veteran case studies
- SP-060 scouting lane
- SP-061 pinch-runner weak context
- SP-062 defensive-chase non-identifiability close
- SP-063 old missing-data task mapping
- SP-072 100-player vs roster scale consistency
- SP-074 conflict rediagnosis
- SP-090 chat-only knowledge scan
- SP-098 identity/schema reverification

Grok also marked EX-004/011/012/013/016/017/018 closed.

These are **not automatically trusted**; Opus must bulk-red-team them from the diff.

Remaining/partial at the Grok snapshot included SP-016, SP-100, SP-033/034/035, SP-075, SP-044/045, SP-014, SP-071/080, SP-077/078/079/081, SP-099, and SP-082.

Grok QA at its completion reported registry PASS and full regression PASS. Treat that as a receipt, not independent validation.

---

## 6. Critical NPB+ provenance incident (owner correction)

### Correct fact

For the NPB+ app/player-screen data used in this project, the speed-related direct measurement is **maximum/top speed only**.

`hp_to_1b_sec` is **not** an NPB+ direct measurement.

`full_effort_run_proxy_count` is also not an NPB+ measurement; it is a separately derived exposure proxy.

### Luna audit

Artifacts:
- `docs/audits/luna_npb_plus_provenance_contamination_20260814.md`
- `outputs/derived/luna_npb_plus_provenance_contamination_20260814.json`

Luna mechanically audited the repository and found:

- `data/manual/npb_plus_screens.jsonl[].hp_to_1b_sec` = `MISATTRIBUTED_SOURCE`.
- The true source of those values remains `PROVENANCE_UNVERIFIED`; do not invent or reassign a source.
- `full_effort_run_proxy_count` = `DERIVED_PROXY`.
- `hp_to_1b_sec` propagated into SP-100 raw latent speed, the parallel-forms reliability, Spearman-Brown combined reliability, confidence, Candidate N, and Candidate F.
- Candidate S has no such dependency.
- SP-015 final weighting has no `hp_to_1b_sec` dependency; its physical validation target is NPB+ maximum/sprint speed only.
- Legacy `scripts/calibrate_npb_plus_direct.mjs` / `configs/ratings.json` still contain a path using the misattributed `hp_to_1b_sec` and must be reviewed/remediated.
- Separately curated H2F evidence with explicit non-NPB+ source/provenance may remain as its own lane.

### Consequence

**Current SP-100 Candidate N/F must not be accepted as final production evidence until repaired.**

The old raw should be retained for auditability, but downstream use of misattributed `hp_to_1b_sec` as an NPB+ measurement should fail closed.

SP-100 must be redesigned around NPB+ maximum speed only. With only one direct NPB+ speed measurement, do not fabricate an internal parallel-forms reliability estimate. If reliability is not identifiable, state `NOT_IDENTIFIABLE` and use external/independent evidence only for validation or bounded confidence reasoning.

The exposure proxy may be retained only as a clearly separate derived signal, with selection-bias risk considered before shrinkage/confidence weighting.

---

## 7. New NPB Enterprise DATA SPOTLIGHT evidence discovered by owner

Important distinction:

**NPB+ app/player-screen data and NPB Enterprise tracking data disclosed through published DATA SPOTLIGHT articles are different provenance lanes. Do not merge them under one `NPB+` source label.**

Use a separate lane such as:
`NPB_ENTERPRISE_TRACKING_ARTICLE`

### 2026-08-13 catcher article (future shoulder evidence only)

Owner supplied an article describing catcher tracking data. Example for 松尾汐恩:
- caught-stealing rate: .220
- average pop time to second: 1.95 sec
- ARM(p90): 133.7 km/h

The article states pop time/ARM are tracking data provided by NPB Enterprise and demonstrates that caught-stealing rate alone does not represent catcher arm strength because pitcher timing, catcher transfer/throw, throw location, and infielder tag all contribute.

This is potentially high-value **future shoulder/catcher evidence**, but **do not begin shoulder work before the Speed Gate closes**. Preserve/reference the discovery only.

### 2026-08-10 speed article

Owner also identified the DATA SPOTLIGHT article titled:
`二盗タイム最速ではない、それでも周東佑京が別格な理由　上位50件で見えた圧倒的な走力`

This may be directly useful for speed because it appears to discuss repeated steal-to-second timing / top-50 events. Full article content has not yet been durably archived here, so do not invent its table/data.

Evaluation rule:
- steal-to-second time is **not pure foot speed**; it mixes lead, jump/read, acceleration, base-to-base running, and slide.
- if event-level/repeated-run data are available, they may still be valuable as an independent repeated-performance/context lane.
- do not auto-promote it to a pure-speed teacher.
- evaluate whether it can provide independent validation/context for SP-100/SP-022/SP-061 or related speed evidence.

---

## 8. Next task: Opus Bulk Review

Opus should review the full Large Wave independently using:

Review base:
`3ebab0449ad63cec912b192142c8f61eab5da1fa`

Review target state snapshot:
`b7e7bcc3c57483608c2c7e17ac971968b4f29dae`

Objectives:

1. Red-team the entire Grok Large Wave diff rather than trusting its report.
2. Validate/fix each Grok-completed task and the seven closed exclusions.
3. Formally remediate the NPB+ provenance incident without deleting raw evidence or inventing provenance.
4. Redesign SP-100 using NPB+ maximum speed only; regenerate Candidate N and any legitimate fusion/sensitivity comparison.
5. Re-check Candidate S/N/F without PowerPro player labels or next-year repeatability as winner criteria.
6. Independently verify SP-015 is unaffected; do not roll it back if it truly uses maximum speed only.
7. Independently judge SP-016 continuous prior and its paired display-scale rederivation; do not return to owner merely because many player values move.
8. Reassess whether SP-033/034/035/075 truly need more collection to block the Gate. `NOT_COLLECTED` does not equal negative evidence, but theoretically collectible data also need not remain a permanent blocker if decision value is low.
9. Reassess whether missing age/injury data in SP-044/045 actually block the Speed Gate or only prevent automatic history exceptions.
10. Evaluate the owner-discovered 2026-08-10 NPB Enterprise steal-time article as a separate provenance lane if its content is accessible.

Opus should directly fix clear defects, update production/config/registry/ledger/derived artifacts as required, run relevant QA/regressions, commit, and push.

Do **not** stop after every finding; complete the entire review scope unless all remaining work is genuinely blocked.

---

## 9. Stop conditions / forbidden scope

At the end of Opus Bulk Review:

- do **not** create the final owner-review queue yet unless explicitly instructed later,
- do **not** close SP-081 Speed Gate,
- do **not** start SP-082 shoulder,
- do **not** finalize SP-071 absolute scale while the engine dependency remains.

After Opus completes and pushes, return the final reviewed head SHA to GPT for the next milestone Integrity Audit.
