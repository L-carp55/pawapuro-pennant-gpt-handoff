# SP-101 MLB The Show × NPB universe lower-bound census

Date: 2026-08-18
Status: **MEASURED LOWER BOUND — NOT COMPLETE UNIVERSE**

## Conclusion

The previously cited **6 players / 7 pairs** cannot be used as the number of players for whom MLB The Show evidence is usable. It was only the narrow sample available for one same-time The Show→PowerPro numeric-bridge test.

The eligible universe is substantially broader and includes current NPB players with MLB experience, historical NPB players, Japanese NPB→MLB players, foreign MLB→NPB players, returnees, multi-cycle transitions, and historical calibration players outside the current 100.

## Existing local snapshot

The local database snapshot already contains:

| Asset | Rows | Distinct identity keys/names | Interpretation |
|---|---:|---:|---|
| `mlb_bridge` | 79 | 79 NPB names | Historical lower bound, not complete MLB-promotion universe |
| `the_show_bridge` | 47 | 47 NPB names | Historical lower bound, not complete The Show universe |
| `the_show_rating` | 17,476 | 5,024 name keys | Multi-edition raw card/roster inventory |
| `the_show_rating`, `series=Live` | 10,400 | 4,424 name keys | Primary local Live/base roster candidate panel |
| `pawapuro_full` | 3,229 | 943 normalized names | NPB/PowerPro historical universe, 2013–2026 |
| `pawapuro_full_link` | 1,879 | 682 linked ProEye IDs | Existing partial NPB/PowerPro identity bridge |

The local The Show edition counts are:

| Edition | Rows | Unique name keys |
|---|---:|---:|
| MLB21 | 3,115 | 2,293 |
| MLB23 | 4,101 | 2,468 |
| MLB24 | 3,636 | 2,379 |
| MLB25 | 3,645 | 2,421 |
| MLB26 | 2,979 | 2,278 |

These counts are not yet the NPB-linked eligible population. They prove that the raw source universe is much larger than seven observations and that identity reconstruction—not evidence absence—is the current bottleneck.

## Current-100 bridge diagnosis

The 100 NPB+ players produce:

- Exact current production-ID overlap with `mlb_bridge`: **0**
- Exact current production-ID overlap with `the_show_bridge`: **0**
- Normalized-name overlap with `mlb_bridge`: **4** — モンテロ、カリステ、サンタナ、ポランコ
- Normalized-name overlap with `the_show_bridge`: **2** — モンテロ、ポランコ

This does **not** mean only two or four current players have MLB/The Show evidence. It diagnoses an incomplete/stale crosswalk and ID-namespace mismatch.

Obvious examples include:

- ソト: current 100, but absent from both local bridges
- サンタナ and カリステ: present in the MLB bridge but absent from the local The Show bridge
- 秋山翔吾: current 100 and historically in MLB/The Show, but absent from the local current bridge intersection
- 鈴木誠也 and 吉田正尚: outside the current 100 but essential Japanese NPB→MLB trajectory/calibration cases

## External source repository

`L-carp55/claude-code-hub` contains larger source assets:

1. `codex/mlb-the-show-speed-history` @ `97c429521267cfb70ccdd61e40e11853d100e360`
2. `codex/mlb-the-show-speed-temporal-rescue` @ `ab5adbfee656d69d0b378145fd66bf5789e0d1b4`
3. `codex/mlb-the-show-full-attributes` @ project reference `74d2a2278ab7bcea3f6368e1df6ba03e2dd82554`

The full-attributes audit reports observed Live snapshots for MLB21–MLB26, **12,441 Live rows** and **11,945 unique players**. MLB17–MLB20 remain uncollected in that snapshot. These are source-inventory figures, not the final NPB-linked count.

The temporal-rescue branch also preserves explicit player-level annual/major speed update events where reproducible rather than relying only on one edition snapshot.

## Correct interpretation of the former 7-pair result

The 6-player/7-pair result remains useful only for this statement:

> An unrestricted universal same-time The Show→PowerPro numeric conversion was not identifiable from that narrow overlap.

It does not invalidate:

- other editions or seasons for the same players;
- cross-time player trajectory evidence;
- Japanese NPB→MLB players;
- foreign MLB→NPB players;
- NPB→MLB→NPB returnees;
- multi-cycle transition segments;
- historical NPB players outside the current 100;
- ordinal, transition, and population-scale uses.

## Required modeling roles

The rebuilt panel must keep these roles separate:

1. Direct physical Statcast evidence
2. Same/near-time cross-game QA
3. Cross-time player trajectory/prior
4. League-transition calibration
5. Historical population scale-shape QA
6. Speed/Stealing/Baserunning technique separation

Cross-time evidence is not copied directly to the target-season rating. It is retained with explicit time, transition, age/injury availability, source, and confidence controls.

## Governance consequence

- The old SP-078 proposal is superseded and not approval-ready.
- The canonical SP-078 ledger must remain empty.
- Owner review is re-locked.
- SP-079 must wait for SP-101 and a rebuilt all-100 requirements-to-decision review.
- Shoulder remains out of scope.

Machine-readable census:

`outputs/derived/sp101_the_show_npb_universe_census_20260818.json`
