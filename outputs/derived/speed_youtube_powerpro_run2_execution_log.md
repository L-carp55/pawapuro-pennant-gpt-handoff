# SP-033 PowerPro official YouTube run2 execution log

- started_at: 2026-08-13T11:09:20Z
- UTF-8 output: explicit UTF-8 is used for CSV, JSONL, log, source read, and temporary info JSON.
- preflight_manual_command: `yt-dlp --no-update --skip-download --no-playlist --print ... https://www.youtube.com/watch?v=wOjrANePk1c`
- preflight_result: SUCCESS before this collection; video/channel metadata returned and `--no-update` was not passed as a proxy host.
- comment_manual_command: `yt-dlp --no-update --skip-download --no-playlist --write-info-json --write-comments --extractor-args youtube:max_comments=20,20,20,20 ...`
- comment_manual_result: SUCCESS before this collection; wOjrANePk1c returned official metadata and 20 public comments.
- discovery_routes: official `/videos` flat inventory (300 newest) and official channel searches for `選手能力`, `選手データ`, `アップデート`, `走力`, and `2026`; no current-player PowerPro ability/update video was asserted merely from a title.
- run2 output boundary: only the two staging files and this log are written; legacy accepted/rejected artifacts and task registry are not touched.
- 2026-08-13T11:09:20Z `wOjrANePk1c`: metadata OK; official channel verified; comments=100, speed+rating candidates=0, mapped directional candidates=0; error=NONE.
- 2026-08-13T11:09:30Z `lXJEdQqrU7E`: metadata OK; official channel verified; comments=10, speed+rating candidates=0, mapped directional candidates=0; error=NONE.
- 2026-08-13T11:09:47Z `pxdRtLSTI80`: metadata OK; official channel verified; comments=100, speed+rating candidates=0, mapped directional candidates=0; error=NONE.
- 2026-08-13T11:10:01Z `4LPWDwnHVpg`: metadata OK; official channel verified; comments=47, speed+rating candidates=1, mapped directional candidates=0; error=NONE.
- finished_at: 2026-08-13T11:10:06Z
- summary: videos=4, metadata_success=4, public_comments_retrieved=257, speed_rating_keyword_candidates=1, connection_failures=0, api_state=NOT_CONFIGURED_ENV.
