# 034 · Help from a person

Status: done
Depends on: 024, 026, 027
Checked: 2026-11-22

## User goal

A developer reading FactoryDeck can tell an issue the agents merged on their own from one they merged only after a person stepped in (answering a spec question, or completing the spec after a serenity report refused the merge), so the share of work merged without a person stays true.

## Acceptance criteria

- [x] The collection of spec 008 stores every serenity report (spec 009) of each pull or merge request, not only the latest: score, threshold, rounds (or none), whether every gate passed, and the comment's time, ordered by time. A comment that is not a report is still not stored.
- [x] The collection also stores, for each issue, the times at which the needs-spec label (`issues.labels.needs_spec` of `docs/agents/factory.yml`, compared as stage labels are in spec 009) was added to it and removed from it: from the issue's timeline events on GitHub, from its label events on GitLab, every one of them however many there are (read page by page). No other label event is stored.
- [x] A new stage `Merged after a person` sits between `Merged by a person` and `Closed without merge` in the order of stages. A merged issue whose stage would be `Merged` under spec 009 is `Merged after a person` when a person helped it (rules below); `Merged by a person` keeps its rule and wins over this one.
- [x] `StageBadge` (spec 016) shows `Merged after a person` with the success tone, like the two other merged stages.
- [x] On the overview (spec 024), the `Merged` column holds `Merged after a person` issues; their card shows the `SerenityBadge` (when there is a report) and an `after a person` badge, side by side, as `by a person` does.
- [x] `Merged issues` (spec 010) and the merged count of the overview header count `Merged after a person`; `Merged without a person` (spec 010) and `<m> of <n> merged without a person` (spec 024) count only `Merged`.
- [x] On `/features` (spec 025), `Merged after a person` issues are in the `Merged` group and in `?stage=merged`; on the issue page (spec 026), the heading is `How it got merged`, as for the other merged stages.
- [x] The session header outcome (spec 009, 027) and `IssueSummary` (spec 020) show the new stage with its `StageBadge`; their serenity score is still the one of the report that counts (spec 009).
- [x] A project collected before this spec is read again in full at its next collection, as spec 009 did when it added outcome settings, so its earlier pull requests and issues get their report and label history; its current data stays on screen until that collection ends.
- [x] The demo data (`pnpm demo`) has at least one issue `Merged after a person` through a refused report and one through a needs-spec episode.

## Rules

- **A person helped** a merged issue when, before the merge time of the merged request that counts under spec 009 (its `mergedAt`, or its update time when the git host gives none, as spec 009 orders merged requests), at least one of these happened:
  - a serenity report on any pull or merge request that closes the issue refused the merge for its score or its gates (score below its threshold, or gates not all passed);
  - the issue carried the needs-spec label at least once (it was added at a time before the merge). This counts every episode, whether the question came from the spec check before the build or from a worker during it.
- A merged request with no report counts as `Merged` (spec 009), or `Merged after a person` when the needs-spec rule above applies.
- `build.auto_merge` is not part of « a person helped »: when it is `false`, spec 009 already makes the merge `Merged by a person`.
- The needs-spec label is read from the configuration at each collection, like the other stage labels (spec 009); renaming it later leaves earlier episodes under the old name uncounted. This is accepted.
- The serenity score that sorts `/features`, feeds `SerenityBadge` and the aside stays the report that counts under spec 009 (the latest of the merged request): the score that decided the merge.
- Only label additions and removals of the needs-spec label are stored, with their times; no actor, no comment text.
- Data of a project deleted with spec 007 is deleted with it.

## Expected proof

- Vitest tests of the report history (several reports on one request kept in time order, a non-report comment ignored) and of the needs-spec episodes, with recorded synthetic CLI output for GitHub (timeline `LABELED_EVENT` and `UNLABELED_EVENT`) and GitLab (`resource_label_events`).
- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of the stage: refused report then allowed report → `Merged after a person`; refused report on an earlier closed request → `Merged after a person`; one needs-spec episode with a single allowed report → `Merged after a person`; latest report refused → `Merged by a person` even with a needs-spec episode; allowed reports only and no episode → `Merged`; a needs-spec label added after the merge → `Merged`.
- Vitest tests of the overview header counts, the `Merged without a person` tile and the overview card badges with the new stage.
- Storybook stories: `StageBadge` with all ten stages; `IssueCard` with the `after a person` badge; the overview page with a `Merged after a person` card. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: a screenshot of the overview with an `after a person` card and of its issue page, attached to the pull request.

## Out of scope

- Showing the history of scores or the needs-spec episodes on screen: spec 035.
- Telling who clicked merge on the git host (the agents use the person's own account).
- Changing the report format written by `build-feature`.
- Counting other kinds of human input (a comment on the pull request, a commit by a person on the branch).
