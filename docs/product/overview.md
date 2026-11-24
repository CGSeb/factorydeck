# Overview

The home page, `/`: whether the factory is healthy and moving forward, which issues wait for a person now, and where every issue stands. It reads `/api/overview`, `/api/features`, `/api/roles`, `/api/stats/autonomy`, `/api/stats/quality`, `/api/stats/flow` and `/api/stats/waiting` for the period and project.

## Header

`<n> issues merged for <tokens> tokens` (`1 issue merged for …`; with none, `No issue merged · <tokens> tokens`). `<n>` counts the [merged issues](outcomes.md#stages) whose merge time falls in the period, as [`/stats`](stats.md#common-rules) counts them, whether or not they had a call in the period; `<tokens>` is the period's tokens, equal to those of `/features`, `/roles`, `/skills` and `/sessions`.

The tokens amount is a button, `Where the tokens went`, that keeps the exact-number tooltip on hover and focus. It opens a dialog of the same name: the period's tokens split by role, with a legend and an amount per role, `Tokens per day` (`Tokens per hour` for `Today`) as bars, and a link `Roles` to `/roles` with the project. `Escape`, the `Close` button and the backdrop close it and give the focus back to the button. The dialog has no URL parameter: a reload or a shared link opens the page with it closed. While open, it refreshes with the page. With 0 tokens in the period, the amount is plain text, not a button.

The summary line reads `<t> tokens per merged issue · <s> sessions`, where `<t>` is the `Tokens per merged issue` median of [`/stats`](stats.md#flow-and-cost) for the same period and project; the first part is left out when that figure has fewer than 5 merged issues with agent work. The header is titled `Overview` until its figures arrive.

## Health

A panel with a link `Stats` to `/stats` with the project and period. It shows `Merged without a person` and `Right the first time` side by side, the same figures as on [`/stats`](stats.md) for the same period and project: value, `n = <count> <noun>`, change line, `About <label>` help and `Not enough data` below 5 items, by its [common rules](stats.md#common-rules). Next to them (under them below 680 px), `Merged per <unit>` as bars, cut by the period as on `/stats` ([Trend cut](stats.md#trend-cut)), with the same tooltip and hidden table for screen readers.

The title's `<n>`, the two figures and the bars count merged issues the same way, so the bars add up to `<n>`.

## Needs a person

Every open issue of the project selection where the factory waits for a person now, whatever the period: an issue at stage `Blocked` or `Needs spec`, or an issue with a [stop](outcomes.md#stops) still waiting. These are the stops `/stats` counts as `still waiting`; a report that refuses only because of `auto-merge off` does not count. Closed and merged issues never show.

Each row shows `#<n> <title>` linked to its issue page with the period, its project with `All projects` only, its reasons and how long it has waited:

| Reason            | When                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `Blocked`         | The issue is at stage `Blocked`.                                                                 |
| `Spec question`   | A needs-spec episode has no removal, or the issue is at stage `Needs spec`.                      |
| `Below threshold` | A refusing report has no later report, merge or close, and its score is below its threshold.     |
| `Gates failed`    | A refusing report has no later report, merge or close, and its score is not below its threshold. |

An issue with several reasons shows each one. The wait runs from the start of its oldest open stop (`3 h 05 min`, `1 d 4 h`); an issue with no open stop (a `Blocked` issue, or a `Needs spec` issue whose label history is incomplete) shows `—`. Rows sort by longest wait first, then those without a wait, then by highest issue number. The panel shows 10 rows, then `Show more`. With no such issue, the panel is left out.

## Board

Four columns side by side (at least 250 px each, wrapping below): `Ready`, `Working`, `In review`, `Merged`, the [board groups](outcomes.md#stages) of the issues of `/features` for the same period and project, that is the issues with a call in the period. So the `Merged` column can hold an issue merged before the period, and miss one merged in it with no call. Issues closed without merge, not found or not collected are not on the board.

- Each column shows its number of issues, and its 5 issues with the latest activity, most recent first; with more, `+ <k> more` links to `/features?stage=<group>` with the project and period.
- A card shows its project only with `All projects`, and its badges: in `Ready`, its stage when it is not `Ready`; in `In review`, its review rounds when its report has some; in `Merged`, its serenity score, plus `by a person` or `after a person` for those stages. A card links to its issue page with the period.
- A card shows the time of the issue's last activity, its latest call in the period (orchestration left out, as the `Last activity` sort of `/features`): `just now` under 1 minute, `<m> min ago` under 1 hour, `Today, 14:05` the same local day, `22 Nov, 17:33` before. A card with no call in the period shows no time. A relative time updates without a reload, at least once a minute.

## Empty and loading

With no call in the period, the header reads `<n> issues merged for 0 tokens` (`No issue merged · 0 tokens` with no merge) and `No activity in this period.` replaces the board. The health panel still shows, by the rules of `/stats`, and `Needs a person` still shows when an issue waits. The header, the health panel, the needs-a-person panel, the board and the dialog each load and fail on their own; while the period or the project changes, the last data stays on screen.
