# Features and issues

`/features` lists every issue the factory worked on in the period; `/features/<n>?project=<root>` tells how one issue got where it is. An issue is identified by its project and number. A bug has its issue page at `/bugs/<n>` instead ([Page of a bug](bugs.md#page-of-a-bug)), and every link to a bug's issue page goes there.

## What an issue counts

- **Calls of an issue**: the calls of every thread whose [work item](roles-and-work-items.md#work-items) is the issue, plus its [orchestration share](roles-and-work-items.md#orchestration-share).
- **Sessions of an issue**: the sessions with at least one call on it in the period, its share included.
- **Tokens per merged issue**: the tokens of the merged issues of the period, orchestration included, divided by their number.
- **Merged without a person**: the share of merged issues at stage `Merged`.
- Stage, score and rounds are the issue's current values, whatever the period ([Outcomes](outcomes.md)).
- The `No work item` row holds every call no issue receives. Every list's tokens, `No work item` included, equal the overview total for the same period and project.

## Features list

The header `Features` sums up the period: `<n> issues · <m> merged, <k> without a person · <t> tokens per merged issue` (the last two parts left out with no merged issue).

### Stage filter

A strip of the four [board groups](outcomes.md#stages), each with its number of issues and tokens. Selecting a group shows only that group and sets `stage` to `ready`, `working`, `in-review` or `merged`; selecting it again removes it. Values match exactly: another spelling, an empty or unknown value means none; repeated, the first counts. A group with no issue shows `No issue in this stage.`

### Kind filter

When at least one project of the selection has a [bug label](outcomes.md#kinds), even with no bug in the period, three pills sit beside the stage filter: `All` (the default), `Features <n>` and `Bugs <n>`, where `<n>` is the number of issues of that [kind](outcomes.md#kinds) in the list for the period and project, all stages together. An issue whose kind is unknown (not found, not collected) shows under `All` only. With no such project, the filter is absent and every issue shows.

Selecting `Features` or `Bugs` sets `kind` to `feature` or `bug`; `All` removes it. Values match exactly: another spelling, an empty or unknown value means `All`; repeated, the first counts. A `kind` in the URL while the filter is absent is ignored. The kind is kept when the period, the project, the stage or the sort changes.

With a kind selected, the header, the stage filter's counts and tokens and the table show only the issues of that kind, and the `No work item` and `Total` rows are left out. The kind and stage filters combine. A kind with no issue shows `No bug in this period.` or `No feature in this period.`; with a stage also selected and no issue in it, `No issue in this stage.` While the list reloads, the filter stays with its last counts.

### Issues table

Rows are grouped under header rows, in this order: `In review`, `Working`, `Ready`, `Merged`, then `Closed` (stage `Closed without merge`) and `Unknown` (not found or not collected); an empty group is left out. Columns:

- `Issue`: `<title> (#<n>)`, the title first and the number in parentheses in a muted style that never breaks across lines, linked to the issue page with the period; `#<n> (not found)` for a number the git host does not know, and `#<n>` alone when the title was not collected. A bug then shows a `Bug` badge in the danger tone, on the same line when it fits; a feature or an issue of unknown kind shows none;
- `Project`, only with `All projects`;
- `Split by role`: a thin bar of the issue's tokens by role, orchestration last;
- `Sessions`, `Rounds`;
- `Serenity`: the score of the report that counts, in the success tone at or above its threshold, in the warning tone with `below threshold` under it, `—` without a report;
- `Tokens`.

A sort select offers `Last activity` (the default, latest call of the issue in the period, orchestration left out), `Tokens`, `Sessions`, `Review rounds`, `Serenity` (lowest first), `Issue number`; every other option sorts the highest first. Rows sort inside their group; issues without a value come last; ties go to the latest activity, then the highest number. The sort is kept in the URL; the default leaves no parameter.

After the groups: a `No work item` row, then a bold `Total` row with all sessions and the period's tokens. Both are left out while a stage or a kind is selected.

## Issue page

The back link `← <project name> features` returns to `/features` with the issue's project and the period. The header is `<title> (#<n>)`, the title linked to the issue on the git host (with a small `↗`) and the muted `(#<n>)` outside the link (`#<n> (not found)` for a number the git host does not know, `#<n>` when the title was not collected), then the stage and `<first> → <last> · <s> sessions` (the dates of its first and last call in the period, one date when equal). An unknown issue shows `Issue not found.` and `← Features`. A bug opened here moves to `/bugs/<n>` ([Redirects](bugs.md#redirects)).

### Timeline

Titled `How it got merged` for a merged stage, else `Where it stands`. It lists, in order:

- **Steps**: the issue's threads in the order they started; consecutive threads of the same role form one step (builder, reviewer, builder makes three steps). A step's title is its role, with ` ×<k>` for several threads (`reviewer ×2`); its detail is `<role> · <k> thread(s)` and the date and time or their range (`18 Nov, 09:00 → 11:30`, or across days `18 Nov, 09:00 → 19 Nov, 14:00`); its tokens are its threads' sum. Each thread row shows its description (or its session title for a main thread or a blank description), links to its session, and shows its start and tokens. The step marker has the role's colour.
- **Milestones**, between the steps, after the last step that started at or before them (or before the first step), in time order; a tie puts the milestone after the step:
  - a serenity report: `Serenity <score>/100 (threshold <threshold>)` then ` · merge refused: <reasons>` (warning tone) or ` · merge allowed` (success tone), with its date and time and `#<n>` linked to the request;
  - a needs-spec episode: `Needs spec`, with `waiting for a person` while the label is on, or `answered <date and time>`, in the warning tone.
    Milestones have a smaller marker, no role colour, no tokens. Only those inside the period show; an episode that started before the period is not shown.
- **Orchestration**, last, when the issue has a share: `Share of the orchestrating sessions`, with its tokens and no thread.

Every step, thread and milestone of the period shows, with no limit. With no thread in the period: `No activity in this period.`

### Summary

Beside the timeline: the issue's tokens, its orchestration share, its split by role, its serenity score (with `from <first>` under it when the [score path](outcomes.md#serenity-reports) changed), review rounds, pull request, checks, labels (each in its git host colour, text black or white for contrast), reworked, and `Frictions`: the issue's frictions in the period, linking to `/frictions?project=<root>&issue=<n>&period=<period>`, or `None`.

The issue's tokens equal its row on `/features` for the same period and project.

## API

- `GET /api/features`: with `kind=feature` or `kind=bug`, only the issues of that kind, with `merged` computed on them (another value answers `400`). Per issue its `kind` (`feature`, `bug`, or `null` for an issue not found or not collected, see [Kinds](outcomes.md#kinds)), stage, score, rounds, sessions, tokens with their four kinds, cost, orchestration share, `roles` (by tokens, orchestration last) and `lastAt`; the `noWorkItem` row and the totals, which have no `kind`; `merged` (count, without a person, `tokensPerIssue`); `bugTickets`, `true` when a project of the selection has a bug label; and `kinds` (`{ "feature": <n>, "bug": <n> }`), counted on every issue of the list before the kind filter.
- `GET /api/features/<n>?project=<root>`: the issue, its `kind` (same values), its `threads` (`sessionId`, `sessionTitle`, `threadId`, `role`, `description` or `null` for a main thread, `firstAt`, `lastAt`, tokens, cost), its `fix` (the [fix of a bug](bugs.md#fix-block), `null` for a feature, an issue of no kind or a bug with no fix), its orchestration row, its milestones and its friction count. The threads plus the orchestration share add up to the issue's tokens on the list.
