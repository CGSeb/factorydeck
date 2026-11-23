# 045 · Stats figures that tell more

Status: done
Depends on: 044
Checked: 2026-11-23

## User goal

A developer reads on the `Stats` page how long the factory waits for them once it stops, how far from the threshold the work was when they had to step in, and how much review raises a score, instead of figures that sit at 0% or `Not enough data` because they rest on a label or an event that rarely happens.

## Acceptance criteria

- [x] In the `Autonomy` panel (spec 037), `Waiting for a person` replaces `Waiting for an answer`: the median time of the stops (rules) answered in the period, formatted like `formatDuration` of `src/ui/format.ts` (`3 h 05 min`); n = answered stops (`answered stop` / `answered stops`); lower is better; the change line of spec 037; with the note `<k> still waiting` when `k` open issues have an open stop now (left out at 0).
- [x] `Why a person stepped in` keeps its title and its `CountBars` (spec 036), with each merged issue of the period at stage `Merged after a person` or `Merged by a person` in exactly one row, given in this order before sorting: `1–5 pts below threshold`, `6–15 pts below threshold`, `16+ pts below threshold`, `Gates failed`, `Spec question`, `Auto-merge off` (rules). The rows add up to the total. With no such issue, `No person had to step in.` replaces it, as spec 037 says.
- [x] Under that list, `<x> review rounds on average before a stop` (`1.8`, one decimal), the mean rounds of the refusing reports of those issues that have rounds, in 12 px `--fd-muted`; with fewer than `MIN_SAMPLE` such reports, the line reads `Not enough data for review rounds before a stop`.
- [x] In the `Quality` panel (spec 038), `Reworked` and `Closed without merge` are gone. A third figure, `Score gain`, follows `Review rounds`: the mean, over the merged issues of the period with two reports or more before their merge, of the score of the last of those reports minus the score of the first report (spec 038), as whole points with a sign (`+12 pts`, `−3 pts`, `0 pts`); n = those issues (`merged issue reviewed twice or more` / `merged issues reviewed twice or more`); higher is better; its change line counts points like a `share` (`▲ 4 pts vs previous 7 days`).
- [x] The figures of both panels still sit side by side and wrap below 680 px. The other figures, the trend charts, the histogram, the `Flow and cost` panel and the issue page do not change; `Tokens on dropped work` (spec 039) stays.
- [x] `GET /api/stats/autonomy` replaces the answered needs-spec waits with the durations of the answered stops of the period and of the previous one, `waitingNow` with the issues with an open stop, and the four reason counts with the six row counts, their total, and the sum and number of rounds of the refusing reports. `GET /api/stats/quality` drops the reworked, ended and closed-without-merge counts and gains the sum and number of score gains, for the period and the previous one. Parameters and refusals stay as spec 037 says.
- [x] The demo data (`pnpm demo`) holds, among its merged issues, at least one in each of the six rows, at least 5 stops answered in the last 7 days, some refusing reports with and without rounds, issues with one, two and three reports whose score rises, and one whose score falls. The other demo data stays as it is.
- [x] Figures refresh with each collection (spec 008), without a reload. From 1024 px wide, nothing scrolls horizontally.

## Rules

- **Refusing report**: a serenity report (spec 034) of a request that closes the issue whose score is below its own threshold or whose gates did not all pass, as `refusalReasons` of `src/git-host/outcome.ts` gives `below-threshold` or `gates-failed`. `auto-merge-off` is a project setting and starts no stop.
- **Stop**: a moment the factory handed the issue to a person.
  - A needs-spec episode, as `needsSpecEpisodes` builds it (spec 035, which settles repeated and unmatched label changes), is a stop from the label's addition to its removal.
  - A refusing report is a stop from its time to the earliest later of: the next report of any request that closes the issue, the issue's merge time (spec 037), or its close time (spec 038's `closedAt`). Without a later one, it is open. "Later" means strictly later, so a report at the same time as another does not end it. A refusing report at or after the issue's merge time starts no stop.
  - A stop is **answered** when it has an end; it counts in the period of its end, whatever the issue's stage. Its waiting time runs from its start to its end. The next report ends a stop because a person asked for that new round; the time the agents spent on it counts in the wait, which is accepted.
  - **Still waiting**: open issues of the project with an open stop at the time of the request, whatever the period.
- **Row of a merged issue a person helped**, the first that applies:
  1. its latest refusing report earlier than its merge time has a score below its threshold: `1–5 pts below threshold`, `6–15 pts below threshold` or `16+ pts below threshold`, by the threshold minus the score;
  2. it has a refusing report earlier than its merge time: `Gates failed`;
  3. it has a needs-spec episode started before its merge time: `Spec question`;
  4. else: `Auto-merge off`.
- **Review rounds before a stop**: the `rounds` of each refusing report earlier than the merge time of a helped issue of the period; a report without rounds is left out.
- **Score gain** of a merged issue: among the reports of every request that closes it earlier than or at its merge time, the score of the latest minus the score of the earliest (ties as spec 038); left out with fewer than two such reports. The mean is rounded to whole points for display, and its change compares the unrounded means: `round(value − previous)` points, a negative zero being `No change`.
- Merged issue, merge time, periods, previous period: as spec 037. With `All projects`, every factory project counts together.

## Expected proof

- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of `/api/stats/autonomy` over synthetic issues and requests: a stop ended by a next report, by the merge, by the close, and still open; a needs-spec episode; a stop answered in the previous period; an issue in each of the six rows, a threshold minus score of 5, 6, 15 and 16, an issue with a refusing report then a passing one; rounds missing from a report. Of `/api/stats/quality`: score gain on one, two and three reports, a report after the merge left out, a falling score, two reports with the same time.
- Storybook stories of the stats page: the six rows, the rounds line above and below the minimum sample, `Waiting for a person` with and without a note, `Score gain` positive, negative and below the minimum sample, at 1024 px. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of `/stats` at 1024 px and 1280 px, light and dark, attached to the pull request.

## Out of scope

- Prompts typed by a person per issue, or any measure of the person's time other than the stops above.
- Changing the stage rules of specs 009 and 034, or the reasons on the issue page.
- Splitting stops by role, or listing the issues behind a row.
- Changing the trend charts (spec 044).
