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

A serenity report is a comment on a pull or merge request with a line `## Serenity: <score>/100 (threshold <threshold>)`, both whole numbers. From the same comment, a line starting `Review: <r> round` gives the review rounds, and a line starting `Gates:` tells whether every gate passed (`Gates: all passed.`). FactoryDeck stores every report, with its time; the format is the one `build-feature` writes and is not configurable.

- **The report that counts** for an issue: the latest report of the merged request that closes it; with none merged, of the most recently updated open one; else none. It gives the score, threshold and rounds shown with the issue, and sorts the features list.
- **A report refuses the merge** when its score is below its own threshold (strictly), its gates did not all pass, or the project's `build.auto_merge` is `false`. The reasons, in that order: `below threshold`, `gates failed`, `auto-merge off`. `auto-merge off` is a project setting, read at each collection: turning it off later makes every earlier merge with a report `Merged by a person`.
- A **refusing report**, in the figures of [Stats](stats.md), is one below its threshold or with failed gates; `auto-merge off` does not count there.
- A merged request with no report counts as `Merged` (or `Merged after a person`).
- A score below its threshold shows in the warning tone with `below threshold` after it.
- **Score path**: when the request that counts has two reports or more and its first score differs from its last, the score shows as `Serenity <first> → <last>/100 (threshold <t>)`, with the last report's threshold. The features list keeps the last score only.

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

An issue was reworked when more than one pull or merge request closes it (any state), or it was reopened at least once.

## Kinds

Each collected issue has a kind, `feature` or `bug`, from the optional `bugs.label` of the project's `docs/agents/factory.yml`.

- A project has **no bug label** when `bugs` is missing or not a map, or `bugs.label` is missing, not a string, or empty after trimming. It also has none when `bugs.label` equals `issues.labels.spec` or a flow label of `issues.labels` (`ready`, `working`, `needs_spec`, `review`, `blocked`), compared after trimming and without letter case. None of these is a collection error: the other settings are read as before and no banner line is added.
- An issue is a **bug** when one of its current labels equals the project's bug label, after trimming and without letter case; otherwise it is a **feature**. A project with no bug label has only features, and an issue with both the spec label and the bug label is a bug.
- The kind depends only on the issue's current labels and the current setting, never on the label history, the title, the branch or the pull request: a relabel on the git host, or a `bugs.label` changed in `factory.yml`, shows at the next collection for every period, without reading the project again in full. A former kind is not kept.
- Every issue has exactly one kind, so the features and the bugs of a list add up to its issues. The kind changes no stage, score, round, token or other figure.
- The API gives it as `kind` on each issue row of `GET /api/features` (`null` for an issue not found or not collected), on `GET /api/features/<n>`, and on each row of `GET /api/stats/waiting`. Nothing on screen shows it yet.

## Where outcomes show

- The **session page** aside: the stage, serenity badge and review rounds of its work item.
- The **issue page**: the stage, the summary and the [timeline](features.md#issue-page) with every report and needs-spec episode as milestones.
- The **features list** and the **overview board**: stage, rounds and score per issue.
- **Stats**: every figure of the [Autonomy and Quality panels](stats.md).
