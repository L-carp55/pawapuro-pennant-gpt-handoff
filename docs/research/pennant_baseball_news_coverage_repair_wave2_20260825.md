# Global Baseball News / History Idea Mining — coverage-repair Wave 2

Research date: 2026-08-25; event cutoff: 2026-08-24

## Outcome

Wave 1 remains the immutable baseline: 59 events, 8 candidates, and commit 881096ec374080316c7314fb93ab525f4470d2d7. Wave 2 adds explicit region × topic cells, NPB club receipts, separate era coverage, and semantic PW mapping.

- Wave 1 events: 59
- Wave 2 retained event records: 43
- Merged event index: 102
- Wave 2 NEW_CANDIDATE records: 1
- Wave 1 candidates PNC-001..PNC-008 retained as partial extensions
- Wave 2 promoted PNC-009: optional tier movement / promotion-relegation

## Coverage repair

The matrix contains 19 lanes × 17 topic families. Every cell records query formulations, source families, year coverage, retained events, negative result, second-pass result, and closure reason. A lane is not closed merely because two queries were executed.

Wave A is 2010-01-01 to 2026-08-24, Wave B is 1990-2009, and Wave C is pre-1990. Wave B/C recover NPB farm/draft/FA formation, MLB farm/expansion/rule/labor landmarks, Montreal's 1946 development environment, and the original ABL.

## NPB 12-club repair

All 12 NPB organizations have an individual receipt. Each lists search families, year coverage, category scope, retained events, negative findings, second-pass discovery, and closure reason. Negative findings are retained rather than inflated.

The strongest club additions are SoftBank's four-team system, Hanshin and Marines farm facilities, Giants development methods, BayStars international partnership, Yakult research culture, and Carp/Dragons academy evidence. Fighters and Eagles remain explicit duplicate/negative receipts.

## Semantic PW repair

Wave 1 references remain in the original columns. Corrected IDs are parallel columns, and the mapping ledger includes each referenced module and exact requirement text from the immutable PW ledgers.

The audit repairs the known PNC-007 contract/finance misreferences and PNC-005 integrity/topology misreferences, plus event-level over-broad uses such as PW-165 for stadiums and PW-205 for ABS. No canonical PW file was edited.

## Red-team

The red-team did not force NEW=0. Europe promotion/relegation became PNC-009 because adjacent PW-179/PW-180/PW-203 text does not explicitly require tier movement. Duplicate academy, farm, transfer, and CBA evidence was not promoted merely because it came from a new region.

## Remaining blind spots and blockers

- NPB private contract/medical records and club-by-club pre-1990 histories remain source-thin.
- Pre-1990 Europe, Africa, Caribbean, and local-language club archives are not saturated.
- Cuba and Puerto Rico need stronger federation/archive evidence for several cells.
- Current 2026 proposals and farm structures are time-sensitive and not permanent facts.
- Equipment/ball and officiating histories need more primary archival depth outside MLB/NPB.

Blocked source areas are recorded in the synthesis JSON and in matrix cells. Independent QA is run separately after this generator and is expected to report PASS_WITH_BLOCKERS when structural checks pass but the documented source blockers remain.
