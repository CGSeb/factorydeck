# Stats

`/stats` tells whether the factory delivers on its own, delivers good work the first time, and how fast and cheaply it delivers, and whether that improves. Three panels, `Autonomy`, `Quality` and `Flow and cost`, and a fourth, `Bugs`, when the factory has bug tickets, each load and fail on their own. With `All projects`, every factory project counts together; `unassigned` work has no issue and does not count.

The header `Stats` says `<n> issues merged · <m> without a person` (`No issue merged` with none).

## Kind filter

When at least one factory project of the selection has a [bug label](outcomes.md#kinds), even with no bug in the period, the header shows the [kind filter of `/features`](features.md#kind-filter) under its title: `All` (the default), `Features <n>` and `Bugs <n>`, where `<n>` is the number of issues of that [kind](outcomes.md#kinds) merged in the period. The `kind` parameter and its matching rules are those of `/features`: another spelling, an empty or unknown value means `All`, and a `kind` in the URL while the filter is absent is ignored. The kind is kept when the period or the project changes. Until the page knows whether the selection has bug tickets, the header keeps the filter's row empty at its height, so the panels never move when the filter appears; the row closes when no project has a bug label. With a `kind` in the URL, the panels wait for that answer before they load.

With `Features` or `Bugs` selected, only the merged issues of that kind count: the header, and every figure, chart, list and strip of `Autonomy`, `Quality` and `Flow and cost`, their change lines included (against the previous period for the same kind). `Waiting for a person` counts the stops of issues of that kind, and its `<k> still waiting` too. In `Where the tokens went`, `Tokens on dropped work` and `Tokens on rework` become shares of the period's tokens spent on issues of that kind (n = their API calls). A shared orchestration call is split between its issues as on [`/features`](features.md), in tokens and in calls, so the tokens and calls of `Features` and `Bugs` plus `No work item` add up to those of `All`, but for issues of unknown kind, and `No work item` is left out, since those tokens have no issue and no kind. The tokens of an issue whose kind is unknown (not collected) count only under `All`. The trend charts keep the cut of `All`, so every chart of the page shares its buckets. While the figures reload, the filter stays with its last counts.

## Common rules

- **Merged issue** and **merge time**: as in [Outcomes](outcomes.md#help-from-a-person). An issue counts in a period, or a bucket, when its merge time falls inside it, in the browser's time zone.
- **Sample size**: each figure shows `n = <count> <noun>` under its value. Below 5 items (`MIN_SAMPLE`), a figure, histogram, list or strip never shows a value computed on that sample: it says `Not enough data`.
- **Change line**: against the [previous period](navigation.md#period) (`vs yesterday`, `vs previous 7 days`, `vs previous 30 days`; none for `All time`). A share changes in whole points (`▲ 12 pts`), an amount in whole percent of the previous value (`▼ 18%`), both computed on unrounded values; a change that rounds to 0 reads `No change`. It is in the success tone when it goes the better way, the danger tone otherwise; the text alone tells the direction. There is no change line when the previous value is missing, its sample is below 5, or, for an amount, it is 0.
- **Median**: the middle value, or the mean of the two middle ones. **p90**: nearest rank, the value at position `ceil(90 × n / 100)`.
- **Help**: each figure has an information button `About <label>` that shows its one-line definition (the texts below).

### Trend cut

Every trend chart of `/stats` and `/frictions` is cut by the period: `Today` by hour (00:00 to 23:00; 23 or 25 buckets on a daylight saving day), `Last 7 days` and `Last 30 days` by day, `All time` by week (Monday to Sunday) from the week of the earliest merged issue, or by month past 26 weeks, or by year past 36 months. The current bucket is last and labelled `this hour`, `today`, `this week`, `this month` or `this year`; others read `14:00`, `Nov 16` (a day, or a week's Monday), `Nov 2026` or `2026`. Titles name the unit (`by day`, `per week`). `All time` with no merged issue shows the 12 weeks ending this week.

A bucket with `n` from 1 to 4 draws its bar at 40% opacity and its tooltip adds `small sample`; a bucket with `n` = 0 draws a stub. Every chart has a hidden table of its buckets for screen readers.

## Autonomy

| Figure                    | Definition                                                                                                                                      | n              | Better |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------ |
| `Merged without a person` | Share of the issues merged in the period that the factory merged on its own: no spec question, no refused serenity report, no person merging.   | merged issues  | higher |
| `Spec questions`          | Share of the merged issues whose agents stopped to ask a spec question (the needs-spec label) before the merge.                                 | merged issues  | lower  |
| `Waiting for a person`    | Median time the factory waited once it stopped, on a refused serenity report or a spec question, until the next report, the merge or the close. | answered stops | lower  |

`Waiting for a person` counts the [stops](outcomes.md#stops) answered in the period (by their end), and adds `<k> still waiting` for the open issues with an open stop now.

- `Merged without a person, by <unit>`: the share per bucket, tooltip `75% · 3 of 4`.
- `Why a person stepped in`: each merged issue of the period at `Merged after a person` or `Merged by a person` in exactly one row, the first that applies: `1–5 pts`, `6–15 pts` or `16+ pts below threshold` (by its latest refusing report before the merge with a score below its threshold), `Gates failed` (a refusing report before the merge), `Spec question` (a needs-spec episode before the merge), else `Auto-merge off`. With none: `No person had to step in.` Under it, `<x> review rounds on average before a stop`: the mean rounds of those refusing reports that have rounds.

## Quality

| Figure                 | Definition                                                                                                                               | n                                     | Better |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------ |
| `Right the first time` | Share of the merged issues whose first serenity report already allowed the merge: score at or above the threshold and every gate passed. | merged issues with a report           | higher |
| `Review rounds`        | Mean number of review rounds in the serenity report that decided each merge (one decimal).                                               | merged issues whose report has rounds | lower  |
| `Score gain`           | Mean change of the serenity score between an issue's first report and its last one before the merge (`+12 pts`).                         | merged issues reviewed twice or more  | higher |

- The **first report** of an issue is its earliest report among every request that closes it, whatever the request's state (ties: the one stored first). `auto-merge off` does not make it fail.
- **Score gain** of an issue: among the reports at or before its merge time, the latest score minus the earliest; left out with fewer than two. Its change counts points.
- `Right the first time, by <unit>`: tooltip `60% · 3 of 5`.
- `First serenity score`: a histogram of the first report of each merged issue of the period, in bins of 5 (100 falls in `95–100`), marking those below their own threshold.

## Flow and cost

- `Merged per <unit>`: the number of issues merged per bucket (`4 issues`).

| Figure                    | Definition                                                                                                  | n                             | Better |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------- | ------ |
| `Lead time`               | Median time from an issue's creation to its merge, including the time it waited before any agent started.   | merged issues                 | lower  |
| `Cycle time`              | Median time from the first agent call on an issue to its merge: how long the agents took once they started. | merged issues with agent work | lower  |
| `Tokens per merged issue` | Median tokens a merged issue used over its whole life, its share of the orchestration included.             | merged issues with agent work | lower  |

- A negative time counts as 0. The first call is the earliest of any thread on the issue, whatever its period; an orchestration share does not start it. A merged issue's tokens are its `All time` tokens, counted once, in the period of its merge.
- Two strips, `Lead time` and `Tokens per merged issue`, show one dot per merged issue (`#<n> <title>`), with the median and p90 marked, each dot linking to its issue page with the period. Dots closer than one 28 px column stack in that column, 4 at most, then a `+<k>` pill.

**Where the tokens went**, over the period's calls by their own time, whatever their issue (n = API calls):

| Figure                   | Definition                                                                                                                            | Better |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `Tokens on dropped work` | Share of the period's tokens spent on issues that were closed without a merge (current stage, orchestration included).                | lower  |
| `No work item`           | Share of the period's tokens spent in threads tied to no issue.                                                                       | lower  |
| `Tokens on rework`       | Share of the period's tokens spent on an issue after its first refused serenity report: the cost of fixing work the review sent back. | lower  |

Rework counts the calls at or after the issue's first refusing report, whatever its stage; orchestration shares are not rework. A call can count in both dropped work and rework.

## Bugs

Shown when at least one factory project of the selection has a bug label and the kind filter is `All` or `Bugs`. A **merged bug** is an issue of kind `bug` whose merge time falls in the period, as every merged issue of `/stats`.

| Figure                   | Definition                                                                                             | n             | Better |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ------------- | ------ |
| `Time to fix`            | Median time from a bug's creation to its merge, including the time it waited before any agent started. | merged bugs   | lower  |
| `Bugs in delivered work` | Share of the issues merged in the period that are bugs.                                                | merged issues | lower  |
| `Reopened bugs`          | Share of the bugs merged in the period that were reopened at least once.                               | merged bugs   | lower  |

- `Time to fix` is the `Lead time` of bugs: with `Bugs` selected, both show the same value. A negative time counts as 0.
- `Bugs in delivered work` counts every merged issue of the period, features and bugs, even with `Bugs` selected: it is the one figure the filter does not narrow.
- A bug counts as **reopened** when the collection recorded it as reopened (timeline events on GitHub, state events on GitLab), whenever that happened: before its merge, or after a merge then fixed again. A bug merged twice counts once, at its latest merge.
- A strip `Time to fix`, like the `Lead time` strip: one dot per merged bug (`#<n> <title>`), median and p90 marked, each dot linking to the bug's issue page with the period, with the same stacking rule.
- `Bugs in delivered work, by <unit>`: the share per bucket, cut as every trend of `/stats`, tooltip `25% · 1 of 4`.

## API

`GET /api/stats/autonomy`, `/api/stats/quality` and `/api/stats/flow`, each with `period`, `tz` and `project`, return the counts behind each figure for the period and its previous one (none for `all`), and the trend as `unit` and `buckets`. A missing or unknown `period` or `tz` answers 400. With `kind=feature` or `kind=bug`, they count only the issues of that kind, as the kind filter does; another value answers 400, and without it their answers are unchanged.

`GET /api/stats/bugs`, with `period`, `tz` and `project`, returns the counts behind the three `Bugs` figures for the period and its previous one (none for `all`): `merged`, `bugs`, `reopened` and the sorted `fixMs`; the strip's bugs (`project`, `number`, `title`, `fixMs`); the trend as `unit` and `buckets` (`merged`, `bugs`); `bugTickets`, `true` when a factory project of the selection has a bug label; and `kinds` (`{ "feature": <n>, "bug": <n> }`), the issues of each kind merged in the period, for the filter.

`GET /api/stats/waiting`, with an optional `project` and an optional `kind` (`feature` or `bug`, another value answers 400), returns the open issues waiting for a person now, whatever the period, as the [overview](overview.md#needs-a-person) lists them: each with its `kind` (`feature` or `bug`, see [Kinds](outcomes.md#kinds)), its reasons and the start of its oldest open stop.
