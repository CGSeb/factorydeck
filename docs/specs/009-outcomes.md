# 009 · Outcomes

Status: done
Depends on: 007, 008
Checked: 2026-11-21

## User goal

A developer opening a session sees how its issue ended up in the factory: where it stands in the workflow, whether it merged on its own or needed a person, its serenity score, how many review rounds it took and whether it had to be reworked.

## Acceptance criteria

- [x] The collection of spec 008 also reads, for each pull or merge request it collects, its comments, and for each issue, whether it was reopened. Of the comments it stores only what Rules call a serenity report; no other comment text is stored.
- [x] Each collected issue has a stage, one of `Merged`, `Merged by a person`, `Closed without merge`, `Blocked`, `Needs spec`, `In review`, `Working`, `Ready`, `Open`, set by the rules below.
- [x] Under the issue of spec 008, the session page header shows `Outcome`: the stage as a coloured label with its text, then `Serenity <score>/100 (threshold <threshold>)`, then `<r> review round` or `<r> review rounds`, then `Reworked` when the issue was reworked. Score and rounds show `—` when no serenity report was found; `Reworked` is simply absent when it does not apply.
- [x] A score below its threshold is shown with the warning colour of the theme and the text `below threshold` after it, so it does not rely on colour alone.
- [x] A work item `(not found)` or not collected yet (spec 008) shows no `Outcome` line.
- [x] Stages, scores and rounds refresh with each collection of spec 008 (automatic or `Refresh`), without a reload.

## Rules

- **Labels** come from `issues.labels` of the project's `docs/agents/factory.yml` (`ready`, `working`, `needs_spec`, `review`, `blocked`), read at each collection like spec 008. A missing key is a collection error of that project, reported as in spec 008.
- **Stage**, the first that applies:
  1. A pull or merge request that closes the issue (spec 008) is merged: `Merged by a person` when that request's serenity report refused the merge (see below), else `Merged`.
  2. The issue is closed: `Closed without merge`.
  3. The issue carries the label, in this order: `blocked` → `Blocked`, `needs_spec` → `Needs spec`, `review` → `In review`, `working` → `Working`, `ready` → `Ready`.
  4. Otherwise `Open`.
- **Serenity report**: a comment on a pull or merge request whose body has a line `## Serenity: <score>/100 (threshold <threshold>)`, both whole numbers. From the same comment, a line starting `Review: <r> round` gives the review rounds, and a line starting `Gates:` tells whether every gate passed (`Gates: all passed.`). FactoryDeck stores the score, threshold, rounds (or none), whether every gate passed, and the comment's time. The format is the one `build-feature` of factorydeck-skills writes; it is not configurable.
- **Which report counts** for an issue: the latest serenity report (by comment time) of the merged request that closes it; when none is merged, of the most recently updated open request that closes it; when there is none, no report.
- **Merge refused**: the report's score is below its threshold, or its gates did not all pass, or the project's `build.auto_merge` (in `docs/agents/factory.yml`) is `false`. A merged request whose report refused the merge was merged by a person. A merged request with no report counts as `Merged`.
- `build.auto_merge` is read at each collection, so turning it off later makes every earlier merge with a report count as `Merged by a person`; this is accepted, since the file holds no history.
- On GitLab, comments are the merge request's notes written by people or agents; system notes (label changes, pushes) are ignored. Reopening is read from the issue's state events on GitLab and its timeline events on GitHub.
- **Reworked**: more than one pull or merge request closes the issue (any state), or the issue was reopened at least once.
- Stage colours: `Merged` and `Merged by a person` success, `Closed without merge` and `Blocked` danger, `Needs spec` warning, the others neutral; text always says the stage.
- Data of a project deleted with spec 007 is deleted with it.

## Expected proof

- Vitest tests of the serenity report parser on synthetic comments: with and without rounds, gates passed and failed, two reports on one request (the latest wins), a comment that only quotes the heading inside a code block or mid-line (not a report).
- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of the stage for each rule and its order, of `Merged by a person` for each refusal reason, of `Reworked` (two requests, a reopened issue), with recorded synthetic CLI output for GitHub and GitLab.
- Storybook stories of the session header outcome (merged, merged by a person, below threshold, in review without report, reworked); they pass the axe check of `src/ui/stories.test.tsx`.
- On the real app: `pnpm collect`, then `pnpm start` and open a session of a merged spec of this repository; its outcome line shows the score posted on its pull request. A screenshot is attached to the pull request.

## Out of scope

- Aggregates (merge rate, cost per merged pull request, average score): spec 010.
- Configurable outcome rules or other report formats.
- Storing comment text other than the parsed serenity report.
- An outcome column in the session list.
