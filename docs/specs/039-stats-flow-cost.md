# 039 · Stats flow and cost

Status: done
Depends on: 037
Checked: 2026-11-22

## User goal

A developer reads on the `Stats` page how fast and how cheaply their factory delivers: how many issues it merges each week, how long an issue takes from its creation and from the agents' first call to its merge, what a merged issue costs in tokens and which ones cost far more than the others, and how much of the period's tokens went to dropped work, to no issue at all, or were read from the cache.

## Acceptance criteria

- [x] On `/stats` (spec 037), after the `Quality` panel of spec 038 (or after `Autonomy` when it is not there), a `Panel` `Flow and cost` starts with `Merged per week`: a `TrendBars` (spec 036, `count` scale, 64 px high, `--fd-stage-merged`, buckets without `n`) of the 12 weeks of spec 037, each week's value the number of issues merged that week, tooltip value `4 issues` (`1 issue`).
- [x] Under it, three `StatFigure`s (spec 036) side by side, wrapping below 680 px, each with the change line of spec 037 (`amount` changes), lower being better for all three:
  - `Lead time`: the median time from an issue's creation to its merge, formatted like `formatDuration` of `src/ui/format.ts` (`2 d 5 h`); n = merged issues.
  - `Cycle time`: the median time from the first agent call on the issue to its merge, same format; n = merged issues with at least one call (`merged issue with agent work` / `merged issues with agent work`).
  - `Tokens per merged issue`: the median of the merged issues' tokens (rules), compact like `formatTokens` (`1.2M`); n = merged issues with at least one call.
- [x] Then two `RangeStrip`s (spec 036), titled `Lead time` and `Tokens per merged issue`, with one dot per merged issue of the period (for tokens, those with at least one call), labelled `#<n> <title>` (`#<n>` alone when the title is unknown), valued and formatted as the figures above, each dot linking to the issue page `/features/<n>?project=<root>&period=<period>` (spec 010) with the current period.
- [x] Then a sub-heading `Where the tokens went` (`h3`) and three `StatFigure`s over the calls of the period, whatever their issue, with n = API calls of the period (`API call` / `API calls`) and the change line of spec 037 (`share` changes):
  - `Tokens on dropped work`: the share of the period's tokens that went to issues now at stage `Closed without merge`, orchestration share included; lower is better.
  - `No work item`: the share of the period's tokens in the `No work item` row of spec 010; lower is better.
  - `Cache reads`: cache read tokens over the input-side tokens (input, cache write and cache read) of the period's calls; higher is better.
- [x] With no merged issue in the period, the first three figures and both strips show `Not enough data` or `No data` as spec 036 says; with no call in the period, the last three show `Not enough data`; `Merged per week` always shows.
- [x] `GET /api/stats/flow?period=<period>&tz=<time zone>&project=<root>` returns the 12 weekly merge counts; for the period and its previous one (left out for `all`), the lead time, cycle time and tokens of each merged issue (cycle time and tokens `null` without a call), and the period's tokens in total, on issues closed without merge and in `No work item`, the input-side and cache read tokens, and the number of API calls. For the period only, each merged issue's number, title and project for the strips. Parameters are read and refused like `/api/stats/autonomy` (spec 037).
- [x] The demo data (`pnpm demo`) gives about 20 of the merged issues added by spec 037 one short synthetic session each, started before their merge: a main thread and a few calls in two sub-agent threads whose descriptions the default roles recognise (spec 011) as a builder and a reviewer, with one issue using about 8 times the tokens of the others. The other demo issues and sessions stay as they are.
- [x] The panel loads and fails on its own, like the other panels of `/stats`.
- [x] Figures refresh with each re-ingestion (spec 003) and collection (spec 008), without a reload. From 1024 px wide, nothing scrolls horizontally.

## Rules

- **Merged issue**, **merge time**, periods, previous period and weeks: as spec 037.
- **Lead time**: from the issue's `createdAt` (spec 008) to its merge time; a negative time counts as 0.
- **Cycle time**: from the earliest call of any thread whose work item is the issue (spec 006 and 010), whatever its period, to the merge time; orchestration shares have no call of their own and do not start it. A negative time counts as 0.
- **Tokens of a merged issue**: its tokens on `/features` (spec 010) with `All time`, orchestration share included, so a merge counts its whole cost once, in the period of its merge, whatever the period of its calls.
- **Tokens** are the sum of the four kinds (spec 003). The three figures of `Where the tokens went` take the calls by their own time in the period (spec 003), not by merge time; their totals are those of the overview for the same period and project (spec 013).
- **Dropped work**: the stage is the issue's current one (spec 010); an issue closed later moves its earlier tokens into this share.
- Issue pages of the strips keep the dot's issue project, even with `All projects`.
- With `All projects`, every factory project counts together, as spec 037.

## Expected proof

- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of `/api/stats/flow` over synthetic sessions, issues and requests: lead and cycle times (an issue created after its first call, an issue merged with no call), tokens over the issue's whole life with calls before the period, an orchestration share, a dropped issue, `No work item`, cache reads, the totals equal to the overview's, the previous period, the weekly merge counts across a month change.
- Storybook stories of the stats page with the three panels: figures above and below the minimum sample, strips with an outlier and many close values, no call in the period, the flow API unreachable while the other panels render, at 1024 px. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of `/stats` at 1024 px and 1280 px, light and dark, attached to the pull request.

## Out of scope

- A rework cost, or tokens split by role on this page (roles are configured per project; `/roles` shows them).
- Costs in US dollars on this page.
- Time spent in each stage (it needs the history of every stage label).
- Budgets, alerts or targets.
