# SP-034 Prospi official YouTube run2 — QA

## Verdict

**TRANSPORT_SUCCESS / CURRENT-2026 BOUNDED COVERAGE COMPLETE / NO ACCEPTED CURRENT-100-PLAYER SPEED-RATING RECORD.**

This is not a claim that no relevant comment exists on YouTube. The collection used the public yt-dlp route, bounded to 300 comments per target video, and no YouTube Data API key was configured.

## Preflight evidence

- Official channel: `channel_id=UCWzEh28vj3mQKpe0fzVTOUw; channel_name=パワプロ・プロスピ公式チャンネル`.
- The manual metadata preflight used `yt-dlp --ignore-config --no-update --no-warnings --flat-playlist --playlist-end 1 --dump-single-json <channel>` and succeeded.
- The manual comment preflight used `--get-comments --extractor-args youtube:max_comments=1` and succeeded. `--no-update` was an option, never a proxy value; no `host='--no-update'` error occurred.
- The later channel retry returned 199 latest channel entries and 52 Prospi title matches. The five 2026 title matches below were all in the saved staging data.

## Counts and integrity

- CSV rows: 116; JSONL rows: 116.
- Unique CSV IDs: 116; unique JSONL IDs: 116; exact ID-set match: `True`.
- UTF-8 decode: `True`.
- Video inventory rows saved before the intentionally stopped broader historical sweep: 52 of 52 Prospi title matches.
- 2026 inventory rows: 5; their public-comment rows: 15; yt-dlp-retrieved comments summed from the five video records: 1436.
- Accepted current-100-player rating records: 0.
- Strict direct runner-attribute mentions among 2026 retained comment rows: 2; explicit high/low/stale direction among them: 0.
- Rows missing a required provenance/missingness field: 0.

## 2026 official-video coverage

| video ID | publishedAt | retained public-comment rows | current-100-player title/metadata mapping | result |
| --- | --- | ---: | --- | --- |
| sX8nl6eCua0 | 2026-07-16T10:00:01Z | 4 | NO_CURRENT_100_PLAYER_FULL_NAME_MATCH | INSUFFICIENT |
| Cigl41WJeaU | 2026-05-25T03:00:07Z | 4 | NO_CURRENT_100_PLAYER_FULL_NAME_MATCH | INSUFFICIENT |
| lug1RWbPMwI | 2026-05-24T03:00:26Z | 1 | ファビアン (player_id=43745150); モンテロ (player_id=53955150) | INSUFFICIENT |
| D5Fg3e-E_QY | 2026-05-20T03:00:21Z | 3 | 長岡 秀樹 (player_id=51455151) | INSUFFICIENT |
| zGF4VfGcAwk | 2026-05-19T03:00:47Z | 3 | NO_CURRENT_100_PLAYER_FULL_NAME_MATCH | INSUFFICIENT |

## Record-level QA exclusions

Three retained raw rows were not accepted, but their original automatic labels could mislead a future integrator. They are explicitly excluded in `outputs\derived\_staging_speed_youtube_prospi_run2_qa_exclusions.csv`; the raw staging data are preserved unchanged for auditability.

| original record ID | reason |
| --- | --- |
| SP034-RUN2-COMMENT-lug1RWbPMwI-UgyAKBa20o5_ZE2mC2F4AaABAg | The detector matched the character 足 inside 満足度 and 高すぎる refers to satisfaction, not speed or a game rating. |
| SP034-RUN2-COMMENT-gn972-2UigM-UgwRQ9nNqH7OgEoaqDx4AaABAg | 一歩目 is mentioned, but there is no player mapping or high/low/stale direction; it is context, not ACCELERATION_NOT_REFLECTED. |
| SP034-RUN2-COMMENT-qVl61GKQNhE-UgzXRgwQBy1InAF_zYx4AaABAg.A9rH9crbLCAA9rJE_kbGDm | The comment has a historical-rating comparison but lacks a safe full-name 2026 master-player mapping; STA​LE_RATING must not be integrated as a current-player conclusion. |

## Missingness and user input

- `NOT_CONFIGURED_ENV`: no YouTube Data API key was supplied, so Data API metadata/commentThreads/replies were not called.
- `YTDLP_BOUNDED_PUBLIC_COMMENT_SAMPLE`: comments are bounded to 300 per selected video; reply count and total public comment count are not fully established by this method.
- To obtain exhaustive/reproducible coverage, provide Data API commentThreads/replies JSON or CSV with video ID, comment ID, parent ID, author channel ID/display name, timestamp, text, like count, and reply count.

## Scope boundary

The saved 2026 coverage is complete for the five Prospi title matches in the official channel's 199-entry latest listing. The broader 52-title-match historical inventory was deliberately stopped after 52 saved inventory rows to avoid representing a long historical sweep as necessary current-2026 coverage. The 10 unsaved older title matches are not evidence of absence and are not included in the verdict.
