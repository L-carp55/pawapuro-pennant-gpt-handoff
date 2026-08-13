# SP-034 Prospi official YouTube collection — run2

- Started: 2026-08-13T11:05:35Z
- Manual preflight before this script: `yt-dlp --ignore-config --no-update --no-warnings --flat-playlist --playlist-end 1 --dump-single-json <official-channel-url>` succeeded; no `--no-update` proxy-host error.
- Comment preflight before this script: `--get-comments --extractor-args youtube:max_comments=1` succeeded. The unsupported `--max-comments` option was rejected before collection and is not used here.
- Script calls yt-dlp with a subprocess argument list and strips proxy environment variables; it never passes a `--proxy` value.
- Official channel flat inventory returned 199 latest entries; 52 title-matched Prospi entries. Removed proxy env names for subprocess: none.
- Video sX8nl6eCua0: comments_retrieved=300, retained_speed_term_comments=4, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.
- Video Cigl41WJeaU: comments_retrieved=300, retained_speed_term_comments=4, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.
- Video lug1RWbPMwI: comments_retrieved=300, retained_speed_term_comments=1, mapping=ファビアン (player_id=43745150); モンテロ (player_id=53955150).
- Video D5Fg3e-E_QY: comments_retrieved=236, retained_speed_term_comments=3, mapping=長岡 秀樹 (player_id=51455151).
- Video zGF4VfGcAwk: comments_retrieved=300, retained_speed_term_comments=3, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.
- Video gn972-2UigM: comments_retrieved=300, retained_speed_term_comments=12, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.
- Video t-0dgSQckqQ: comments_retrieved=300, retained_speed_term_comments=3, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.
- Video qVl61GKQNhE: comments_retrieved=300, retained_speed_term_comments=18, mapping=源田 壮亮 (player_id=71775134).
- Video opjfeVgrOs4: comments_retrieved=300, retained_speed_term_comments=3, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.
- Video jdfUYFjoQV0: comments_retrieved=300, retained_speed_term_comments=3, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.
- Video VvL9V0hzWyE: comments_retrieved=300, retained_speed_term_comments=2, mapping=柳田 悠岐 (player_id=31835133).
- Video KLSX-oW9an0: comments_retrieved=58, retained_speed_term_comments=1, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.
- Video QckmcCN9Fmg: comments_retrieved=41, retained_speed_term_comments=2, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.
- Video nYhOTTXXd3g: comments_retrieved=39, retained_speed_term_comments=1, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.
- Video MutgnjN6l1M: comments_retrieved=44, retained_speed_term_comments=0, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.
- Video mJgdhV4lv9k: comments_retrieved=107, retained_speed_term_comments=1, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.
- Video JX44elNSzTc: comments_retrieved=95, retained_speed_term_comments=0, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.
- Video F4z68l4Acd0: comments_retrieved=146, retained_speed_term_comments=1, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.
- Video K_5Tv30wn1o: comments_retrieved=259, retained_speed_term_comments=2, mapping=NO_CURRENT_100_PLAYER_FULL_NAME_MATCH.

## Result
- inventory: 52
- comment_candidates: 19
- comments_retrieved: 4025
- speed_term_comments: 64
- accepted: 0
- failures: 0
- Finished: 2026-08-13T11:13:21Z
