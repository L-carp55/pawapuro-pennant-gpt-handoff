# Community Rating / YouTube / Prospi rescue run2 — QA

- generated_at: 2026-08-13T11:31:47Z
- verdict: **PASS**
- issue_count: 0

## Checks

- SP-032: actual old Grok-X ledger=191; original accepted preserved=41; rejected passed row-for-row=150.
- SP-033/034: yt-dlp preflight was verified from run2 logs; inventory videos=56; QA classification exclusions=3 corrected in integrated raw.
- SP-054/055: gamex reachability HTTP 200 is recorded; current={'NOT_FOUND': 84, 'RETRIEVED': 17}; historical={'RETRIEVED': 119, 'NOT_FOUND': 105}; 2024S2 HTTP 404 retained.
- Raw=473, filtered=31, summary=100 joinable master rows.
- UTF-8 decode and replacement-character checks passed for every checked artifact.

## Issues

- None.
