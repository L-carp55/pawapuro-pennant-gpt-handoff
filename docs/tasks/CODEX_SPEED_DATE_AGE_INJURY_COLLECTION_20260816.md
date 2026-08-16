# CODEX SPEED DATE / AGE / INJURY COLLECTION WAVE — 2026-08-16

## Objective

Perform the large, repetitive external-data collection needed to unblock later Browser-GPT/Opus decisions for:

- SP-020 — physical measurement ledger / date precision
- SP-044 — birthdate/age join
- SP-045 — injury/recovery dated evidence

This branch is **collection + normalization + provenance + QA only**.

Do not change `docs/state/speed_task_registry.tsv`, `docs/state/speed_exclusion_reason_ledger.tsv`, production code/configs, appraisal formulas, ratings, owner-review queue, shoulder, or Speed Gate status. Browser GPT will inspect and integrate the evidence after this collection branch is complete.

Base SHA:
`4022cc54a5ad6ea0869468a6c3c6a3360cb13337`

Use independent subagents in parallel where possible (e.g. measurement dates / birthdates / injury evidence), then consolidate on this one branch.

---

# Global collection rules

1. Prefer primary/official sources:
   - NPB official player/team pages and official NPB publications
   - official team player profiles/news/transactions
   - official league/team announcements
   - original measurement/profile article if clearly attributable
2. If primary sources do not contain the requested fact, high-quality secondary sources may be preserved in a clearly lower source tier; do not silently promote them to official.
3. Every accepted fact needs:
   - source URL
   - source title/publisher
   - accessed_at
   - player identity
   - fact type
   - date or date precision
   - source tier
   - extraction note / relevant evidence excerpt paraphrase
4. No invented exact dates. Distinguish at least:
   - `EXACT_EVENT_DATE`
   - `PUBLICATION_DATE_ONLY`
   - `SEASON_OR_YEAR_ONLY`
   - `SNAPSHOT_DATE_ONLY`
   - `UNKNOWN`
5. Missing search results are not proof a fact does not exist. Record search attempts / bounded missingness.
6. Do not infer injury from low PA, deregistration alone, poor performance, age, or absence from games.
7. Do not infer recovery merely from return to active roster unless the source explicitly establishes injury/recovery context; roster return may be preserved separately as transaction context.
8. Do not convert 30m/50m times proportionally to T90. Preserve raw measurement and protocol.
9. Do not use PowerPro/Prospi labels as physical truth.
10. No X/social-media collection unless an official team/league account is the only primary publication and its provenance is explicit. Ordinary fan/social content is out of scope.

---

# Track A — SP-020 physical measurement date/precision ledger

Read all current physical-measurement artifacts first, including at minimum:

- `data/normalized/speed_historical_physical_measurements_2015_2026.json`
- `data/manual/npb_speed_physical_evidence_full_20260809.json`
- `outputs/derived/sp017_physical_measurement_range_reclassification.json`
- `outputs/derived/npb_speed_measurement_date_resolution_20260809.json`
- `outputs/derived/sp020_date_resolution_status_20260814.json`
- `outputs/derived/sp100_wiring_candidates_20260814.json`
- NPB+ provenance files / screenshots metadata

Goal is not “force exact dates for 100 players.” Goal is a truthful, record-level ledger that resolves the **best supported temporal precision** for every physical measurement used or retained as evidence.

For each unique underlying measurement / measurement cluster:

- identify player / canonical id where possible;
- retain raw metric/value/unit;
- retain source/protocol/measurement cluster;
- determine best supported date precision;
- distinguish measurement/event date from article publication date and from data snapshot date;
- if only season/year is knowable, say so;
- if the source date cannot be recovered, mark `UNKNOWN` and record attempted sources;
- dedupe reposts/transcriptions of the same measurement.

Special caution:

- NPB+ top speed is a maximum-speed snapshot. Do not fabricate the date of the underlying max-speed event unless the source exposes it.
- `hp_to_1b_sec` is not an NPB+ direct measurement; preserve the corrected provenance rules already in repo.

Required summary counts:

- unique measurement clusters
- exact event dates
- publication-date-only
- season/year-only
- snapshot-date-only
- unknown
- current100 player coverage for each class
- source-tier distribution
- unresolved clusters with attempted-source receipts

Do not call an unresolved date `MEASURED_NEGATIVE`; it is missing/unknown temporal precision.

---

# Track B — SP-044 birthdates / age join

Collect birthdates for the current 100-player appraisal population from official player/team/NPB sources where available.

Required schema per player:

- canonical player name
- player_id used by project, if available
- team
- birthdate ISO `YYYY-MM-DD`
- source URL
- source publisher/title
- source tier
- accessed_at
- identity match method
- identity confidence
- notes for name collisions

QA requirements:

- target population exactly the repository current100, not an independently guessed roster;
- 100 rows in the master join, including explicit unresolved rows if any;
- no duplicate canonical player identities;
- birthdate format validation;
- computed age is derived only after birthdate is present and must specify reference date; prefer preserving birthdate as canonical fact;
- manually review name-collision risks and foreign-player aliases.

If an official profile cannot be found, retain unresolved and optionally add a lower-tier secondary source as a separate candidate rather than silently using it as official.

---

# Track C — SP-045 dated injury/recovery evidence

Scope: current100 players, prioritizing evidence relevant to current/annual appraisal and historical carryover decisions. Search **2025-2026 first**; go earlier only when an already-retained historical measurement or existing project case explicitly needs the injury/recovery date for temporal interpretation.

Collect only explicit injury/recovery evidence such as:

- official injury diagnosis / condition announcement
- official surgery announcement
- official rehabilitation / return-from-injury announcement
- official statement tying absence/roster move to injury
- official dated return/recovery note

Keep separate from:

- generic roster deregistration/registration with no injury reason
- rest/conditioning
- tactical demotion
- illness unless explicitly relevant to physical speed and clearly documented
- fan inference

Required event schema:

- player
- player_id
- event_date
- event_type (`INJURY`, `SURGERY`, `REHAB`, `RETURN_FROM_INJURY`, `INJURY_RELATED_DEREGISTRATION`, etc.)
- body_part / diagnosis if explicitly stated
- source URL
- source publisher/title
- source tier
- source publication date
- event-date precision
- explicitness flag
- evidence note
- whether usable as a reason-gate candidate for historical speed context (`true/false` + reason)

Also produce a 100-player coverage table with statuses such as:

- `EXPLICIT_INJURY_OR_RECOVERY_FOUND`
- `SEARCHED_NO_EXPLICIT_SOURCE_FOUND`
- `SEARCH_NOT_COMPLETED`

`SEARCHED_NO_EXPLICIT_SOURCE_FOUND` means only that this bounded collection did not find an explicit source; it must never be interpreted as “player had no injury.”

Do not automatically decide that any injury changes speed. This collection only supplies dated context that later appraisal logic may or may not use.

---

# Provenance / reproducibility

Create machine-readable search receipts sufficient to audit collection coverage without relying on chat history.

At minimum preserve:

- query / target player
- source/domain searched
- result URL or no-result status
- accepted/rejected reason
- retrieval date

Deduplicate repeated URLs and same underlying announcements.

When multiple pages copy one announcement, preserve the primary source as canonical and secondary pages as corroboration, not independent evidence.

---

# Deliverables

Create new 20260816 artifacts rather than overwriting old audit history. Suggested names (you may improve names while preserving clarity):

- `data/normalized/speed_physical_measurement_date_ledger_20260816.json`
- `outputs/derived/sp020_measurement_date_collection_20260816.json`
- `data/normalized/speed_current100_birthdates_20260816.csv`
- `outputs/derived/sp044_birthdate_collection_20260816.json`
- `data/normalized/speed_current100_injury_recovery_events_20260816.jsonl`
- `outputs/derived/sp045_injury_recovery_collection_20260816.json`
- `outputs/derived/speed_date_age_injury_search_receipts_20260816.jsonl`
- `outputs/derived/speed_date_age_injury_collection_qa_20260816.json`
- `docs/audits/speed_date_age_injury_collection_20260816.md`

Do not modify registry/exclusion ledger in this branch.

---

# QA

Machine QA must at minimum verify:

- current100 master population count = 100 for birthdate and injury coverage tables;
- no duplicate canonical identities;
- source URL present for every accepted fact;
- date precision explicitly classified;
- no exact date is inferred from a year/snapshot/publication date;
- no low PA / roster absence is converted into injury;
- no ordinary fan/social evidence accepted;
- NPB+ `hp_to_1b_sec` is not reintroduced as an NPB+ direct speed measurement;
- same measurement/article copies are not counted as independent clusters;
- unresolved/missing remains explicit;
- no project registry/model/rating/shoulder files changed.

Commit and push all collection artifacts. Verify local HEAD equals remote HEAD.

---

# Final response format — exactly these items

1. Branch
2. Remote SHA
3. SP-020 collection: measurement clusters + exact/publication/year/snapshot/unknown counts
4. SP-044 collection: current100 birthdates resolved / unresolved
5. SP-045 collection: players searched, players with explicit injury/recovery evidence, event count, searched-no-explicit-source count, search-not-completed count
6. Primary-source vs secondary-source counts
7. Search-receipt count
8. QA verdict + check/failure count
9. Explicit unresolved limitations
10. Confirmation: registry/exclusion/model/rating/shoulder files untouched
