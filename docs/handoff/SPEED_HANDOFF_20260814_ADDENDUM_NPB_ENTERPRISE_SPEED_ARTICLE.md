# SPEED HANDOFF ADDENDUM — NPB Enterprise DATA SPOTLIGHT speed evidence

Date archived: 2026-08-14
Source publication date: 2026-08-10
Source title: `二盗タイム最速ではない、それでも周東佑京が別格な理由　上位50件で見えた圧倒的な走力【DATA SPOTLIGHT】`
Publisher/article: Baseball Channel / DATA SPOTLIGHT
Data provider stated by article: NPBエンタープライズ
Owner supplied the article text in chat on 2026-08-14.

This addendum supersedes the statement in `docs/handoff/SPEED_HANDOFF_20260814.md` that the full article content had not yet been durably captured.

## 1. Provenance lane

Treat this evidence as a separate provenance lane:

`NPB_ENTERPRISE_TRACKING_ARTICLE`

Do **not** merge it into the `NPB+ app/player-screen` lane. The article discloses event-level tracking observations supplied by NPB Enterprise, while the existing manual NPB+ player-screen data are a different observation window/product surface.

## 2. Exact source-supported facts

The article's population is **successful steals of second base, restricted to the 50 fastest second-base steal times recorded through 2026-08-02**.

The article explicitly defines its event-level `スプリントスピード` as the **maximum speed during the run**, in m/s.

### Second-base steal time

- Fastest in the top-50 set: 田中幹也, 3.35 s.
- 周東佑京 best: 3.60 s, displayed as tied for 5th.
- The article itself stresses that identical steal times can arise from different combinations of lead distance, start, acceleration, and running speed.

Therefore `二盗タイム` is not a pure-foot-speed measurement and must not be used directly as a pure-speed teacher.

### Repeated sprint-speed observations for 周東佑京

- Highest disclosed sprint speed: **9.24 m/s** (about **33.3 km/h**), recorded on **two** of 周東's events.
- Among the seven top events at **9.17 m/s or higher**, **six** were 周東 events.
- The non-周東 mean sprint speed within the top-50 successful-steal set was **8.72 m/s** (about **31.4 km/h**).
- 周東 appeared **8 times** in the 50-event set, the most of any player; the next-highest players appeared 4 times.

This is direct evidence that 周東 repeatedly reached elite event-level maximum running speed within the same 2026 season rather than merely producing a single extreme observation.

### Lead distance

For 周東's eight appearances, the article gives lead distances:

`4.11, 4.02, 3.96, 3.90, 3.87, 3.84, 3.78, 3.66 m`

- Mean: **3.89 m**.
- Non-周東 mean within the same top-50 event set: **4.00 m**.
- 周東's longest lead, 4.11 m, ranked only tied for 14th in the top-50 set.

This supports the article's interpretation that his fast successful steals were not produced by unusually large leads. However, lead distance still changes the running distance/acceleration window and therefore remains a contextual variable rather than proof of a fully standardized protocol.

### Steal outcomes

At 2026-08-02:

- 周東: 26 attempts, 23 successful steals, **88.5%** success rate.
- Among players with 20+ attempts, the article states this was the highest success rate at that date.

Steal success rate remains a stealing/baserunning outcome, not a pure-foot-speed measurement.

## 3. Cross-check against the existing NPB+ app lane

Existing repository row for 周東 in `data/manual/npb_plus_screens.jsonl`:

- `top_speed_kmh = 35.0`
- `sb_success = 0.885`

The article's highest disclosed successful-steal event is 9.24 m/s = **33.264 km/h**, below the app/player-screen 35.0 km/h.

Therefore the DATA SPOTLIGHT article is **not merely a duplicate of the app's 35.0 km/h maximum**. The safest interpretation is that the article supplies a restricted event-level observation set (fast successful steals), while the app/player-screen maximum comes from a broader or otherwise different observation window. Do not assume an identical aggregation rule without explicit documentation.

The matching 88.5% steal-success figure is consistent with both referring to the same 2026 season snapshot near 2026-08-02, but it does not establish that the speed fields have identical aggregation definitions.

## 4. Methodological value and limits

### High-value use

This article is strong evidence for **within-season repeated elite speed for 周東**:

- multiple event-level maximum-speed observations,
- same season,
- direct tracking data,
- repeated appearance at the extreme top of the event distribution,
- not explained by an unusually long lead in the observed set.

This makes it useful as a player-specific repeated-performance / confidence-support lane and as independent context for high-end pairwise/range appraisal.

### Critical selection bias

The sample is **not all steal attempts** and not all running events. It is conditioned on:

1. successful steals of second base, and
2. only the 50 fastest steal times.

Consequences:

- It cannot estimate population-wide NPB+ measurement reliability.
- It cannot provide a general same-time reliability coefficient for all players.
- It cannot establish that a player absent from the top-50 is slow.
- Event counts within the top-50 mix physical speed with steal opportunity, willingness to attempt, start quality, pitcher/catcher context, acceleration, and slide/arrival mechanics.

Do not convert `8 appearances` or the 9.24/9.17 thresholds directly into a universal reliability weight.

## 5. Implications for current speed tasks

### SP-100 — PowerPro-free NPB+ raw speed integration

The provenance incident still requires SP-100 Candidate N/F to be rebuilt without `hp_to_1b_sec` as an NPB+ measurement.

With the app/player-screen lane reduced to one direct speed measure, a generic internal parallel-forms reliability remains **NOT_IDENTIFIABLE**. This article does **not** change that conclusion because its sample is selected and player/event availability is non-random.

What it does add:

- a legitimate separate repeated-event evidence lane,
- strong player-specific repeatability support for 周東,
- a possible bounded confidence modifier/context signal where repeated event-level tracking exists,
- a future template for reliability estimation **only if** broader unselected event-level tracking becomes available.

Do not use this article to manufacture a global NPB+ reliability coefficient.

### SP-022 — evidence-weighted pairwise/range appraisal

This article can strengthen the high-end range/ordering evidence for 周東 because six of the seven >=9.17 m/s events were his and he appeared eight times in the selected top-50 set. Use as supporting ordinal/range evidence, not as a direct 1-100 conversion.

### SP-061 — pinch-runner weak context

The article is not pinch-runner-usage evidence and should not be merged into SP-061's core lane. It may serve as related stealing-context evidence only.

### SP-015

No reason to reopen SP-015 solely because of this article. SP-015's physical validation axis already uses raw maximum/sprint speed and the Luna provenance audit found no `hp_to_1b_sec` contamination. The article is additional validation/context, not a replacement weighting teacher.

## 6. Required Opus Bulk Review handling

During the next Opus Bulk Review:

1. Read this addendum before reviewing SP-100.
2. Keep `NPB_ENTERPRISE_TRACKING_ARTICLE` separate from `NPB+ app/player-screen` provenance.
3. Repair SP-100 N/F and all reliability/confidence propagation contaminated by misattributed `hp_to_1b_sec`.
4. Keep generic NPB+ internal reliability `NOT_IDENTIFIABLE` unless a valid independent identification route exists.
5. Evaluate whether repeated event-level DATA SPOTLIGHT evidence should become an optional player-specific confidence/context lane.
6. Do not let selected-top-50 event counts become universal reliability weights.
7. Recheck Candidate S/N/F and SP-022 after incorporating this evidence only in its legitimate lane.
8. Preserve the raw article-derived facts and the selection-bias caveat in durable artifacts.

This addendum does not close SP-081 and does not authorize starting shoulder/arm-strength work.
