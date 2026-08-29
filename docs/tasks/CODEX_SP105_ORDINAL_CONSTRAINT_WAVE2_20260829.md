作業フォルダ: /mnt/c/Users/amila/Desktop/Claude Code/repos/pawapuro-pennant-gpt-handoff
Repo: L-carp55/pawapuro-pennant-gpt-handoff

パワプロ査定プロジェクトの走力査定です。SP-105 commit `c468bbc01a985b806b0d1b60e29c6603a663e0ac` はbrowser独立監査で、cross-family numeric calibrationのnegative findingとしては受理されました。ただし100人の最終point/rankが全件NPB+ peak anchorだけで決まり、既存のnon-peak/ordinal情報がpoint/rankへ一切効いていないため、SP-079の最終再承認はまだ行いません。

**同じSP-105のbounded Wave 2だけを実行してください。新しい広範データ収集はしないでください。**

## Target branch

`codex/speed-sp105-sp079-synthesis-calibration-repair-20260826`

開始前に必ず読む:
1. `docs/audits/sp105_browser_independent_review_20260829.md`
2. `docs/tasks/SP105_SP079_SYNTHESIS_CALIBRATION_REPAIR_20260826.md`
3. SP-105 commit `c468bbc01a985b806b0d1b60e29c6603a663e0ac` の全canonical outputs
4. SP-101 signed ordinal / analog / transition / The Show semantic artifacts
5. SP-104 canonical physical evidence and transfer receipts
6. SP-100 current NPB+ peak layer

## Worktree safety

- `git fetch origin` first.
- canonical checkoutをreset/clean/editしない。
- `stash@{0}`を含む既存stashに触れない。
- このSP-105 branch専用のclean isolated worktree/cloneを使う。
- old SP worktreeをwrite先として再利用しない。

## Governance lock

- SP-079 remains `PARTIAL` until browser reacceptance.
- SP-105 remains gate-blocking while Wave 2 is running.
- owner verdict ledger remains empty; expected count=0.
- do not run SP-080/SP-081.
- do not start shoulder/SP-082.
- no PowerPro player label in model/constraint selection, weights, thresholds or manual fixes.
- no legacy NPB+ `hp_to_1b_sec`.
- no broad new X/YouTube/scouting/WBC/NPB+ collection.

## Purpose

Do **not** re-open numeric cross-family percentile averaging. SP-105 Wave 1 correctly found broad common-scale calibration not identifiable.

Wave 2 asks one narrower question:

> Can already validated nonnumeric ordering/range evidence improve the final player ordering relative to the Tier-A peak-only ordering, without pretending heterogeneous percentile scales are numerically commensurate?

This is specifically to use valid information such as same-family orderings and signed pairwise constraints in the role they actually support.

## Baselines

Reproduce and freeze:

A. `D_BASELINE` = SP-105 Wave 1 selected `CONSERVATIVE_TIER_A_ANCHOR_LOWER_TIER_BOUNDED_CONSTRAINT` output.

Do not alter this baseline. Its scientific meaning is peak-anchor point + multi-source bounds/conflict.

## Candidate B — ORDINAL_CONSTRAINED

Build an auditable constrained-ranking candidate from A.

### Allowed constraint sources

Only constraints with explicit direction and supported semantics may affect rank:

1. **Same-family physical ordering**
   - H2F versus H2F under compatible protocol/side/context;
   - T90/standardized 90ft versus same construct;
   - 30m versus compatible 30m, 50m versus compatible 50m;
   - do not compare 30m numeric percentile directly with 50m/H2F/peak percentile.

2. **SP-101 signed pairwise ordinal graph**
   - only semantically validated signed edges;
   - exclude PowerPro behavior edges and technique-only edges;
   - preserve evidence IDs, confidence/source tier, time scope and edge origin.

3. **Analog/common-support evidence**
   - only if it yields an explicit bounded order/range supported by common support;
   - no numeric target-percentile transfer when SP-104/SP-105 said no production transfer;
   - similarity alone is not a faster/slower edge.

4. **The Show / transitions**
   - no direct The Show Speed -> NPB numeric copy;
   - only explicit trajectory/update/transition/relative directional constraints that survived SP-101 semantic QA;
   - if no valid directional edge exists for current100, record measured zero rank effect rather than inventing one.

5. Context/proxy/community/scouting
   - may affect interval/conflict/confidence under existing guards;
   - may affect rank only if a pre-existing explicit faster/slower signed claim is independently valid for physical speed;
   - usage volume/reactions/general labels are not votes.

### Ranking method

Use a transparent partial-order/constrained-ranking approach, not an arbitrary weighted arithmetic score.

Acceptable examples include:
- minimum-violation projection from the Tier-A baseline ordering;
- isotonic/partial-order rank projection;
- another mathematically equivalent method that minimizes movement from the peak-anchor baseline subject to validated constraints.

Requirements:
- hard vs soft constraints must be predeclared from provenance/semantic strength, not tuned to PowerPro;
- no edge may be duplicated to gain weight;
- same event/source cluster counts once;
- contradictory constraints must remain conflict, not be silently dropped;
- disconnected players may retain baseline ordering;
- do not optimize number of changed ranks.

## Validation

The ordinal candidate may replace D only if it adds reproducible information under physical/ordinal validation without arbitrary choices.

At minimum perform:

1. **leave-player-out / leave-edge-out signed comparison recovery**
   - hide a set of supported signed physical/ordinal constraints;
   - fit/project on the remaining constraints;
   - measure held-out direction accuracy / violation rate.

2. **weighted constraint violation**
   - compare D baseline vs ORDINAL_CONSTRAINED on independently held-out constraints;
   - report by source family and confidence tier.

3. **stability**
   - remove one constraint family at a time;
   - measure rank changes/Kendall or Spearman stability;
   - low-tier removal must not cause disproportionate rank movement.

4. **common-support / connectivity coverage**
   - number of current100 players with at least one valid rank-affecting edge;
   - connected components;
   - players unchanged because no valid constraint exists.

5. **negative controls**
   - edge direction permutation / irrelevant technique edges must not improve validation;
   - PowerPro labels must remain absent.

Prefer D if ordinal candidate does not clearly improve held-out constraint recovery or requires arbitrary source weights.

## Point semantics

If D remains selected:
- retain its numeric point if desired for UI, but rename/annotate its scientific semantics explicitly as
  `DEFENSIBLE_TIER_A_PEAK_ANCHOR_POINT_NOT_FULL_CONSTRUCT_POINT`.
- do **not** describe it as a fully integrated latent baseball-running-speed point.
- lower-tier evidence remains interval/conflict/context only.

If ORDINAL_CONSTRAINED is selected:
- distinguish `rank_recommendation` from `numeric_point_anchor`.
- rank may change through ordinal constraints even if the numeric scientific point remains the Tier-A peak anchor.
- a provisional display rating derived from rank must carry a separate field and `PROVISIONAL_PENDING_SP071_SP072`.
- do not falsely imply cross-family numeric calibration.

## Required outputs

At minimum:
- `outputs/derived/sp105_wave2_ordinal_constraint_universe.json`
- `outputs/derived/sp105_wave2_ordinal_rank_benchmark.json`
- `outputs/derived/sp105_wave2_ordinal_validation.json`
- `outputs/derived/sp105_wave2_selected_policy.json`
- `outputs/derived/sp105_wave2_final_speed_100.json`
- `outputs/derived/sp105_wave2_final_speed_100.csv`
- `outputs/derived/sp105_wave2_rank_ablation.json`
- `outputs/derived/qa_sp105_wave2_ordinal_constraints.json`
- `docs/reports/sp105_wave2_final_speed_100.md`
- `docs/audits/sp105_wave2_ordinal_constraint_audit.md`

## Required per-player trace

Exactly 100 rows. Each must include:
- Tier-A peak anchor point/rank;
- final rank recommendation;
- whether rank changed from D;
- exact rank-affecting constraint IDs;
- constraints present but zero-effect;
- conflicts/violations;
- interval/confidence effects;
- `point_semantics`;
- `rank_semantics`;
- scale status;
- PowerPro posthoc only after freeze.

## Independent QA / fail-before

Use a separate red-team process. Must detect at minimum:
1. heterogeneous percentiles numerically averaged again;
2. unsigned similarity treated as faster/slower;
3. PowerPro edge/label entering rank selection;
4. technique-only edge treated as physical speed;
5. duplicate origin edge gaining weight;
6. target/held-out edge leaking into validation training;
7. edge direction inversion;
8. low-confidence context overriding hard direct physical ordering without conflict;
9. rank changed with no traceable valid constraint;
10. loaded zero-effect lane reported as rank-affecting;
11. final point called full-construct point when it is peak anchor only;
12. owner verdict write / SP-080/SP-081/shoulder output.

Deterministic stages rerun byte-identically from frozen inputs.

## End state

Allowed outcomes:

### Outcome 1 — ordinal candidate validated
`DONE_VALIDATED_READY_FOR_BROWSER_REACCEPTANCE`
- evidence supports rank changes beyond peak baseline;
- final output clearly separates peak numeric anchor from ordinal-constrained rank.

### Outcome 2 — ordinal candidate measured negative
`DONE_NEGATIVE_FINDING_READY_FOR_BROWSER_REACCEPTANCE`
- valid constraints are too sparse/conflicting/non-predictive to improve ranking reproducibly;
- D remains selected;
- final semantics explicitly say peak-anchor point/rank with multi-source uncertainty, not fully integrated construct.

### Outcome 3
`PARTIAL/BLOCKED`
- a real semantic/QA defect remains.

Even if Outcome 1 or 2, **STOP at SP-105 Wave 2**. Do not run SP-080/SP-081, owner verdict capture, or shoulder. Browser GPT must independently review before downstream transition.

Commit/push and verify remote HEAD. Report branch+commit, constraint coverage, held-out recovery/violation metrics, selected outcome, number of rank-changed players, actual The Show/analog/physical-order rank effects, point/rank semantics distribution, independent QA, owner count and downstream locks.
