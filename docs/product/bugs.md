# Bugs

The list of bugs, `/bugs`: the bugs still open and for how long, those being fixed, and those fixed in the period, with whether each fix's test failed on the main branch before the fix. A bug is an issue of kind `bug` ([Kinds](outcomes.md#kinds)), by its current labels. Everything here comes from the [git host collection](data.md#git-host) and the session logs, and refreshes with them.

The page has the `Bugs` link of the [sidebar](navigation.md#sidebar), right after `Features`, when at least one project of the selection has a bug label. `/features` keeps listing bugs with its kind filter ([Features](features.md)): `/bugs` adds a view.

## Header

`Bugs`, then `<o> open · <f> fixed`, where `<o>` counts the bugs of `Open` and `Fixing` and `<f>` the merged bugs of `Fixed`, then ` · <c> closed without a fix` when `<c>`, the bugs `Closed without merge` of `Fixed`, is not 0. The period pills sit on the right; the project comes from the project select. While the page loads, and when no project of the selection uses bug tickets, the summary line stays empty, so the header keeps its place.

## Groups

The bugs of the selection in three groups, in this order, each under a header row with its count; an empty group is left out.

- `Open`: every open bug at stage `Open`, `Ready`, `Needs spec` or `Blocked`, whatever the period, longest open first.
- `Fixing`: every open bug at stage `Working` or `In review`, whatever the period, by latest activity in the period first (as the `Last activity` sort of the features list); bugs without activity in the period come last.
- `Fixed`: the bugs at a merged [stage](outcomes.md#stages) whose [merge time](outcomes.md#help-from-a-person) falls in the period, and the bugs `Closed without merge` whose close time falls in it, latest merge or close first.

Ties go to the highest number. Each group shows 20 rows, then `Show more` adds 20 more. A change of the period or of the project shows each group from its first 20 rows again.

Open bugs show whatever the period, because the question is how long they have been waiting; fixed and closed bugs show by the time they ended, in the period.

## Versions

A bug has one [version](outcomes.md#versions-of-a-bug) per opening: each reopening starts a new attempt. The list places, counts and shows each bug by its **current version** only, the latest: its stage, its group, its `Age`, its `Reproduced`, its `Serenity` and its `Tokens` all come from that version, and a bug shows once, never twice. A bug fixed in version 1 inside the period and reopened since leaves `Fixed` and shows by its version 2 in `Open` or `Fixing`, by the stage of its labels (`Open` with none). A bug reopened with no new request yet shows `—` in `Reproduced` and `Serenity`, and `0` tokens until a call falls in the version: nothing of the fix that did not hold shows.

A bug in version 2 or more shows a muted `v<k>` tag right after `<title> (#<n>)`, whose accessible name is `Version <k>`; a bug in version 1 shows none.

## Columns

- `Bug`: `<title> (#<n>)` as on the features list, then the `v<k>` tag from version 2, linked to the bug's [issue page](features.md#issue-page) with the period.
- `Project`, only with `All projects`.
- `Stage`: its stage badge.
- `Age`, from the start of the current version (the creation for version 1, the reopening after): in `Open` and `Fixing`, `Open for <duration>`, from that start to now; in `Fixed`, `Fixed in <duration>`, from that start to its merge, or `Closed after <duration>`, from that start to its close, for `Closed without merge`. Durations as in the [conventions](navigation.md#figures-and-formats).
- `Reproduced`, from the [fix](outcomes.md#fix-of-a-bug): `Failed on main` in the success tone; `Passed on main`, `Did not run on main` or `No test` in the warning tone; `—` with no fix or no value. `Failed on main` is the only success value, because only a test that failed on main proves the bug was reproduced.
- `Serenity`: the score of the report that counts, as on the features list.
- `Tokens`: the bug's tokens, orchestration share included as on the features list, of the calls that fall both in the period and in its current version (from its start to its end, or to now while it is ongoing); `0` with no such call. The orchestration share is split among the issues of the calls inside that same time span.

## Empty states

- With no bug in any group: `No open bug, and no bug fixed in this period.`
- With no project of the selection using bug tickets: `No project here uses bug tickets. Run /setup-factory in a project to add them.`, and no table.

## API

`GET /api/bugs?project=<root>&period=<period>&tz=<tz>` answers `bugTickets` (`true` when a project of the selection has a bug label), `groups` with `open`, `fixing` and `fixed`, and `counts` (`open`, `fixed`, `closed`, the figures of the header). Each bug has its `number`, `project`, `projectName`, `title`, `url`, `stage`, `createdAt` (the issue's creation), `version` (`{ "number": <k>, "count": <k>, "startedAt": <ISO time> }`: `number` is the current version, `count` the number of versions, equal here, and `startedAt` the start of the current version), `mergedAt` (merged bugs of `Fixed`) and `closedAt` (`Closed without merge`), otherwise `null`. `stage`, `mergedAt`, `closedAt`, `fix`, `score`, `threshold`, `lastAt` and the tokens follow the current version. `fix` (`{ "rootCause": <string|null>, "reproduced": "failed-on-main" | "passed-on-main" | "did-not-run-on-main" | "no-test" | null }`, or `null` with no report); `score` and `threshold` (`null` with no report); `lastAt`, its latest call in the period and the current version; and `tokens`, `tokenCounts` with the four kinds, and `costUsd`. Invalid parameters answer `400`.
