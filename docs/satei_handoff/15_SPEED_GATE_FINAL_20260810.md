# SPEED GATE FINAL — 2026-08-10

## Verdict

**2026 NPB 100-player 走力 appraisal Gate: CLOSED.**

This closure applies to the appraisal/evaluation standard and the reviewed 100-player validation set. It does **not** claim that a production NPB+ Sprint Speed -> T90 bridge or a production NPB reference CDF has been statistically identified.

## Final chain

1. Appraisal principles frozen: `179e03c76c4379f4372da722741b1a705df66974`.
2. Physical evidence collection completed: `94a26e7160a879ea0e13f4ddb91d4fdadc7c04e9`.
3. Measurement-date resolution completed: `b374d1cb543e2035d9a18230e3b9245a616c6275`.
4. Exposure audit completed: `3be42ff62775cf98eec614f9ee733ae06d565bde`.
5. PowerPro temporal panel completed: `19fad9848b782c95bcdd97449fa5a9768da9f9b3`.
6. 100-player decision-ready integration + independent QA completed: `501f2d6ea638404a71a0026c530ead4cd6567e03`.
7. Independent 100-row human freeze completed at `a77c419613ed33b2d463ad309e755d32df2f632f`.
8. Post-freeze PowerPro external QA saved after the freeze. No rating was changed from QA.
9. The Show remains a negative-result / methodology QA source only because a reliable player-level NPB bridge and identifiable temporal change model are unavailable.

## Canonical final artifacts

- `outputs/derived/speed_2026_100_final_freeze_20260810.csv`
- `outputs/derived/speed_2026_100_final_freeze_20260810.json`
- `docs/audits/speed_2026_100_row_level_final_freeze_20260810.md`
- `outputs/derived/speed_2026_100_post_freeze_powerpro_qa_20260810.json`
- `docs/audits/speed_2026_100_post_freeze_external_qa_20260810.md`

The accidental placeholder-only commit `1516c176efafe5a220eda2a54034c438abf32756` is invalid and superseded. It is not part of the canonical chain.

## Final integrity checks

- 100 final player rows: PASS.
- P0/P1/P2 = 2/55/43: PASS.
- evidence tiers = Sprint-only 56 / historical-profile 35 / standardized-short-distance 7 / direct-T90-current 2: PASS.
- 名原典彦 retained without invented source player ID: PASS.
- no 30m/50m distance-ratio T90 conversion: PASS.
- no PA/proxy point correction: PASS.
- no fixed age-decay formula: PASS.
- PowerPro used only after independent freeze for external QA: PASS.
- The Show not used as rating teacher or correction target: PASS.
- post-freeze rating changes caused by game QA: 0, PASS.

## Final external-QA snapshot

PowerPro 2026 external comparison, n=99:

- independent mean 65.444 vs PowerPro mean 65.667
- MAE 7.677
- RMSE 9.756
- correlation 0.781
- within 10 points 68.69%
- >10-point residuals 31

These statistics are diagnostic only. The remaining large individual residuals are retained rather than fitted away.

## Final judgment rules to carry forward

1. Base 走力 is physical running ability, not baserunning/stealing technique.
2. Current top speed is a strong first-order signal but is not identical to first-90ft ability.
3. Clean direct T90 outranks top-speed proxy when temporally relevant.
4. Standardized electronic 30m/50m is acceleration/ordinal evidence; never raw distance-ratio T90 conversion.
5. Old or protocol-unknown profile times are directional evidence unless stronger current/standardized support exists.
6. Low exposure changes confidence, not points automatically.
7. PowerPro and The Show are external QA after independent appraisal, never teachers.
8. Unidentified production calibration must remain explicitly uncalibrated rather than fabricated.

## Remaining engineering limitation outside this appraisal Gate

`NPB+ Sprint Speed -> T90` and the final production NPB reference distribution remain **UNCALIBRATED / NOT IDENTIFIED FROM CURRENT PUBLIC DATA**.

That limitation does not reopen the 2026 100-player appraisal Gate. It should be addressed later only if new clean NPB calibration data become available.

## Scope transition

No shoulder appraisal work was performed as part of this Gate. The speed phase is now closed at the appraisal-design/100-player-validation level; a later phase may begin from this document without reopening completed speed collection work unless new evidence materially changes the calibration problem.
