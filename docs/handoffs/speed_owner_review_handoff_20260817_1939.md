# Speed owner-review handoff — 2026-08-17 19:39 JST

## Scope

This is the continuation point for the speed appraisal critical path. Do not reopen shoulder work and do not start broad external collection.

## Active repository state

- Repository: `L-carp55/pawapuro-pennant-gpt-handoff`
- Active branch: `review/opus-speed-pre-owner-review-wave-20260816`
- Verified pre-handoff code/artifact HEAD: `7277b69b446301c8a0d3f3072cd26cff7be04428`
- HEAD message: `fix(speed): preserve Community semantics in owner-review queue`
- GitHub Actions run `32016816027` completed **SUCCESS**.

## What just happened

A human-readable owner-review packet exposed a real semantic propagation defect after a prior structural unlock: the canonical clean-X source uses `owner_disposition / claim_lane / text_or_excerpt / published_at`, while the construct builder had read legacy field names. The Community lane object existed, so structural QA could pass while physical/technique/rating subrows were silently empty.

No owner verdict had been recorded, so no owner decision history was contaminated.

The repository was immediately re-locked and SP-077/SP-078 were reopened to PARTIAL before repair.

## Repair now completed and machine-verified

The latest successful construct build did all of the following:

1. repaired canonical Community semantic field mapping;
2. preserved SP-075 active policy exactly: **28 active X rows / 18 owner-review-context players**;
3. retained `usable_for_current100` as a qualifier rather than incorrectly using it to drop comparison/technique owner-review context;
4. regenerated the 100-player construct-complete SP-077 queue;
5. reran independent construct QA successfully;
6. added source-derived Community semantic propagation QA using exact `record_id`, category, content, date, URL and qualifier checks;
7. Community semantic QA result: **848/848 PASS, 0 FAIL**;
8. verified disposition counts: `CURRENT_POWERPRO_RATING=16`, `CURRENT_REALWORLD_SPEED_PHYSICAL=10`, `CURRENT_TECHNIQUE_CONTEXT=2`;
9. global construct traceability QA passed while locked;
10. regenerated the Priority-23 full-construct owner-review packet;
11. committed repaired builder + QA + regenerated artifacts.

Important regression fixtures now explicitly checked include 中川圭太 physical, 古賀悠斗 physical, 山口航輝 physical+technique, 塩見泰隆 physical, 岩田幸宏 physical, 柳田悠岐 physical.

## Current intentional locked state

Do **not** interpret the successful repair CI as an owner-review unlock.

Current canonical state is intentionally still:

- integrity lock: `locked=true`
- SP-077: `PARTIAL`
- SP-078: `PARTIAL`
- SP-079: `NOT_STARTED / BLOCKED`
- SP-078 `owner_verdict_count=0`
- SP-078 `records=[]`

The ledger is still bound to the **superseded pre-semantic-repair queue hash** `39a10b64857732ad8089b1528240f3ba9bce3e69c2c14a4af8bfe315fba4d9d2`. This is expected and MUST be rebound while empty before unlock. Do not write any verdict to it in the current state.

## Exact next step

Continue only the owner-review critical path:

1. inspect `scripts/finalize_speed_owner_review_rebind_20260817.mjs` and the unlock workflow;
2. make sure the atomic unlock transition now requires the new Community semantic QA PASS in addition to the existing structural/traceability gates;
3. recompute the regenerated queue SHA-256 from the current repaired queue;
4. rebind the still-empty SP-078 ledger to that exact regenerated queue hash;
5. reclose SP-077 and SP-078 to `DONE_VALIDATED` only inside the same fail-closed transition;
6. set `locked=false` only after all gates pass;
7. verify remote branch state and run normal registry/traceability/integrity CI against the committed post-unlock state;
8. only then begin real owner review from the regenerated Priority-23 packet.

If any gate fails, no unlock commit should be produced.

## Owner review rules after valid unlock

- Review the **full speed construct**, not top speed alone.
- The construct definition remains physical running ability from first running step to about 90 ft: initial acceleration + top speed + speed maintenance.
- NPB+ top speed is one current physical lane only.
- S is context/fallback only; no unidentified arithmetic N/S blend.
- `hp_to_1b_sec` from NPB+ remains MISATTRIBUTED_SOURCE / fail-closed; independent H2F evidence remains valid in its own lane.
- 30m/50m evidence must not be linearly converted to T90 without a validated bridge.
- pure foot speed must remain separate from stealing/baserunning technique.
- PowerPro is review/stale context only, never a player-level physical teacher.
- missing evidence is explicit missingness, never negative evidence.
- no 2026 N back-copy to earlier years.

## Previously discussed verdicts

Earlier simplified 10-player recommendations were made before the Community semantic propagation defect was discovered. They were **recommendations only** and were never written to SP-078. Do not treat them as owner decisions or automatically replay them. Re-review priority players from the repaired full-construct packet.

## Priority owner-review population after unlock

Continue with the union of SP-075 active context (18) and S-missing players (7), i.e. 23 priority players, before routine remaining 77.

Known priority names:
中川圭太 / カリステ / 大島洋平 / 郡司裕也 / ソト / ポランコ / 安田尚憲 / 山口航輝 / 藤原恭大 / 古賀悠斗 / ファビアン / モンテロ / 名原典彦 / 野間峻祥 / サンタナ / 古賀優大 / 塩見泰隆 / 岩田幸宏 / 山川穂高 / 柳田悠岐 / 佐藤輝明 / 木浪聖也 / 森下翔太.

## Files to read first in the next session

1. `docs/handoffs/speed_owner_review_handoff_20260817_1939.md`
2. `docs/state/speed_owner_review_integrity_lock_20260817.json`
3. `docs/state/speed_task_registry.tsv` — especially SP-077/078/079
4. `outputs/derived/qa_sp077_community_semantic_propagation_20260817.json`
5. `outputs/derived/qa_sp077_construct_complete_owner_review_queue_v2_20260817.json`
6. `outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json`
7. regenerated Priority-23 owner-review packet under `docs/reports/`
8. `outputs/derived/sp078_owner_verdict_ledger_20260816.json`
9. `scripts/finalize_speed_owner_review_rebind_20260817.mjs`
10. `scripts/qa_speed_construct_traceability_20260817.mjs`

## Do not do next

- Do not start shoulder.
- Do not start SP-079 before a valid unlock and actual owner verdict input.
- Do not write synthetic/assumed owner verdicts.
- Do not launch new X/YouTube/Web/NPB+ collection on this critical path.
- Do not downgrade Community records merely because `usable_for_current100=false`; SP-075 owner-review policy retains all rows with the three active `owner_disposition` values, with the qualifier preserved.
- Do not reopen already validated SP-016/SP-098/SP-100 unless a new concrete contradiction is found.

## Suggested first instruction in the next ChatGPT session

`パワプロ査定プロジェクトの続きです。GitHubの active branch review/opus-speed-pre-owner-review-wave-20260816 の docs/handoffs/speed_owner_review_handoff_20260817_1939.md を最初に読み、remote HEAD・lock・SP-077/078/079・Community semantic QAを照合して、記載された Exact next step から続けてください。走力だけを継続し、肩には進まないでください。`
