# SP-078 proposal supersession — expanded MLB The Show scope

Date: 2026-08-18
Status: **SUPERSEDED / NOT APPROVABLE / LEDGER UNCHANGED**

The current owner-verdict proposal is superseded because it did not use the full eligible MLB The Show × NPB evidence universe.

The prior **6-player/7-pair** result was only a narrow same-time numeric-bridge test. It was incorrectly allowed to constrain the evidence population. It cannot be used to exclude:

- current-100 players with MLB promotion/appearance;
- historical NPB-before-2026 players;
- Japanese NPB→MLB players;
- foreign MLB→NPB players;
- NPB→MLB→NPB returnees;
- multi-cycle transitions;
- historical scale/calibration cohorts outside the current 100.

## Superseded artifacts

- `outputs/derived/speed_all100_integrated_owner_review_20260818.json`
- `outputs/derived/speed_all100_owner_review_adjudicated_20260818.json`
- `outputs/derived/sp078_owner_verdict_proposal_20260818.json`
- `docs/reports/sp078_owner_verdict_proposal_20260818.md`

These files remain diagnostic history. They must not be approved or copied into the append-only owner ledger.

## Preserved artifacts

The supersession does not invalidate:

- the 100-row SP-077 construct queue as evidence infrastructure;
- direct NPB+ top-speed evidence;
- independent H2F/T10/T30/T90/30m/50m evidence;
- Statcast measurements;
- PowerPro trajectory source data;
- Community, pairwise, stale/conflict, and provenance source receipts;
- the SP-078 append-only capture implementation.

## Correcting path

SP-101 must first:

1. reconstruct the full NPB↔MLB↔The Show identity universe;
2. build player-season and transition-segment timelines;
3. isolate Live/base roster Speed from non-Live cards;
4. keep Speed separate from Stealing/Baserunning Aggressiveness;
5. classify same-time, cross-time, transition, ordinal, and population-scale evidence roles;
6. propagate the eligible evidence into the current-100 packet;
7. rebuild individual adjudication and evidence-use receipts for all 100 players;
8. generate a new SP-078 proposal only after independent QA.

## Governance state

- Canonical owner verdict ledger: `records=[]`
- `owner_verdict_count=0`
- Owner review: **re-locked**
- SP-079: **blocked pending SP-101**
- Shoulder: **blocked**

Machine receipt:

`outputs/derived/sp078_proposal_supersession_receipt_sp101_20260818.json`
