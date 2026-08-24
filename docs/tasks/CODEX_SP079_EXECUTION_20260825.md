作業フォルダ: /mnt/c/Users/amila/Desktop/Claude Code/repos/pawapuro-pennant-gpt-handoff
Repo: L-carp55/pawapuro-pennant-gpt-handoff

パワプロ査定プロジェクトの走力査定です。SP-104はbrowser独立監査で実質承認され、次はSP-079「Final practical 100-player speed reappraisal」です。このSP-079だけを実行してください。

## Target

Branch:
`codex/speed-sp079-final-practical-reappraisal-20260825`

Read in full before work:

1. `docs/tasks/SP079_FINAL_PRACTICAL_100_PLAYER_REAPPRAISAL_20260825.md`
2. `docs/state/speed_sp079_activation_state_20260825.json`
3. `docs/audits/sp104_browser_independent_review_20260825.md`
4. `docs/state/speed_sp104_readiness_override_20260825.json`
5. SP-103 evidence universe / owner traceability / gap / inference-method artifacts
6. SP-104 canonical physical/MLB/transfer/all-100/ablation artifacts
7. SP-101 final semantic audit and current100 multibridge/decision-use artifacts
8. SP-100 owner-approved NPB+ physical policy
9. SP-078 owner ledger (must remain empty)

## Worktree safety

- `git fetch origin` first.
- Inspect `git status`, `git worktree list`, local/remote branch state and HEAD.
- Do not alter/reset/clean the user's canonical checkout.
- Do not touch any pre-existing stash, including `stash@{0}`.
- Use a fresh isolated worktree for this exact SP-079 branch unless a clean registered exact worktree already exists.
- Do not reuse old SP-101/SP-102/SP-103/SP-104 worktrees for writes.

## First action: reconcile canonical registry

Before any rating generation, update `docs/state/speed_task_registry.tsv` to the browser ruling:

- SP-104 => `DONE_VALIDATED`, preserving `BLOCKED_EXTERNAL_CURRENT_VALUE_SURFACE` for current NPB+ H2F as bounded missingness and referencing `docs/audits/sp104_browser_independent_review_20260825.md` plus `docs/state/speed_sp104_readiness_override_20260825.json`.
- SP-079 => `PARTIAL` while executing; dependencies remain SP-103/SP-104 and all prior prerequisites.
- Preserve SP-101=`DONE_VALIDATED`, SP-102=`DONE_NEGATIVE_FINDING`, SP-103=`DONE_VALIDATED`.
- owner verdict count must remain 0.
- SP-080/SP-081/shoulder remain not run/blocked.

Run `node scripts/qa_speed_task_registry.mjs` immediately and fail closed if it does not pass.

## Core appraisal rule

This is the first task allowed to produce the 100-player practical speed recommendations.

Do NOT reuse the old production blend as the answer.
Do NOT fit or manually tune to current PowerPro ratings.
Do NOT make NPB+ peak speed the definition of final speed.
Do NOT force a transfer model when SP-104 says no common support / no selected production transfer.

The target construct is baseball-relevant physical running speed. Keep stealing/baserunning technique separate.

## Mandatory appraisal workflow

Follow the parent SP-079 spec exactly. In particular:

### 1. Freeze appraisal policy before values

Create `outputs/derived/sp079_appraisal_policy.json` before player ratings. It must state:

- evidence tiers/hierarchy;
- how peak speed, acceleration/H2F, T90/90ft, historical 30m/50m, MLB running evidence, The Show context, analog/ordinal constraints, age/injury, scouting/community/video, proxies, and technique are handled;
- missingness rule;
- conflict rule;
- uncertainty/interval rule;
- provisional 0–100 display mapping rule;
- PowerPro post-hoc-only rule.

No player-specific manual exceptions may be inserted after seeing PowerPro unless documented as a new independently sourced evidence correction.

### 2. Use all decision-effective evidence, not all evidence blindly

Consume the SP-103 71-row universe according to its classification:

- IMPLEMENTED / decision-effective: use under its guard;
- COLLECTED_BUT_UNUSED remediated by SP-104: use the new canonical SP-104 form;
- SOURCE_CONFIRMED_NEW but uncollected/nonblocking: retain as missingness, do not fabricate;
- MEASURED_NEGATIVE / SCOPED_REJECTED: preserve the narrow exclusion;
- context-only/technique: never promote to pure physical point evidence.

### 3. Current NPB+ peak speed

Use SP-100 NPB+ Sprint Speed/top-speed as the primary **peak-speed lane**, not the full final answer. Preserve exposure/reliability limits.

Current NPB+ fastest-H2F per-player values remain unavailable on the reproducible public surface. Do not read/resurrect the quarantined legacy local `hp_to_1b_sec` field.

### 4. Historical physical evidence

Use `outputs/derived/sp104_historical_physical_canonical.jsonl` with its protocol/date/range/confidence guards.

- 30m/50m is short-distance physical evidence, not T90.
- direct T90/basepath/full-effort evidence is a distinct high-value lane.
- H2F batting side/start/swing context must remain visible.
- older/uncertain measurements contribute bounded ranges, not false exactness.

### 5. MLB Statcast running evidence

Use the SP-104 frozen official running-splits and Sprint exposure/H2F data where identity/time/support permit.

- standardized 90ft and raw HP-to-1B are distinct;
- missing qualification is not slow;
- Bolts need Competitive Runs exposure context;
- five-foot acceleration shape may be context only if validation did not support numeric transfer;
- current NPB transfer must preserve time/league uncertainty.

### 6. MLB The Show / cross-league evidence

Use the full SP-101 eligible universe, not a tiny 6/7-pair bridge.

Allowed roles:
- longitudinal Speed trajectory;
- roster-update response;
- NPB→MLB / MLB→NPB / returnee/multi-cycle context;
- relative/ordinal/analog constraints;
- external appraisal consensus/conflict.

Forbidden:
- direct The Show Speed -> current NPB rating conversion;
- PowerPro label as physical teacher;
- using The Show Stealing/Baserunning Aggressiveness as physical speed.

### 7. Data-rich -> data-poor

Use validated SP-101 analog/ordinal/common-support routes and SP-104 receipts.

- TF-056/060/062 are `BOUNDED_CONTEXT` only.
- TF-057/058/059/061 are `NO_COMMON_SUPPORT` under SP-104 and must not be silently promoted.
- no production SP-104 transfer method was selected.
- a sparse player may legitimately remain wide-interval / peak-only / unresolved.
- silent fallback to old model or current PowerPro is forbidden.

### 8. Proxies and context

Use statistical proxies only under their existing deconfounding/double-count rules. Keep stealing/baserunning technique separate.

Scouting/community/video/pinch-runner/defensive context can support or challenge direction/confidence when valid, but cannot overpower stronger physical evidence without an explicit conflict state.

### 9. Produce exactly 100 final practical rows

Each row must contain the fields required by the parent spec, including:

- latent percentile point/interval where defensible;
- provisional practical 0–100 rating and interval;
- confidence;
- evidence state;
- material reasons/conflicts/missing lanes;
- material evidence IDs;
- change vs pre-SP079 project estimate;
- PowerPro difference for QA only;
- `scale_status=PROVISIONAL_PENDING_SP071_SP072`.

Do not drop hard cases. If precision is not defensible, widen the interval and lower confidence rather than inventing precision.

## Final-value ablation is mandatory

This must recompute the actual final recommendation, not just flip evidence labels.

Remove one family at a time and rerun:

1. peak speed;
2. acceleration/H2F/T90/90ft;
3. historical physical;
4. MLB Statcast running bridge;
5. The Show context;
6. analog/ordinal/transition;
7. statistical proxies;
8. scouting/community/video/usage context.

Record point/interval/rank/confidence/conflict changes for all 100 players.

Measure final-rating/rank correlation with NPB+ peak speed and leave-peak-out changes. Do not optimize for a target correlation or a target count of peak-only players.

## Independent QA / red-team

Use a separate independent process/model if available; otherwise a clearly separate deterministic/red-team process with isolated outputs. Do not self-certify by reading expected status strings only.

Fail-before fixtures must detect at least:

- PowerPro teacher leakage;
- direct The Show copy;
- legacy NPB+ H2F use;
- 30m/50m→T90 conversion;
- missing source row→zero/slow;
- target self-teaching / same-player season leakage;
- technique leakage;
- proxy event double-count;
- fake ablation that does not recompute final ratings;
- silent omission of any of 100 players;
- hard-coded peak-speed dominance;
- owner verdict write / shoulder output.

Deterministic stages must rerun byte-identically from frozen inputs.

## End-state rules

If all checks pass:

- SP-079 may become `DONE_VALIDATED`.
- owner verdict remains 0.
- do not run SP-080 or SP-081.
- do not start shoulder.

If some players cannot receive a defensible point recommendation without violating guards, keep their rows and intervals and close SP-079 `PARTIAL` with the smallest real blocker; do not force ratings to get DONE.

Commit/push all outputs and verify remote HEAD. Then report:

- exact branch + commit;
- registry status;
- 100/100 coverage;
- rating distribution and confidence distribution;
- evidence-state distribution;
- largest rating changes vs pre-SP079;
- largest PowerPro differences (QA only);
- top-speed correlation and leave-peak-out findings;
- The Show/MLB/analog material-use counts;
- unresolved/widest-interval players;
- independent QA counts;
- owner verdict count;
- confirmation SP-080/SP-081/shoulder were not run.
