# Outcomes

How an issue ended up in the factory: where it stands, whether it merged on its own or after a person, its serenity score, its review rounds and whether it was reworked. Everything here comes from the [git host collection](data.md#git-host) and refreshes with it.

## Stages

Each collected issue has one stage, the first that applies:

1. A pull or merge request that closes it is merged:
   - `Merged by a person` when the report that counts refused the merge (below);
   - else `Merged after a person` when [a person helped](#help-from-a-person);
   - else `Merged`.
2. The issue is closed: `Closed without merge`.
3. It carries a label of `issues.labels` in `docs/agents/factory.yml`, in this order: `blocked` → `Blocked`, `needs_spec` → `Needs spec`, `review` → `In review`, `working` → `Working`, `ready` → `Ready`.
4. Otherwise `Open`.

A missing label key is a collection error of that project. An issue not found among the collected ones shows `#<n> (not found)` and has no stage; before a project's first collection, `#<n>` alone.

Tones: the three merged stages success; `Closed without merge` and `Blocked` danger; `Needs spec` warning; the others neutral. The text always says the stage.

**Board groups**, used on the [overview](overview.md) and the [features list](features.md): `Ready` (`Open`, `Needs spec`, `Ready`, `Blocked`), `Working`, `In review`, `Merged` (the three merged stages). `Closed without merge` and unknown issues are in no group.

## Serenity reports

A serenity report is a comment on a pull or merge request with a line `## Serenity: <score>/100 (threshold <threshold>)`, both whole numbers. From the same comment, a line starting `Review: <r> round` gives the review rounds, and a line starting `Gates:` tells whether every gate passed (`Gates: all passed.`, or `Gates: passed`, in any letter case); any other gates line counts as failed gates, and a report with no gates line leaves the merge to its score. FactoryDeck stores every report, with its time; the format is the one `build-feature` writes and is not configurable.

- **Fix lines**, written by `fix-bug` only, outside code fences like every line here:
  - `Root cause: <sentence>`: the text after `Root cause: `, trimmed, at most 200 characters (a longer one is cut at 199 with `…`). `Root cause: none`, an empty text or no line gives no root cause.
  - `Reproduced: <value>`: `failed on main`, `passed on main`, `did not run on main` or `no test`, matched exactly. Any other value or no line gives no value.
  - The first line of each kind counts. A report of `build-feature` has neither line. FactoryDeck keeps both as `fix-bug` wrote them and does not judge them.
- **The report that counts** for an issue: the latest report of the merged request that closes it; with none merged, of the most recently updated open one; else none. It gives the score, threshold and rounds shown with the issue, and sorts the features list.
- **A report refuses the merge** when its score is below its own threshold (strictly), its gates did not all pass, or the project's `build.auto_merge` is `false`. The reasons, in that order: `below threshold`, `gates failed`, `auto-merge off`. `auto-merge off` is a project setting, read at each collection: turning it off later makes every earlier merge with a report `Merged by a person`.
- A **refusing report**, in the figures of [Stats](stats.md), is one below its threshold or with failed gates; `auto-merge off` does not count there.
- A merged request with no report counts as `Merged` (or `Merged after a person`).
- A score below its threshold shows in the warning tone with `below threshold` after it.
- **Score path**: when the request that counts has two reports or more and its first score differs from its last, the score shows as `Serenity <first> → <last>/100 (threshold <t>)`, with the last report's threshold. The features list keeps the last score only.

## Fix of a bug

The **fix** of a bug is the root cause and the reproduction of the report that counts for it; a report without fix lines gives a fix with neither. With no report, the bug has no fix. It shows in the `Reproduced` column of the [bugs page](bugs.md).

## Versions of a bug

A bug has one **version** per opening, read from the close and reopen events the [collection](data.md#git-host) stores:

- Version 1 starts at the bug's creation; each reopen event starts the next version. A version ends at the first close event after its start, or is **ongoing** while the bug is open. A bug never reopened has one version. A version **counts** what happens from its start up to the start of the next version, excluded, and the latest version up to now, whether the bug is open or closed: a call, a friction or a needs-spec episode after a close and before the next reopen counts in the version that close ended, and one after the last close of a closed bug in its latest version. So the bug's own calls, frictions and needs-spec episodes of its versions add up exactly to those since its creation; the orchestration share, split inside each version's time span, and a thread listed in each version it has calls in, can differ from the bug's whole history (see [Versions of the page](bugs.md#versions-of-the-page)). The end a version shows, and the durations to its merge or close, still stop at its close.
- Events are read by time. A close event while no version is ongoing, and a reopen event while one is ongoing (a repeated or out-of-order event), are ignored. Two events at the same second are read close first, then reopen: the version ends and the next one starts. An open bug whose last stored event is a close is ongoing in its last version; a closed bug whose stored events leave its last version ongoing ends it at its close time.
- A pull or merge request that closes the bug belongs to the latest version started at or before its merge time (its update time when the git host gives none), or, when it is not merged, at or before its creation time; one before the bug's creation belongs to version 1. A request merged after a close and before the next reopen therefore stays with the version that close ended, and a request merged before a reopen never gives the fix of a later version, even when its report is the latest of the issue.
- A version's stage, [report that counts](#serenity-reports), serenity, [fix](#fix-of-a-bug) and merge time come from its own requests only, with the rules of this page; a version with no request has no fix and no serenity, and its stage comes from the bug's labels, or `Closed without merge` when the bug is closed.
- A version's tokens are the bug's tokens, orchestration share included, of the calls from its start up to the start of the next version, excluded, or up to now for the latest one.

Versions apply to bugs on the [bugs page](bugs.md#versions), on the [page of a bug](bugs.md#versions-of-the-page), and to the `<o> open bugs` of the [overview](overview.md) header, which is the `open` count of `/bugs`, and to `Bugs reported` on [Stats](stats.md#bugs), which counts the start of each version as an opening. The features list, the issue page of a feature, the rest of [Stats](stats.md) and the rest of the overview keep the rules above for the whole issue.

## Help from a person

A merged issue was **helped by a person** when, before the merge time of the request that counts, at least one of these happened:

- a serenity report of any request that closes it refused the merge for its score or its gates;
- the issue carried the needs-spec label at least once.

`Merged by a person` wins over it. `Merged without a person` counts only `Merged`. Who clicked merge is not known: the agents use the person's own account.

The **merge time** of an issue is the `mergedAt` of the request that counts, or its update time when the git host gives none.

## Needs-spec episodes

The collection stores each time the needs-spec label was added to an issue or removed from it, and nothing else of the label history. An episode runs from an addition to the next removal; one with no removal is still waiting. Renaming the label later leaves earlier episodes under the old name uncounted.

## Stops

A stop is a moment the factory handed the issue to a person:

- a needs-spec episode, from the label's addition to its removal;
- a refusing report, from its time to the earliest strictly later of: the next report of any request that closes the issue, the merge time, or the close time. A refusing report at or after the merge time starts no stop.

A stop with an end is **answered**; without one it is still waiting. The time agents spend on the next round counts in the wait.

## Reworked

An issue was reworked when more than one pull or merge request closes it (any state), or it was reopened at least once. On the [page of a bug](bugs.md#versions-of-the-page), `Reworked` follows the version shown instead: a version was reworked when more than one request of that [version](#versions-of-a-bug) closes the bug; the reopen that starts a version is not rework.

## Kinds

Each collected issue has a kind, `feature` or `bug`, from the optional `bugs.label` of the project's `docs/agents/factory.yml`.

- A project has **no bug label** when `bugs` is missing or not a map, or `bugs.label` is missing, not a string, or empty after trimming. It also has none when `bugs.label` equals `issues.labels.spec` or a flow label of `issues.labels` (`ready`, `working`, `needs_spec`, `review`, `blocked`), compared after trimming and without letter case. None of these is a collection error: the other settings are read as before and no banner line is added.
- An issue is a **bug** when one of its current labels equals the project's bug label, after trimming and without letter case; otherwise it is a **feature**. A project with no bug label has only features, and an issue with both the spec label and the bug label is a bug.
- The kind depends only on the issue's current labels and the current setting, never on the label history, the title, the branch or the pull request: a relabel on the git host, or a `bugs.label` changed in `factory.yml`, shows at the next collection for every period, without reading the project again in full. A former kind is not kept.
- Every issue has exactly one kind, so the features and the bugs of a list add up to its issues. The kind changes no stage, score, round, token or other figure.
- The API gives it as `kind` on each issue row of `GET /api/features` (`null` for an issue not found or not collected), on `GET /api/features/<n>`, on each row of `GET /api/stats/waiting`, and beside the work item of each session and sub-agent of `GET /api/sessions` and `GET /api/sessions/<id>` (`null` without a work item, or for an issue not found or not collected). It picks the issue page a link opens: `/bugs/<n>` for a bug, `/features/<n>` otherwise.

## Where outcomes show

- The **session page** aside: the stage, serenity badge and review rounds of its work item.
- The **issue page**: the stage, the summary and the [timeline](features.md#issue-page) with every report and needs-spec episode as milestones.
- The **features list** and the **overview board**: stage, rounds and score per issue.
- The **bugs page**: stage, score and the fix's reproduction per bug.
- **Stats**: every figure of the [Autonomy and Quality panels](stats.md).
