# 038 · Stats quality

Status: done
Depends on: 037
Checked: 2026-11-22

## User goal

A developer reads on the `Stats` page whether their agents deliver good work the first time: how often the first serenity report already allowed the merge, how the first scores spread around the threshold, how many review rounds a merge takes, how often an issue had to be reworked or was dropped, and whether the first-time rate improves week after week.

## Acceptance criteria

- [x] On `/stats` (spec 037), under the `Autonomy` panel, a `Panel` `Quality` shows four `StatFigure`s (spec 036) side by side, wrapping below 680 px, each with the change line of spec 037:
  - `Right the first time`: the share of merged issues whose first serenity report passed (rules), as a whole percent; n = merged issues with at least one report (`merged issue with a report` / `merged issues with a report`); higher is better.
  - `Review rounds`: the mean review rounds of the report that counts (spec 009) of each merged issue, with one decimal (`1.4`, `1.0`); n = merged issues whose report that counts has rounds (`merged issue` / `merged issues`); lower is better; its change is an `amount`.
  - `Reworked`: the share of merged issues that were reworked (spec 009); n = merged issues; lower is better.
  - `Closed without merge`: the share of ended issues (rules) at stage `Closed without merge`; n = ended issues (`ended issue` / `ended issues`); lower is better.
- [x] Under the figures, `Right the first time, by week`: a `TrendBars` (spec 036, `share` scale, 64 px high, `--fd-stage-merged`) of the same 12 weeks as spec 037, each week's value the share of the issues merged that week whose first report passed, n = those of them with a report, tooltip value `60% · 3 of 5`.
- [x] Then `First serenity score`: a `ScoreHistogram` (spec 036) of the first report of each merged issue of the period that has one, each with its own score, threshold and time.
- [x] With no merged issue in the period, the figures show `Not enough data` (spec 036) and the histogram its own `Not enough data`; the weekly trend still shows.
- [x] `GET /api/stats/quality?period=<period>&tz=<time zone>&project=<root>` returns, for the period and its previous one (left out for `all`), the counts behind each figure (merged issues, those with a report, those whose first report passed, the sum and number of rounds, reworked merged issues, ended issues, closed without merge), the 12 weeks (start date, merged issues with a report, those whose first report passed), and the first report of each merged issue of the period (score, threshold, time). Parameters are read and refused like `/api/stats/autonomy` (spec 037).
- [x] The panel loads and fails on its own, like the `Autonomy` panel (spec 037); a failing quality API leaves the autonomy panel on screen, and the other way round.
- [x] The demo data of spec 037 holds, among its merged issues, first reports that failed for their score and for their gates, issues with 1, 2 and 3 review rounds, reworked issues (two requests, and a reopened issue), and about 5 issues closed without merge spread over the 12 weeks.
- [x] Figures refresh with each collection (spec 008), without a reload. From 1024 px wide, nothing scrolls horizontally.

## Rules

- **Merged issue**, **merge time**, periods, previous period and weeks: as spec 037.
- **First report** of an issue: its earliest serenity report (spec 034) by time, among every report of every request that closes it (spec 008), whatever the request's state; ties keep the one stored first. It **passed** when its score is at or above its own threshold and its gates all passed, that is when `refusalReasons` of `src/git-host/outcome.ts` gives neither `below-threshold` nor `gates-failed`. `auto-merge-off` is a project setting, not a quality fault, and does not count.
- **Review rounds**: the rounds of the report that counts under spec 009; a merged issue whose report has no rounds, or with no report, is left out of the mean.
- **Reworked**: as spec 009 (more than one request closes the issue, or it was reopened).
- **Ended issue**: an issue merged in the period (by merge time), or at stage `Closed without merge` whose close time (the issue's `closedAt`, spec 008) falls in the period; a closed issue without a close time is left out.
- With `All projects`, every factory project counts together, as spec 037.

## Expected proof

- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of `/api/stats/quality` over synthetic issues and requests: a first report on an earlier closed request, two reports with the same time, a first report failing for its score, for its gates, and with auto-merge off (still passed), rounds missing from a report, a reworked issue by a second request and by a reopening, an issue closed without merge inside and outside the period, the previous period, the 12 weeks.
- Storybook stories of the stats page with both panels: quality figures above and below the minimum sample, a histogram with mixed thresholds, the quality API unreachable while autonomy renders, at 1024 px. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of `/stats` at 1024 px and 1280 px, light and dark, attached to the pull request.

## Out of scope

- The score path from first to last report as a statistic (it stays on the issue page, spec 035).
- Listing the issues behind a figure, or linking the histogram to them.
- Review comments, the content of rounds, or quality figures per role.
