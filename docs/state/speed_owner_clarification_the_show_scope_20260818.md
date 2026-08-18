# Owner clarification — MLB The Show eligible scope for speed appraisal

Date: 2026-08-18
Status: **BINDING OWNER CLARIFICATION**

## Clarification

The previously cited **6 players / 7 same-time pairs** describe only the narrow sample available for testing an unrestricted same-time MLB The Show → PowerPro numeric conversion. They are **not** the population of players for whom MLB The Show evidence can be used.

The eligible evidence universe includes every NPB-linked player with MLB promotion/appearance and eligible MLB The Show history, including:

1. **Current-100 MLB-experienced players** — every current appraisal player with any MLB regular-season promotion/appearance and an eligible The Show Live roster observation.
2. **Historical NPB-before-2026 players** — players who appeared in NPB before 2026 and have MLB/The Show evidence, even when absent from the current 100.
3. **Japanese NPB → MLB players** — including players still in MLB, for cross-league transition, game-scale calibration, and player-specific trajectory evidence.
4. **Foreign MLB → NPB players** — including first-time NPB imports and later returnees.
5. **NPB → MLB → NPB returnees** — Japanese and foreign players whose sequence supplies before/after transition evidence.
6. **MLB → NPB → MLB and other multi-cycle players** — each transition segment remains separate and time-indexed.
7. **Historical calibration population** — all historical NPB/PowerPro players with MLB/The Show overlap for scale-shape, ordinal, temporal-decay, and transition QA.

## Role of cross-time evidence

A The Show value from before or after the target NPB season remains evidence. A time gap changes its role and weight; it does not erase the record.

- **Same/near-time rows:** strongest cross-game comparison evidence.
- **Cross-time rows:** player-specific trajectory or prior evidence with explicit temporal, age, injury, and league-transition treatment.
- **NPB↔MLB transition cohorts:** evidence for systematic transition effects and their uncertainty.
- **Historical players outside the current 100:** population-level scale-shape, compression, tail, and ordinal QA.
- **Direct Statcast measurements:** physical evidence, kept separate from game ratings.
- **MLB The Show Speed:** external game appraisal/context, not a direct physical measurement and not a current PowerPro teacher.

## Product and attribute controls

- Live/base roster rows are the primary numeric panel.
- WBC, Flashback, Finest, Topps Now, Awards, and other non-Live cards are isolated unless a separate contextual role is justified.
- `Speed`, `Stealing`, and `Baserunning Aggressiveness` remain separate fields and constructs.
- Multiple editions or transition segments for one player must not be collapsed into one lifetime average.
- Validation must be player-clustered; cards or editions of one player cannot be split across train and test.

## Clarification of SR-060

SR-060 closes an **unrestricted direct cross-time numeric conversion path** from an old The Show value to a current PowerPro number. It does not authorize discarding:

- player-year The Show history;
- cross-time trajectory evidence;
- Japanese NPB→MLB cases;
- foreign MLB→NPB cases;
- returnees and multi-cycle transitions;
- ordinal comparisons;
- population-level measurement→game-scale QA.

Any future claim that The Show is usable for only the 6-player/7-pair sample is invalid.

## Governance consequence

The current SP-078 proposal is not approval-ready. Owner review remains locked until SP-101 reconstructs the full eligible universe, repairs identities and transition timelines, propagates role-appropriate evidence into the current-100 packet, and the all-100 review is rebuilt with explicit evidence-utilization receipts.
