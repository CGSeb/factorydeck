# 044 · Stats trends follow the period

Status: done
Depends on: 039
Checked: 2026-11-23

## User goal

A developer who picks `Today`, `Last 7 days`, `Last 30 days` or `All time` on the `Stats` page sees every trend chart cut to that period, hour by hour, day by day, or week by week, like the figures above them, instead of the same 12 weeks whatever the period. A bar with only a few merges still shows its value, marked as a small sample, so a short period is not a row of empty stubs.

## Acceptance criteria

- [x] The three trend charts of `/stats` (specs 037, 038 and 039) share one cut, set by the period (rules): `Today` one bucket per hour of the local day (00:00 to 23:00), `Last 7 days` one per day (7 buckets), `Last 30 days` one per day (30 buckets), `All time` one per week, or one per month when that gives more than 26 weeks (or per year, rules). The current bucket is last.
- [x] Their titles name the unit: `Merged without a person, by hour` (`by day`, `by week`, `by month`, `by year`), `Right the first time, by hour` (…), and `Merged per hour` (`per day`, `per week`, `per month`, `per year`).
- [x] A bucket's label is `14:00` for an hour, `Nov 16` for a day or a week (its Monday), `Nov 2026` for a month. The current bucket reads `this hour`, `today`, `this week` or `this month`. The rule of spec 036 for which labels show (every label with 7 buckets or fewer, else the two ends) stays.
- [x] Each bucket's value, `n` and tooltip value are those of spec 037 (`75% · 3 of 4`), spec 038 (`60% · 3 of 5`) and spec 039 (`4 issues`), over the issues merged in that bucket. Hours of today still to come are empty buckets (`No issue merged`, `No merged issue with a report`, `0 issues`).
- [x] `TrendBars` (spec 036) changes its small-sample rule: a bucket with an `n` from 1 to `MIN_SAMPLE − 1` draws its bar at its value in its colour at 40% opacity, and its tooltip adds `small sample` after `n = 3` (`n = 3 · small sample`); its line in the visually hidden table reads its value's text, its `n` and `small sample`. A bucket with `n` = 0 or a `null` value keeps the 2 px stub in `--fd-line` and its tooltip text. With the `count` scale, the largest value is taken among every bucket with a value. Its stories gain one with mixed small and full samples, in both themes.
- [x] `All time` with no merged issue shows the 12 weeks ending with the current one, every bucket empty, as today.
- [x] `GET /api/stats/autonomy`, `/api/stats/quality` and `/api/stats/flow` (specs 037 to 039) replace `weeks` with `unit` (`hour`, `day`, `week`, `month` or `year`) and `buckets`, each with its local start (`2026-11-16` for a day, week, month or year, `2026-11-23T14:00` for an hour) and the counts each `weeks` item held. Parameters and their refusals stay as spec 037 says. The figures, previous period and the other fields do not change.
- [x] While the period changes, the charts keep their last buckets on screen until the new ones arrive (`useRefreshing`, AGENTS.md), and the chart height does not change between periods. From 1024 px wide, 30 buckets and 24 buckets fit without horizontal scroll.
- [x] The demo data (`pnpm demo`) gives at least 5 merges on one day of the last 7 days and at least 3 merges in one hour of the current day relative to the demo's time, so `Last 7 days` and `Today` show full and small-sample bars. The other demo data stays as it is.

## Rules

- **Cut by period**, in the browser's time zone sent as `tz` (spec 003):
  - `Today`: the hours of the current local day, from 00:00; a day changing to or from daylight saving time has 23 or 25 buckets, and a repeated hour shows its label twice.
  - `Last 7 days` and `Last 30 days`: the local days of the period (spec 037), today last.
  - `All time`: weeks (Monday 00:00 to Sunday 24:00, as spec 037) from the week of the earliest merged issue of the project selection to the current week; when that is more than 26 weeks, calendar months from the month of the earliest merged issue to the current month; when that is more than 36 months, calendar years (label `2026`, the current one `this year`, `unit` `year`), so a chart never holds more than 36 buckets beyond `Last 30 days`. The earliest merged issue is taken over every merged issue the three panels read (merged issue and merge time as spec 037), so the three panels always show the same buckets.
- A bucket counts the issues whose merge time falls in `[start, next start)`; the current bucket runs to the next bucket's start.
- **Small sample**: `n` from 1 to `MIN_SAMPLE − 1` (spec 036), for buckets that carry an `n`. `StatFigure`, `ScoreHistogram`, `CountBars` and `RangeStrip` keep `Not enough data` below `MIN_SAMPLE`: only `TrendBars` shows small samples.
- With `All projects`, every factory project counts together, as spec 037.

## Expected proof

- Vitest tests of the bucket bounds on a scratch PostgreSQL database (`src/test/postgres.ts`): `Today` in a time zone with a daylight-saving change that day (23 and 25 hours), 7 and 30 days across a month change, `All time` with a first merge 3 weeks ago, 26 weeks ago and 27 weeks ago (months), and with no merge; of each API's `unit` and `buckets` over synthetic issues, merges on a bucket's edge included.
- Vitest tests of `TrendBars`' heights and draw rule: `n` 0, 1, 4 and 5, a `null` value, the `count` scale's largest value.
- Storybook stories of the stats page for each period (24 hours, 7 days, 30 days, weeks, months), with small-sample bars, at 1024 px; `TrendBars` with mixed samples. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of `/stats` for `Today`, `Last 7 days` and `All time` at 1024 px, light and dark, attached to the pull request.

## Out of scope

- Choosing the cut by hand, or a cut other than the period's.
- Changing the figures, the histogram, the strips or the reasons (spec 045).
- A different minimum sample, or showing small samples outside `TrendBars`.
