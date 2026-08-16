# SP-016 repaired current-year-first low-sample history policy

Status: **DONE_VALIDATED**

Production default: `current_year_first_low_sample_prior`. All current evidence is retained. For current PA below 50, the estimate is `(n_c*z_c + λ*n_h*z_h)/(n_c + λ*n_h + κ)`; κ is an explicit zero-centred population prior. At or above 50 PA, both the result `z_c` and the effective reliability weight are current-year-only, so history changes neither the output nor its subsequent trait rating.

The historical-weight cohort is reconciled at source level. The raw pre-X-1 query reproduces the prior audit exactly: 260 production player_id rows, 241 historical-prior recipients, upper median PA_hist=520. The required split-team dedupe keeps the same 260/241 cohort but removes 15 duplicate player-seasons and 1628 excess PA; the corrected median is 505. Therefore λ is `0.09900990099009901` = 50/505. Low-PA retention expands audit coverage to 358 current scored rows, but does not silently redefine the established display-calibration cohort. No PowerPro individual label or future outcome determined any parameter.

The local-only QA independently reproduced A-1, A-3, A-4, B, F, X-1 and X-4. X-2 is explicitly falsified for the checked current legacy source; this repaired script is deterministic and is rerun externally for byte identity. The old pre-sufficiency filter produced 71 false no-current cases; the repaired path preserved 169 low-PA current observations.

The QA contains intentional failing fixtures for monotonicity, non-zero history above sufficiency, duplicate player-season input, malformed input, wrong-population λ, and the independent production gate. All were rejected.

Machine-readable result: `outputs/derived/sp016_current_year_first_repair_qa_20260816.json` (SHA-256 `cf4bbb7baa4039489c61c43b2d5e3598e1b3be52e5677e42f8300c7dacac4d19`).
