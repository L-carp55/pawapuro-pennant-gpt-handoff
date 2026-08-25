# Pennant unreviewed assistant-draft correction — 2026-08-26

Status: **CANONICAL STATUS CORRECTION / OWNER REVIEW REQUIRED / IMPLEMENTATION NOT AUTHORIZED**

## Why this correction exists

During the 2026-08-26 Pennant World owner-wall-talk session, Browser GPT advanced several OPEN design domains by writing detailed documents directly to GitHub without first presenting the full design material in chat for owner wall-talk, correction, acceptance, or rejection.

That workflow was incorrect.

The correct workflow is:

`assistant proposes in chat -> owner discusses/corrects/accepts/rejects -> stabilized result is preserved to GitHub`

Therefore the documents listed below must **not** be interpreted as owner-approved wall-talk merely because their internal headers say `OWNER WALL-TALK PRESERVED` or because they are referenced from the program-state authority list.

Until the owner reviews them in chat, their effective status is:

**ASSISTANT_DRAFT / OWNER_NOT_REVIEWED / NON-CANONICAL_DESIGN_DECISION**

This correction overrides any stronger status wording inside those documents.

## Affected documents

1. `docs/design/PENNANT_SPECIAL_ABILITIES_TRAITS_LIFECYCLE_WALLTALK_20260826.md`
   - commit: `09c0d805d623de7a5f6f1f4eebe186289ac164cb`

2. `docs/design/PENNANT_ROSTER_RIGHTS_WAIVERS_OPTIONS_SERVICE_TIME_WALLTALK_20260826.md`
   - commit: `4d55f2566c9d2ba8529e8b189e720be3ecfa100d`

3. `docs/design/PENNANT_FARM_MINOR_THIRD_FOURTH_TEAM_STRUCTURE_WALLTALK_20260826.md`
   - commit: `cf63243fd0e5353147473d9235c9681d31393630`

4. `docs/design/PENNANT_AMATEUR_PIPELINE_DRAFT_ELIGIBILITY_RIGHTS_WALLTALK_20260826.md`
   - commit: `9524427e73be96a89ffcc2f83faadc22a6413bf7`

5. `docs/design/PENNANT_CLUB_FINANCE_LEAGUE_ECONOMY_INFLATION_WALLTALK_20260826.md`
   - commit: `a5af36923c6d51578ff55632c73132827e6401e6`

6. `docs/design/PENNANT_INFORMATION_VISIBILITY_SCOUTING_FOG_WALLTALK_20260826.md`
   - commit: `de5793502e9c344c9b1ac7b1cdcd5a9805426d83`

7. `docs/design/PENNANT_AWARDS_HALL_OF_FAME_RETIRED_NUMBERS_LEGACY_WALLTALK_20260826.md`
   - commit: `c7755fd278862fcef9c02388a97629363f02e6c7`

8. `docs/design/PENNANT_SEASON_CALENDAR_SCHEDULE_TRAVEL_WEATHER_WALLTALK_20260826.md`
   - commit: `4b8d6b752437fa70e1d7f78f668f532a46ea9dc8`

## Program-state correction

`docs/state/pennant_design_program_state_20260824.json` was subsequently updated at commit `005e05e454a8f7026d7baf3bbb6538762bf77057` and placed these documents in its authority/current-progress context.

That state update must be read with this correction:

- the files physically exist and are useful assistant proposals;
- their existence/progress may be used to locate pending discussion;
- their detailed design decisions are **not owner-approved authority**;
- they must not be used to authorize implementation or to claim that the corresponding OPEN domain is closed;
- each domain returns to `OWNER_WALLTALK_PENDING_REVIEW` until discussed in chat.

## Domains returned to owner review

- special abilities / red traits / gold traits lifecycle;
- roster rights / waivers / options / assignment / service-time;
- farm / minor / third-fourth team structure;
- amateur pipeline / eligibility / progression / draft rights;
- club finance / league economy / inflation;
- information visibility / scouting fog;
- awards / Hall of Fame / retired numbers / legacy;
- season calendar / schedule / travel / weather.

## What remains valid

This correction does **not** delete the research, examples, current-rule anchors, or assistant reasoning in those files. They can be reused as proposals during the owner wall-talk. The owner may accept, modify, reject, split, or defer any part.

Earlier blocks that were actually surfaced and discussed in chat are not downgraded by this correction solely because they were also preserved in GitHub.

## Guardrails

- Do not silently promote these drafts back to owner-accepted status.
- Present the proposal in chat before saving an owner-approved revision.
- Preserve owner corrections verbatim in substance.
- Do not begin implementation from any affected draft.
- Existing SP-078 / SP-079 / shoulder / speed-canonical / PD-001A guards remain unchanged.
