# OPUS speed pre-owner-review closure wave

Date: 2026-08-16
Base SHA: `4022cc54a5ad6ea0869468a6c3c6a3360cb13337`
Target branch: `review/opus-speed-pre-owner-review-wave-20260816`

## Mission

Advance the speed project to the point immediately before owner verdict entry, without starting final 100-player reappraisal, engine-scale work, global Speed Gate closure, shoulder work, or any new external collection.

Run independent workstreams in parallel/subagents where safe, then integrate once. Do not create a chain of tiny follow-up tasks.

Primary workstreams:

1. repair/close `SP-016` current-year-first low-sample history policy,
2. repair/close `SP-098` identity/coverage handling,
3. prepare the final `SP-100` production-wiring decision packet under already-frozen owner constraints, and close it only if no new owner value judgment is required,
4. if and only if every `SP-077` dependency is truly closed after this wave, generate `SP-077` final owner review queue and implement `SP-078` verdict-capture/no-overwrite infrastructure, but DO NOT enter owner verdicts and DO NOT run `SP-079`.

## Hard scope guards

- No new X / YouTube / Web / NPB-official / Prospi / The Show collection.
- No shoulder work.
- No SP-079 final reappraisal.
- No SP-080 engine simulation.
- No SP-081 global Speed Gate closure.
- Do not change the absolute 0-100 scale policy in SP-071.
- Do not use PowerPro player-level labels as a physical teacher, component selector, component weight, shrinkage target, or player-level regression target.
- Do not use next-year repeatability / Y→Y+1 RMSE / future outcomes to select annual-appraisal inputs, weights, shrinkage, or points.
- Missing evidence is not negative evidence.
- Preserve raw/legacy artifacts for audit; fail closed rather than silently inventing values.
- Do not overwrite the already-validated Community/SP-075 outputs except where a downstream queue consumes them by reference.

## Frozen policy principles

Annual appraisal estimates ability in the appraisal year/current point. Current-year evidence dominates. History may be used only as an explicit prior/fallback when current evidence is genuinely insufficient, and history contribution must become exactly zero once current evidence is sufficient.

Pure baseball-relevant foot speed must remain separate from baserunning technique, stealing skill, and gameplay mechanics.

For PowerPro, allowed uses remain: provisional global display center/width, stale/odd QA context, and Rating Consensus context. Individual PowerPro labels remain forbidden as physical teachers.

For NPB+: `hp_to_1b_sec` is MISATTRIBUTED_SOURCE and cannot be consumed as an NPB+ direct measure. The direct NPB+ speed measure is top/max speed only. Generic measurement reliability is `NOT_IDENTIFIABLE`; do not manufacture a reliability coefficient. Exposure/run opportunity is context/confidence only and must not multiplicatively shrink the z score because it is correlated with the latent quantity and maximum-statistic opportunity.

## Workstream A — SP-016

### Existing defects that MUST be independently reproduced first

Re-read the current registry and old Opus audit, then independently reproduce or explicitly falsify each known defect before changing code:

- A-1 non-monotonic shrinkage under the old continuous-prior implementation.
- A-3 mismatch versus a mathematically coherent single-pool/shrinkage formulation, including the sign-changing error across current PA.
- A-4 automatic history remaining for players with abundant current evidence.
- B: historical weight parameter derived from the wrong population (`0.2703` from median 185 rather than the actual target-population median around 520 in the prior audit).
- F: old acceptance gate is algebraically/structurally unable to fail.
- X-1 duplicate player-season joins inflating historical PA.
- X-2 non-idempotent script/config rewrite behavior.
- X-4 `pa>=100` filter deleting real low-sample current observations before sufficiency logic.

### Required repaired policy

Implement or validate a current-year-first low-sample prior architecture satisfying all of the following:

1. **No current evidence is discarded solely because PA is below an arbitrary preprocessing threshold.** Low sample must remain low-sample evidence, not become `NO_CURRENT_YEAR_OBSERVATION`.
2. **History weight is monotone non-increasing as current evidence increases.**
3. **History contribution is exactly zero once explicit current-evidence sufficiency is reached.** This is a hard owner rule, not a soft preference.
4. For insufficient current evidence only, any history prior must be mathematically coherent. If a pooled/shrunk estimator is retained, the denominator must use the same effective weights as the numerator and include the shrinkage prior consistently. A valid form may resemble `(n_c*z_c + λ*n_h*z_h)/(n_c + λ*n_h + κ)` before the hard sufficient-current cutoff, but do not blindly adopt this exact formula if repository evidence supports a better equivalent. Explain the chosen formula and invariants.
5. Dedupe/aggregate split-team player-seasons deterministically before historical effective sample calculation; no player-season PA inflation.
6. Any λ/κ/sufficiency threshold must be derived from the actual target population or explicit construct logic, not a mismatched population. No PowerPro labels or future-year outcomes may determine them.
7. The implementation must be idempotent. Running the script twice on the same inputs must produce byte-identical or semantically identical outputs/config state.
8. Keep the existing hard current-year-first behavior as fail-closed fallback until the repaired candidate passes all gates.
9. If the repaired low-sample-prior mode passes and is strictly consistent with the owner rule, it may become the production default. If there remains a substantive policy ambiguity, keep the hard fallback as production and close SP-016 only if the production behavior itself already satisfies the requirement; record the candidate separately.

### SP-016 QA must be genuinely fail-able

Do not use a correlation identity or standardized-mean/sd check that is guaranteed by construction.

At minimum include:

- synthetic monotonicity sweep over current evidence with fixed history,
- exact zero-history assertion above sufficiency,
- preservation of low-PA current observations,
- duplicate player-season fixture and real-data duplicate audit,
- idempotence rerun,
- malformed-input/fail-closed fixture,
- no PowerPro/future-year provenance assertion,
- independent recomputation of any population median/threshold used,
- a fixture that deliberately violates each major invariant and is proven to fail.

SP-016 may become `DONE_VALIDATED` only if these pass. Otherwise leave it `PARTIAL` with exact remaining blocker; do not fake closure.

## Workstream B — SP-098 identity/coverage repair

The current known cases are:

- `名原 典彦`: current artifact still reports `ERROR`; DB evidence says 2026 usage exists and farm/bm_player has stable record `id=20230057` for 2023-2026, while 2025 first-team batting is absent.
- `サンタナ`: should resolve specifically to `Ｄ．サンタナ` / player id `53755153`.
- `塩見 泰隆`: no-batting-sample paths must preserve non-batting ability schema and not drop speed/arm/fielding context solely because AB=0.

Required repair:

1. Separate **identity resolution** from **coverage availability**. A player can be identified even if the requested season lacks first-team batting data.
2. Remove self-fulfilling checks such as `id === expected || !!id`. Exact identity QA must compare against independently sourced stable keys/names/team/season relationships.
3. For 名原, establish a deterministic canonical identity/linkage from repository/DB evidence without inventing 2025 first-team batting values. If the production player-id namespace genuinely has no equivalent for the bm/farm id, store a stable canonical crosswalk key and explicitly mark batting coverage missing; do not leave the player as a generic `ERROR` merely because the batting table lacks 2025 rows.
4. Santana must resolve to the exact expected person/id, not merely any non-empty id.
5. Shiomi AB=0/no-batting path must preserve player identity and non-batting ability/evidence fields; batting ratings may remain null when evidence is absent.
6. Add negative fixtures for same-surname/wrong-team/wrong-id and make them fail.
7. Re-run the relevant pipeline in the mode used only for identity/coverage QA; clearly label it as QA rather than final 2026 practical appraisal.

SP-098 may become `DONE_VALIDATED` only if all three cases are resolved in the appropriate identity/coverage sense and the checks are non-self-fulfilling.

## Workstream C — SP-100 production-wiring decision packet

Do NOT re-run broad collection. Re-read the current SP-100 v2 artifacts, provenance guards, NPB Enterprise article lane, SP-046 owner policy, and SP-099 repair.

The already-established facts/constraints are:

- NPB+ direct measure = 2026 top/max speed only.
- `hp_to_1b_sec` under NPB+ is provenance-contaminated and forbidden.
- generic NPB+ reliability = `NOT_IDENTIFIABLE`.
- exposure must not numerically shrink N; it is contextual because opportunity is correlated with observed maximum and maximum statistics are opportunity-sensitive.
- S and N cannot be naively blended on mismatched dispersion scales.
- no PowerPro individual labels in the physical path.
- no future-year repeatability weighting.
- candidate F's blend weight cannot be learned from nonexistent reliability; no arbitrary single F value.
- 2026 N is temporally aligned direct/max-speed evidence; S is 2025 statistical proxy/context and is not a same-time direct measurement.

### Required SP-100 output

Produce a concise machine-readable and human-readable **production-wiring decision packet** comparing the admissible architectures only. At minimum evaluate:

- `N_PRIMARY_S_CONTEXT_OR_FALLBACK`: where available, 2026 N gives the primary physical/rank estimate; 2025 S remains sanity/context/fallback and is not arithmetically blended into N.
- `S_PRIMARY_N_CONTEXT`: retain statistical proxy as primary and use N only context.
- `NO_SINGLE_POINT_OWNER_REVIEW_ONLY`: no production physical point before another direct measure exists.

For each, evaluate annual-time alignment, construct directness, sampling/max-statistic caveat, coverage, provenance safety, circularity, and whether it requires an arbitrary unidentifiable weight.

The default technical recommendation should follow evidence quality, not symmetry. If `N_PRIMARY_S_CONTEXT_OR_FALLBACK` is recommended, make explicit that:

- N is not assumed error-free;
- generic reliability remains unknown;
- exposure affects confidence/context only;
- S is not blended by an invented weight;
- H2F remains separate low-confidence/context evidence;
- 2026 N is not copied backward to earlier seasons;
- absolute 0-100 display calibration remains provisional pending SP-071/engine bridge.

### Owner-decision guard

Search the repository for an explicit owner ruling made after the SP-100 v2 provenance repair that already ratifies one of these admissible architectures. If such a ruling exists, cite it and implement exactly that architecture, with regression QA, and SP-100 may close.

If no such explicit ruling exists, **do not pretend model preference equals owner approval**. Leave SP-100 `PARTIAL` with one exact owner-decision item, and produce an artifact containing the recommended option and the precise one-line approval needed. Do not change production behavior on that unresolved value judgment.

## Workstream D — SP-077 / SP-078 conditional downstream work

After Workstream A is integrated, re-read the registry.

### SP-077

If every declared `SP-077.depends_on` task is in a valid terminal state, generate the final owner review queue. The validator must fail if any dependency is not closed.

The queue must:

- cover the intended current-100 population exactly once,
- preserve stable player identity and provenance,
- show current physical/statistical evidence separately from Community Rating Consensus/context,
- include SP-075 owner-review context only where active under the cleaned policy,
- include SP-022 pairwise/range context without treating it as a physical teacher,
- show missingness explicitly,
- preserve physical point/range/confidence/provenance where already valid,
- clearly label any value that is provisional because SP-100 or SP-071 is still open,
- not assign owner verdicts automatically.

If SP-016 does not close, do not generate a fake final queue; leave SP-077 NOT_STARTED and record the blocker.

### SP-078

If SP-077 is generated, implement durable owner-verdict capture infrastructure:

- stable row/player key,
- explicit verdict/status fields,
- timestamp/source/reviewer fields,
- append/update semantics that do not silently overwrite a prior owner verdict,
- a no-overwrite regression test that deliberately tries to overwrite a recorded fixture and must fail,
- no real owner verdicts entered in this wave.

SP-078 may be `DONE_VALIDATED` as infrastructure only if the no-overwrite and schema tests pass. Do not interpret blank verdicts as approval.

## Registry / exclusions / QA

Update only rows directly touched by this work and inseparable exclusion-ledger rows.

Do not mark a task DONE merely because an output file exists. Require content-level checks.

Run the repository registry QA plus a separate independent re-read QA for this wave. Include hashes of all new/changed key artifacts.

The final QA must assert:

- no new network/external collection,
- no shoulder/SP-079/SP-080/SP-081 work,
- production scale finalization unchanged,
- no PowerPro individual teacher path introduced,
- no future-year annual-appraisal weighting introduced,
- raw provenance fail-closed guard still rejects NPB+ `hp_to_1b_sec`,
- SP-075 v4 hash/input is unchanged unless only referenced downstream,
- any SP-077 generation was dependency-gated,
- owner verdict count remains zero in this wave.

## Completion report

Return only these items after commit + push + remote verification:

1. branch
2. remote SHA
3. SP-016 final status + key repaired invariants + whether production default changed
4. SP-098 final status + exact outcome for 名原 / Santana / Shiomi
5. SP-100 final status + recommended/implemented architecture + whether owner decision is still required
6. SP-077 status + queue population count if generated
7. SP-078 status + no-overwrite QA result if implemented
8. number of real owner verdicts written (must be 0)
9. registry QA + independent QA counts/result
10. confirmation: no new external collection, no shoulder, no SP-079/080/081
11. exact remaining blockers to SP-079