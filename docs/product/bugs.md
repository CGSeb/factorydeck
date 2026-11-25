# Bugs

The list of bugs, `/bugs`: the bugs still open and for how long, those being fixed, and those fixed in the period, with whether each fix's test failed on the main branch before the fix. A bug is an issue of kind `bug` ([Kinds](outcomes.md#kinds)), by its current labels. Everything here comes from the [git host collection](data.md#git-host) and the session logs, and refreshes with them.

The page has the `Bugs` link of the [sidebar](navigation.md#sidebar), right after `Features`, when at least one project of the selection has a bug label. `/features` keeps listing bugs with its kind filter ([Features](features.md)): `/bugs` adds a view.

## Header

`Bugs`, then `<o> open · <f> fixed`, where `<o>` counts the bugs of `Open` and `Fixing` and `<f>` the merged bugs of `Fixed`, then ` · <c> closed without a fix` when `<c>`, the bugs `Closed without merge` of `Fixed`, is not 0. The period pills sit on the right; the project comes from the project select. While the page loads, and when no project of the selection uses bug tickets, the summary line stays empty, so the header keeps its place.

## Groups

The bugs of the selection in three groups, in this order, each under a header row with its count; an empty group is left out.

- `Open`: every open bug at stage `Open`, `Ready`, `Needs spec` or `Blocked`, whatever the period, longest open first, from the start of its current [version](#versions).
- `Fixing`: every open bug at stage `Working` or `In review`, whatever the period, by latest activity in the period first (as the `Last activity` sort of the features list); bugs without activity in the period come last.
- `Fixed`: the bugs at a merged [stage](outcomes.md#stages) whose [merge time](outcomes.md#help-from-a-person) falls in the period, and the bugs `Closed without merge` whose close time falls in it, latest merge or close first.

Ties go to the highest number. Each group shows 20 rows, then `Show more` adds 20 more. A change of the period or of the project shows each group from its first 20 rows again.

Open bugs show whatever the period, because the question is how long they have been waiting; fixed and closed bugs show by the time they ended, in the period.

## Versions

A bug has one [version](outcomes.md#versions-of-a-bug) per opening: each reopening starts a new attempt. The list places, counts and shows each bug by its **current version** only, the latest: its stage, its group, its `Age`, its `Reproduced`, its `Serenity` and its `Tokens` all come from that version, and a bug shows once, never twice. A bug fixed in version 1 inside the period and reopened since leaves `Fixed` and shows by its version 2 in `Open` or `Fixing`, by the stage of its labels (`Open` with none). A bug reopened with no new request yet shows `—` in `Reproduced` and `Serenity`, and `0` tokens until a call falls in the version: nothing of the fix that did not hold shows.

A bug in version 2 or more shows a muted `v<k>` tag right after `<title> (#<n>)`, whose accessible name is `Version <k>`; a bug in version 1 shows none.

## Columns

- `Bug`: `<title> (#<n>)` as on the features list, then the `v<k>` tag from version 2, linked to the [page of the bug](#page-of-a-bug) with the period.
- `Project`, only with `All projects`.
- `Stage`: its stage badge.
- `Age`, from the start of the current version (the creation for version 1, the reopening after): in `Open` and `Fixing`, `Open for <duration>`, from that start to now; in `Fixed`, `Fixed in <duration>`, from that start to its merge, or `Closed after <duration>`, from that start to its close, for `Closed without merge`. Durations as in the [conventions](navigation.md#figures-and-formats).
- `Reproduced`, from the [fix](outcomes.md#fix-of-a-bug): `Failed on main` in the success tone; `Passed on main`, `Did not run on main` or `No test` in the warning tone; `—` with no fix or no value. `Failed on main` is the only success value, because only a test that failed on main proves the bug was reproduced.
- `Serenity`: the score of the report that counts, as on the features list.
- `Tokens`: the bug's tokens, orchestration share included as on the features list, of the calls that fall both in the period and in its current version (from its start to its end, or to now while it is ongoing); `0` with no such call. The orchestration share is split among the issues of the calls inside that same time span.

## Empty states

- With no bug in any group: `No open bug, and no bug fixed in this period.`
- With no project of the selection using bug tickets: `No project here uses bug tickets. Run /setup-factory in a project to add them.`, and no table.

## Page of a bug

`/bugs/<n>?project=<root>` is the [issue page](features.md#issue-page) of a bug: the same header, timeline and summary, with the same rules, the period pills and the `period` parameter, except that everything on it follows one [version](#versions-of-the-page) of the bug, never the period. The `Bugs` link of the sidebar is highlighted on it.

- The back link is `← <project name> bugs`, to `/bugs` with the bug's project and the period.
- Choosing another project opens `/bugs` with that project and the period.

Every link to a bug's issue page goes to `/bugs/<n>`, at its latest version (no `version` parameter): the rows of `/bugs`, the cards of the overview board, the rows of `/features`, the `Needs a person` rows, and the work item links of the session list and of the session page (the session's and each sub-agent's). Any other link to an issue page opens `/features/<n>`, which moves a bug to its page.

### Versions of the page

The page shows one [version](outcomes.md#versions-of-a-bug) of the bug at a time, the latest when it opens.

- A bug with 2 or more versions has a version bar under the page header: `‹`, `Version <k> of <n>`, `›`. `‹` (`Previous version`) goes to the older version and `›` (`Next version`) to the newer one; `‹` is disabled at version 1 and `›` at the latest. Both are buttons that work with the keyboard, and keep the focus when they become disabled. A bug with one version has no bar.
- The address keeps the version as `version=<k>`, replaced without a history entry on each step: the browser's back button leaves the page. The latest version leaves the parameter out. A `version` that is not a whole number from 1 to `<n>` shows the latest version and removes the parameter. The project, the period and the back link stay as they are when the version changes, and a period change keeps the version.
- Everything under the bar follows the version shown: the [Fix block](#fix-block), from the report that counts in that version; the summary (its tokens, split by role and orchestration share, serenity, review rounds, pull request, checks, reworked and `Frictions`), from the version's own requests and from the calls and frictions between its start and its end, or now while it is ongoing; and the timeline, with the threads and needs-spec episodes between that start and that end and the reports of the version's own requests (a request merged after the close that ended the version keeps its report there). `Reworked` is `Yes` only when the version has more than one request of its own: the reopen that starts a version is not rework. The header's stage and `<first> → <last> · <s> sessions` follow it too. Nothing of another version is summed in. The `Labels` line shows the bug's labels today, whatever the version: the collection keeps no past labels.
- A call or a friction between a version's close and the next reopen, or after the close of a closed bug, falls in no version and shows nowhere on the page, as on `/bugs`.
- The period does not cut a version: the page shows the whole version whatever the period, and the period only goes to the back link to `/bugs`. The `Frictions` link opens `/frictions` for the bug at `All time`, since that page has no versions: it lists the frictions of every version.
- A bug with 2 or more versions shows, under the `Fix` block, `Version <k>` with `Started` (`Opened <date and time>` for version 1, `Reopened <date and time>` after), `Ended` (`Reopened <date and time>` for an earlier version, the reopen that ended it; `Closed <date and time>` for a closed latest version; `Ongoing` otherwise) and `Duration`, from that start to that end, or to now while it is ongoing.
- The timeline of a version from 2 starts with a `Reopened` milestone, in the warning tone, with the time of its reopening. A version with no thread and no milestone shows `No activity in this version.`
- While another version loads, the header and the bar stay in place and the bar already shows the version asked; the rest keeps the last version on screen until the next one arrives.

### Fix block

At the top of the summary, `Fix`, from the [fix](outcomes.md#fix-of-a-bug) of the report that counts in the version shown, as in the `Reproduced` column at the latest version:

- `Root cause`: its sentence, or `Not given` when the report has none;
- `Reproduced`: its value with its tone, as in the `Reproduced` column above, or `—`;
- `Pull request`: `#<n>` linked to the request of that report.

A version with no fix shows `No fix reviewed yet.` in place of the three lines. A report of another version, an earlier report of the same request, or a report of another request never shows here; they stay as milestones on the timeline.

### Redirects

The kind at the time the page loads picks the page:

- `/features/<n>?…` of a bug replaces its address with `/bugs/<n>?…`, and `/bugs/<n>?…` of a feature with `/features/<n>?…`, keeping every parameter, except that a feature's page then removes `version`, which it ignores. Replacing adds no history entry: the browser's back button skips it.
- An issue of no kind (not found, or its project not collected) stays on the address asked. On `/bugs/<n>` it shows `Issue not found.` with `← Bugs` to `/bugs` with the project; on `/features/<n>` it shows the issue page, or `Issue not found.` with `← Features` when FactoryDeck knows nothing of it.
- An issue relabelled on the git host moves to the other address at its next load after the collection.

## API

`GET /api/bugs?project=<root>&period=<period>&tz=<tz>` answers `bugTickets` (`true` when a project of the selection has a bug label), `groups` with `open`, `fixing` and `fixed`, and `counts` (`open`, `fixed`, `closed`, the figures of the header). Each bug has its `number`, `project`, `projectName`, `title`, `url`, `stage`, `createdAt` (the issue's creation), `version` (`{ "number": <k>, "count": <k>, "startedAt": <ISO time> }`: `number` is the current version, `count` the number of versions, equal here, and `startedAt` the start of the current version), `mergedAt` (merged bugs of `Fixed`) and `closedAt` (`Closed without merge`), otherwise `null`. `stage`, `mergedAt`, `closedAt`, `fix`, `score`, `threshold`, `lastAt` and the tokens follow the current version. `fix` (`{ "rootCause": <string|null>, "reproduced": "failed-on-main" | "passed-on-main" | "did-not-run-on-main" | "no-test" | null, "request": { "number": <n>, "url": <string> } }`, where `request` is the request of the report that counts, or `null` with no report); `score` and `threshold` (`null` with no report); `lastAt`, its latest call in the period and the current version; and `tokens`, `tokenCounts` with the four kinds, and `costUsd`. Invalid parameters answer `400`.

`GET /api/features/<n>?project=<root>&period=<period>&tz=<tz>&version=<k>` gives one version of a bug: its summary, timeline (`threads`, `sessions`, `roles`, `orchestration`, and `detail` with the version's `requests`, `outcome` and `milestones`) and `fix`, with the same shape as above, from that version only, and `version` as in `/api/bugs` with `endedAt` (its close, or `null` while it is ongoing) and `reopenedAt` (the start of the next version, or `null` for the latest). Without `version`, the latest version. A `version` that is not a whole number from 1 to the bug's count, or any `version` on an issue that is not a bug, answers `400` with `{ "status": "invalid-version", "error": <string>, "refreshSeconds": <s> }`. A feature has `version: null`.
