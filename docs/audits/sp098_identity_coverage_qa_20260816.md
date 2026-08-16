# SP-098 identity / coverage QA — 2026-08-16

## Scope and result

This is **identity/coverage QA only**, not a final 2026 practical appraisal.
It uses only the repository's existing SQLite database and configuration; no X,
YouTube, Web, NPB, or other external collection was performed.  No owner
verdict was created.

Result: **16 PASS / 0 FAIL**.  All three required cases now have an explicit,
non-self-fulfilling outcome.

## Exact outcomes

| Player | Identity result | Coverage result | QA treatment |
| --- | --- | --- | --- |
| 名原 典彦 | Resolved through stable `BM_PLAYER:20230057`; `bm_player` has the same id in 2023–2026 and `npb_usage_2026` has the normalized name with 187 PA / 41 G.  There is no `player_link.proeye_id`. | 2025 first-team batting is `MISSING`: no named `v_batting` row and no ProEYE crosswalk are present. | Returned as `IDENTITY_RESOLVED_BATTING_COVERAGE_MISSING`, with `card=null` and `batting=null`; no 2025 batting value or ProEYE id was invented. |
| サンタナ | `サンタナ` plus 2025 / 東京ヤクルト resolves to exact DB relationship `Ｄ．サンタナ` / `53755153`. | First-team batting coverage exists for 2025. | The QA pipeline card has player id `53755153`.  The other same-surname DB person is `Ｊ．サンタナ` / `83585138` / 2019 広島. |
| 塩見 泰隆 | Exact DB relationship `71975136` / 東京ヤクルト / 2025. | A first-team 2025 row exists, with G=1, PA=0, AB=0. | `AB=0` produces a full non-batting card path: batting abilities remain null, while speed/arm schema and evidence remain present.  Current-season fielding has zero rows, recorded explicitly as `NOT_AVAILABLE_NO_CURRENT_SEASON_FIELDING_INNINGS`, not erased because AB is zero. |

## Repair and guards

- `resolveIdentity` now separates person resolution from first-team batting
  coverage.  A farm-only identity remains a farm canonical key; it is never
  promoted into a fabricated ProEYE player id.
- Name, team, season, and an optional explicit player id are constrained as a
  relationship.  A partial name cannot silently choose an arbitrary id.
- The historic SP-098 QA no longer treats a non-empty Shiomi id as success; it
  requires exact `71975136`.
- Negative fixtures pass only by failing as intended:
  1. bare `サンタナ` → `AMBIGUOUS_IDENTITY`;
  2. `サンタナ`, 2025, 広島 → `IDENTITY_CONSTRAINT_MISMATCH`;
  3. `サンタナ`, 2025, 東京ヤクルト, id `83585138` → `IDENTITY_CONSTRAINT_MISMATCH`.

## Reproduction

Run from the repository root:

```powershell
node scripts/sp098_identity_coverage_qa_20260816.mjs
```

Expected terminal result: `{"passed":16,"failed":0,"result":"PASS"}`.
The machine-readable receipt is
`outputs/derived/sp098_identity_coverage_qa_20260816.json`.

## Key hashes at QA run

- `src/cards/pipeline.mjs`: `889c3b8a3527511f19c848a35b6591896cde82b3f4031912ede5a41c918db64c`
- `scripts/sp098_identity_coverage_qa_20260816.mjs`: `36ad6ee724721d6c8a43dfbf81f5008513e50d035a09557f6b8a54181c98ca55`
- `outputs/derived/sp098_identity_coverage_qa_20260816.json`: `aebb3fd5782de145f286f4b2624b1c8c9599b88e7f6074cd854f0f84ebd0b4a9`
- `scripts/sp063_090_098_043_022_072_074_075.mjs`: `a73d73a32717c6094b313102f80c12bc1c6ead0fa4312d9af167e5787d8ffb7f`

SP-098 is eligible for `DONE_VALIDATED` once the central registry references
this receipt.  This does not authorize SP-079 or any owner verdict.
