# 026 · Issue page

Status: done
Depends on: 020, 022, 023
Checked: 2026-11-22

## User goal

A developer opening an issue sees how it got where it is: the role threads that built, reviewed, reworked and shipped it, in the order they ran, with the tokens each used, next to a summary of its total, its split by role and its outcome.

## Acceptance criteria

- [x] `/features/<n>?project=<root>` uses a `SplitPage` (spec 019). The main column starts with a back link `← <project name> features` to `/features` with the issue's `project` and the current `period` (spec 010), then a `PageHeader` titled `#<n> <title>` (number in `--fd-muted`, weight 500; the title links to the issue on the git host, in the heading's ink colour, followed by a small `↗` icon hidden from screen readers, and underlined on hover and focus), with `PeriodPills` on the right, and under it a line with the `StageBadge` (spec 016) and `<first> → <last> · <s> sessions` (dates of the issue's first and last thread call in the period, `D Mon` format such as `18 Nov`, one date when equal).
- [x] Then `How it got merged` (`Where it stands` when the stage is not `Merged` or `Merged by a person`): an `IssueTimeline` (spec 020) whose steps come from the issue's `threads` (spec 022): threads in their order, consecutive threads of the same role forming one step. A step's title is the role, followed by ` ×<k>` when it holds `k` ≥ 2 threads (`reviewer ×2`); its detail line is `<role> · <k> thread(s)` then the date or date range; its tokens are the sum of its threads. Each thread row shows the thread's description, or the session title for a main thread or a description that is empty or only spaces, links to its session page (spec 004), and shows its `firstAt` date and its `TokenAmount`.
- [x] When the issue has an orchestration share (spec 010), a last step `Orchestration`, detail `Share of the orchestrating sessions`, with the share's tokens and no thread rows. Step markers use `roleColors` (spec 014).
- [x] An issue with no thread in the period shows `No activity in this period.` in place of the timeline.
- [x] The aside is an `IssueSummary` (spec 020) with the issue's tokens, orchestration share, split by role (`roles` of spec 022), serenity, review rounds, pull request, checks, labels and reworked (specs 008 and 009).
- [x] The tables `By role` and `Sessions` of spec 010 are removed; their data is in the summary and the timeline.
- [x] An unknown issue shows `Issue not found.` and the back link (`← Features`), as today; loading and unreachable states as spec 024.
- [x] From 1024 px wide, nothing scrolls horizontally. Figures refresh without a reload.

## Rules

- Steps group only consecutive threads: builder, reviewer, builder makes three steps.
- The timeline shows every step and every thread of the period, with no limit: an issue's threads are bounded by the work done on it.
- The issue's tokens equal its row on `/features` for the same period and project.
- Mockup: `docs/design/b4/issue.html`; this spec wins where they differ.

## Expected proof

- Vitest tests of the step grouping (consecutive roles, a single thread, orchestration only, no thread) and of the date range text.
- Storybook stories of the issue page: merged by a person with five steps, in review, orchestration only, no activity, not found, at 1024 px. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of a merged demo issue at 1024 px, 1280 px and 2560 px, attached to the pull request.

## Out of scope

- Review comments or the content of each round.
- Editing the issue or its labels from FactoryDeck.
