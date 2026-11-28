# Overview

The home page, `/`: whether the factory is healthy and moving forward, which issues wait for a person now, and where every issue stands. It reads `/api/overview`, `/api/features`, `/api/roles`, `/api/stats/autonomy`, `/api/stats/quality`, `/api/stats/flow` and `/api/stats/waiting` for the period and project.

## Header

`<n> issues merged for <tokens> tokens` (`1 issue merged for …`; with none, `No issue merged · <tokens> tokens`). `<n>` counts the [merged issues](outcomes.md#stages) whose merge time falls in the period, as [`/stats`](stats.md#common-rules) counts them, whether or not they had a call in the period; `<tokens>` is the period's tokens, equal to those of `/features`, `/roles`, `/skills` and `/sessions`.

With bug tickets, when at least one project of the selection has a bug label, the title names the [kinds](features.md#kind-filter) apart: `<f> features and <b> bugs merged for <tokens> tokens` (`1 feature and 1 bug merged for …`). A kind at 0 is left out (`<f> features merged for …`, `<b> bugs merged for …`); with no merge, it reads `No issue merged · <tokens> tokens` as without bug tickets. `<f>` and `<b>` count the same merged issues as `<n>`, by the kind of their current labels, so `<f> + <b>` is the `<n>` of `/stats` with `All`: a bug relabelled as a feature moves from `<b>` to `<f>` at the next collection. Without a project using bug tickets, the title is `<n> issues merged for <tokens> tokens` as above.

The tokens amount is a button, `Where the tokens went`, that keeps the exact-number tooltip on hover and focus. It opens a dialog of the same name: the period's tokens split by role, with a legend and an amount per role, `Tokens per day` (`Tokens per hour` for `Today`) as bars, and a link `Roles` to `/roles` with the project. `Escape`, the `Close` button and the backdrop close it and give the focus back to the button. The dialog has no URL parameter: a reload or a shared link opens the page with it closed. While open, it refreshes with the page. With 0 tokens in the period, the amount is plain text, not a button.

The summary line reads `<t> tokens per merged issue · <s> sessions`, where `<t>` is the `Tokens per merged issue` median of [`/stats`](stats.md#flow-and-cost) for the same period and project; the first part is left out when that figure has fewer than 5 merged issues with agent work. With bug tickets, it ends with ` · <o> open bugs` (`1 open bug`), a link to [`/bugs`](bugs.md) with the project and the period, where `<o>` is the `open` count of the `/bugs` header for the same project, whatever the period; it is left out at 0, and always without bug tickets. The header is titled `Overview` until its figures arrive. The kind filter of the board does not change the title or the summary line.

`GET /api/overview` answers, besides the period's usage, `merged` by kind (`{ "feature": <n>, "bug": <n> }`, every merge counted as a feature without bug tickets), `openBugs` (`0` without bug tickets) and `bugTickets` (`true` when a project of the selection has a bug label).

## Health

A panel with a link `Stats` to `/stats` with the project and period. It shows `Merged without a person` and `Right the first time` side by side, the same figures as on [`/stats`](stats.md) for the same period and project: value, `n = <count> <noun>`, change line, `About <label>` help and `Not enough data` below 5 items, by its [common rules](stats.md#common-rules). Next to them (under them below 680 px), `Merged per <unit>` as bars, cut by the period as on `/stats` ([Trend cut](stats.md#trend-cut)), with the same tooltip and hidden table for screen readers.

The title's `<n>`, the two figures and the bars count merged issues the same way, so the bars add up to `<n>`.

## Needs a person

Every open issue of the project selection where the factory waits for a person now, whatever the period: an issue at stage `Blocked` or `Needs spec`, or an issue with a [stop](outcomes.md#stops) still waiting. These are the stops `/stats` counts as `still waiting`; a report that refuses only because of `auto-merge off` does not count. Closed and merged issues never show.

Each row shows `#<n> <title>` linked to its issue page with the period, its project with `All projects` only, its reasons and how long it has waited:

| Reason                      | When                                                                                                                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Blocked`                   | The issue is at stage `Blocked`.                                                                                                                                                                                            |
| `Spec question`             | A needs-spec episode has no removal, or the issue is at stage `Needs spec`.                                                                                                                                                 |
| `Below threshold (<score>)` | A refusing report has no later report, merge or close, and its score is below its threshold. `<score>` is the score of that report, as stored (`Below threshold (48)`); with several such reports, the latest one gives it. |
| `Gates failed`              | A refusing report has no later report, merge or close, and its score is not below its threshold.                                                                                                                            |

An issue with several reasons shows each one. The wait runs from the start of its oldest open stop (`3 h 05 min`, `1 d 4 h`); an issue with no open stop (a `Blocked` issue, or a `Needs spec` issue whose label history is incomplete) shows `—`. Rows sort by longest wait first, then those without a wait, then by highest issue number. The panel shows 10 rows, then `Show more`. With no such issue, the panel is left out.

## Board

Four columns side by side (at least 250 px each, wrapping below): `Ready`, `Working`, `In review`, `Merged`, the [board groups](outcomes.md#stages) of the issues of `/features` for the same period and project, that is the issues with a call in the period. So the `Merged` column can hold an issue merged before the period, and miss one merged in it with no call. Issues closed without merge, not found or not collected are not on the board.

- Each column shows its number of issues, and its 5 issues with the latest activity, most recent first; with more, `+ <k> more` links to `/features?stage=<group>` with the project, the period and the kind.
- A card shows its project only with `All projects`, and its badges: a bug first shows `Bug` in the danger tone (a feature shows no kind badge); then in `Ready`, its stage when it is not `Ready`; in `In review`, when it has a report, its serenity score as in `Merged`, then its review rounds when the report has some (`round 3`); in `Merged`, its serenity score (`serenity <score>` in the success tone at or above the threshold, `serenity <score> · below threshold` in the warning tone below it, `serenity <first> → <score>` when the report has a first score), plus `by a person` or `after a person` for those stages. A card links to its issue page with the period.
- A card shows the time of the issue's last activity, its latest call in the period (orchestration left out, as the `Last activity` sort of `/features`): `just now` under 1 minute, `<m> min ago` under 1 hour, `Today, 14:05` the same local day, `22 Nov, 17:33` before. A card with no call in the period shows no time. A relative time updates without a reload, at least once a minute.

### Kind filter

At the top of the board, the [kind filter of `/features`](features.md#kind-filter), with the same pills, counts, `kind` parameter and rules: shown only when a project of the selection has a bug label, `All` by default. With `Features` or `Bugs`, the four columns, their counts, their cards and their `+ <k> more` links hold only the issues of that kind; when none of the four columns holds an issue of that kind, `No bug in this period.` or `No feature in this period.` replaces the columns, even when the list holds issues of that kind that the board never shows (closed without merge, or not found), which the pill still counts. The header, the health panel and `Needs a person` are not filtered. The kind is kept when the period or the project changes; the sidebar links do not carry it, only `+ <k> more` does.

## Empty and loading

With no call in the period, the header reads `<n> issues merged for 0 tokens` (`No issue merged · 0 tokens` with no merge) and `No activity in this period.` replaces the board. The health panel still shows, by the rules of `/stats`, and `Needs a person` still shows when an issue waits. The header, the health panel, the needs-a-person panel, the board and the dialog each load and fail on their own; while the period or the project changes, the last data stays on screen.
