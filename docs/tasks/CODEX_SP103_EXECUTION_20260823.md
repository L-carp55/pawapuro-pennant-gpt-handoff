作業フォルダ: /mnt/c/Users/amila/Desktop/Claude Code/repos/pawapuro-pennant-gpt-handoff
Repo: L-carp55/pawapuro-pennant-gpt-handoff

パワプロ査定プロジェクトの走力査定です。SP-079へ進む前に、SP-103「Speed Evidence Universe completeness audit」を完了してください。

## Start state

Target branch:
`codex/speed-sp103-evidence-universe-completeness-20260823`

Known activation HEAD includes:
- `docs/tasks/SP103_SPEED_EVIDENCE_UNIVERSE_COMPLETENESS_20260823.md`
- `docs/tasks/SP103_EVIDENCE_UNIVERSE_DISCOVERY_ADDENDUM_20260823.md`
- `docs/state/speed_sp103_activation_state_20260823.json`
- `outputs/derived/sp103_external_source_verification_seed_20260823.json`
- `outputs/derived/sp103_owner_feedback_seed_20260823.tsv`

Base upstream SP-102 completion commit:
`a2808b080be0eaefe95ba41da47bbfe1cf93cacb`

Before work:
1. `git fetch origin`.
2. Inspect `git status`, `git worktree list`, local/remote branch state and current HEAD.
3. Do not alter/reset/stash/clean the user's canonical checkout if it has unrelated modifications.
4. Do not reuse the old SP-101 worktree.
5. Use a fresh isolated worktree for the existing SP-103 branch, or an already registered SP-103 worktree only if it exactly points to this branch.
6. Read the five SP-103 files above in full, then read the canonical speed requirements/task registry/exclusion ledger and the SP-101/SP-102 final audits.

## Governance lock

During this task:
- SP-078 owner verdict count must remain 0.
- Do not run SP-079 final practical appraisal.
- Do not create final numeric speed ratings.
- Do not start shoulder/SP-082.
- Preserve SP-101 `DONE_VALIDATED` and SP-102 `DONE_NEGATIVE_FINDING` unless a real upstream provenance defect is discovered and independently proven.

## First repository change

Update the canonical task registry so that SP-103 is explicit and SP-079 depends on SP-103.

Use existing requirement IDs that genuinely cover this work rather than inventing a new immutable-baseline requirement merely for numbering convenience. At minimum inspect relevance of SR-043, SR-047, SR-048, SR-050, SR-052, SR-055, SR-058 and SR-061.

SP-103 must be gate-blocking until its independent QA produces `READY_FOR_SP079`.

Do not mark SP-079 active merely because SP-101/SP-102 are closed.

## Execution requirement

Execute the full parent specification and discovery addendum. This is a zero-based completeness audit, not a check-box review of the existing 18 SP-101 routes.

### Parallelize independent work

Use multiple independent sub-agents where writes do not conflict. At minimum separate:

A. local repository/database/data-asset inventory;
B. current official external-source landscape and source/provenance verification;
C. direct/near-direct physical evidence families;
D. outcome proxies and technique/double-count deconfounding;
E. MLB The Show / PowerPro / cross-league temporal evidence;
F. data-rich-to-data-poor transfer/inference methods;
G. owner-feedback and requirements traceability;
H. independent QA/red-team.

Each worker writes separate intermediate artifacts. Parent agent alone materializes canonical outputs.

## Critical things that must not be missed

1. NPB+ official current source now lists both Sprint Speed and fastest home-to-first separately. Do not revive old local `hp_to_1b_sec`; independently recollect/reconcile provenance.
2. MLB Statcast 90-foot Running Splits expose five-foot split structure; evaluate acceleration shape and standardized end-to-end use.
3. MLB Outfielder Jump Burst is separate from Reaction and Route; evaluate only as defensive-context burst evidence.
4. MLB Sprint Speed leaderboard also exposes Competitive Runs, Bolts and HP-to-1B; inventory exposure/tail/acceleration roles without double counting.
5. MLB Lead Distance / Lead Distance Gained may separate steal technique/start from physical speed.
6. WBC 2023/2026 has Statcast tracking and current NPB players in the searchable universe. Determine whether Sprint Speed / 90ft / other running values are actually retrievable. If not, close with bounded missingness; do not infer values.
7. MLB Pipeline historical `Run` scouting grades may add independent historical context for some MLB→NPB / prospect-linked players; check overlap with existing scouting corpus first.
8. DELTA/1.02 Spd is a mixed outcome proxy built from SB success/attempts, triples and scoring. Never promote it to direct physical evidence and audit double counting.
9. Existing local play-by-play/infield-grounder/baserunning-advance data may support better opportunity-conditioned proxy models; test incremental same-time construct validity rather than raw correlation with another mixed proxy.
10. Existing structured range metrics must be inventoried; do not equate defensive range with pure running speed.
11. Existing four analog methods, shared-indicator prediction, latent model, transition model, pairwise graph, consensus and ablation must be audited for **actual final decision use**, not only implementation existence.
12. Explicitly test data-rich anchor → data-poor transfer. Every sparse player must end in one of: supported transfer, bounded range/ordinal only, explicit no-common-support, or genuinely unresolved. Silent fallback is forbidden.
13. Audit top-speed dominance before SP-079. A route being high-quality does not justify making all other usable constructs irrelevant.

## External research rule

For current/niche external data, verify with official/primary sources first. Preserve URLs, retrieval timestamps, query/coverage denominators and negative findings. If an acquisition method errors, search official docs/issues for the exact problem before changing strategy.

Do not claim full-platform coverage from a bounded search.

## Required outputs

Produce every output required by `SP103_SPEED_EVIDENCE_UNIVERSE_COMPLETENESS_20260823.md`, including:

- `outputs/derived/sp103_speed_evidence_universe.tsv`
- `outputs/derived/sp103_local_asset_inventory.json`
- `outputs/derived/sp103_external_source_verification.json`
- `outputs/derived/sp103_collected_but_unused.json`
- `outputs/derived/sp103_inference_method_universe.json`
- `outputs/derived/sp103_owner_requirement_traceability.tsv`
- `outputs/derived/sp103_gap_and_remediation_plan.json`
- `outputs/derived/sp103_pre_sp079_readiness.json`
- `outputs/derived/qa_sp103_speed_evidence_universe.json`
- `docs/audits/sp103_speed_evidence_universe_completeness.md`

Also preserve source snapshots/manifests needed to reproduce any new collection.

## Independent QA

Independent QA must challenge the parent outputs, including substantive fail-before fixtures where appropriate. It must inspect actual computations/coverage and must not pass merely because expected fields/status strings exist.

At minimum verify:
- all mandatory evidence families plus newly discovered candidates are represented;
- repo-wide scan is schema/content-based rather than hard-coded small path list;
- collected-but-unused findings are measured;
- source authority/provenance conflicts are not silently resolved;
- owner-feedback rows map to exact routes or explicit gaps;
- sparse-player anchor transfer has leakage/common-support guards;
- proxies do not double count underlying events;
- technique does not leak into pure physical speed;
- top-speed dominance is measured;
- negative findings remain scoped;
- deterministic rerun for deterministic transforms;
- owner verdict count remains 0;
- SP-079 and shoulder remain unexecuted.

## Bounded remediation policy

If gaps are found, rank them by expected information gain and likely materiality to final 100-player appraisal.

Repair/collect in this SP-103 wave only when the gap is both feasible and plausibly material. Do not expand indefinitely. Persist inaccessible/low-value gaps as explicit bounded missingness or measured negative findings.

Any remediation must be independently re-audited before SP-103 readiness can pass.

## End state

SP-103 terminal state may be:
- `DONE_VALIDATED_READY_FOR_SP079`, if the universe is complete enough and material gaps are closed/bounded; or
- `DONE_NEGATIVE_FINDING_READY_FOR_SP079`, if exhaustive work finds no additional decision-effective evidence but completeness itself is validated; or
- `PARTIAL/BLOCKED`, if a material unresolved gap remains.

Even if SP-103 becomes ready, **stop there**. Do not start SP-079 automatically. Commit and push all artifacts, verify remote HEAD, then report the exact branch/commit, QA counts, newly discovered evidence families, material gaps/remediations, and readiness state.
