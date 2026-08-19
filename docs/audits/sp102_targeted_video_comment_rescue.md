# SP-102 targeted video/comment rescue

Date: 2026-08-19

Status before independent final QA: **PASS**

## Scope

- Frozen targets searched: **30**. Non-targets untouched: **70**.
- Four query variants are retained per frozen target; search errors and inaccessible videos remain explicit missingness.
- No SP-078 owner verdict, SP-079 final rating, or shoulder artifact is produced.

## Canonical layer policy

- Video narration/editorial, quoted 2ch/5ch text, top-level comments, replies, and linked-primary discovery are separate objects.
- Public commenter usernames/profiles are not persisted; only run-scoped non-reversible origin tokens may remain for clustering.
- Comment-only evidence is low-confidence context and never a direct physical measurement.
- 50m, home-to-first/T90, acceleration, baserunning technique, PowerPro opinion, and generic real-world speed remain separate.

## Results

- Normalized evidence records: **56**.
- Independent origin/event clusters: **55**.
- Linked primary-source discovery receipts: **0**; independently fetched/promoted: **0**.
- Player use states: `{'AVAILABLE_NOT_DECISION_EFFECTIVE': 24, 'NO_USABLE_EVIDENCE': 6}`.

## Negative findings and limits

- Official YouTube Data API was called: **False**; API key present in this execution: **False**.
- The public yt-dlp route is bounded rather than exhaustive API pagination. Failed searches/fetches are persisted and are not interpreted as absence of evidence.
- On-screen-only text was not OCRed. Auto/manual subtitle text is narration/editorial unless an explicit thread-quote marker supports the quote layer.
- A linked official-domain URL is only a discovery receipt until separately fetched and classified; this run promotes none automatically.

## QA canaries

- PASS — `sarcasm_or_meme_not_physical`
- PASS — `title_priming_not_usable`
- PASS — `wrong_season_historical`
- PASS — `baserunning_technique_separate`
- PASS — `powerpro_opinion_separate`

## Deterministic downstream contract

- These canonical outputs are a pure transform of the frozen SP-102 collection snapshot. The workflow re-materializes and byte-compares them before finalization.

## Refined independence pass

- Same-video, same-channel, transient same-author, near-template, quoted-dependency, and same-timing relationships are collapsed by connected components.
- Refined independent origin/event clusters: **54**.
- Same-event inflation after clustering: **0 by construction and QA contract**.
- Refined player use states: `{'AVAILABLE_NOT_DECISION_EFFECTIVE': 24, 'NO_USABLE_EVIDENCE': 6}`.

## Query-contract coverage

- Total targeted search-query attempts: **193**.
- Per-target minimum/maximum attempts: **6 / 9**.
- Zero-result and error queries remain in the candidate manifest as search attempts rather than disappearing from the denominator.
