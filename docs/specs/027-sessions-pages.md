# 027 · Sessions pages

Status: ready
Depends on: 015, 021, 023
Checked: 2026-11-22

## User goal

A developer finds a session by its state, project, branch or issue, and opens it to see its sub-agents, the skills it launched and what it used in tokens, split by kind, in the new FactoryDeck look.

## Acceptance criteria

- [ ] `/sessions` shows a `PageHeader` (spec 019) titled `Sessions` with the summary `<n> sessions` (`1 session`) for the period, project and state (the `total` of spec 004), and `PeriodPills` on the right.
- [ ] Under it, `FilterPills` (spec 017) named `State`: `All`, `Working`, `Waiting for you`, `Inactive`, each with its count (spec 004) and the state dot of spec 016; it reads and writes the `state` parameter of spec 004 (`All` removes it). It replaces today's state filter.
- [ ] A `DataTable` (spec 019) `Sessions` with the columns `State` (`SessionStateBadge`), `Title` (row header, link to the session page with the current `project`), `Project` (`ProjectTag`, only with `All projects`), `Branch` (`--fd-font-mono`, 12 px), `Work item` (`#<n>` linked to the issue page, `—` without), `Last activity`, `Duration`, `Tokens` (`TokenAmount` of the row, spec 021). Sorted by last activity, most recent first, as today; paging stays that of spec 004 with `ShowMore` (spec 017).
- [ ] `/sessions/<id>` uses a `SplitPage`. The main column: back link `← Sessions` (keeping `project` and `period`), the session title as `h1`, then a line with its `SessionStateBadge`, `ProjectTag`, branch (mono) and `Work item #<n>` linked to the issue page; then `Sub-agents <k>` as a `DataTable` (`Sub-agent` description, `Role` with `RoleTag`, `Work item`, `Started`, `Duration`, `Tokens`), sorted by start; then `Skills` as a `DataTable` (`Skill` in mono linked to the skill page, `Launches`, `Tokens`). A session with no sub-agent shows `No sub-agents.`; with no skill, the `Skills` table is left out.
- [ ] The aside: `Tokens, sub-agents included` and the session's total as a `figure` `TokenAmount` (tooltip below); a medium `SplitBar` and `SplitLegend` (spec 018) of the four token kinds, `Cache read`, `Cache write`, `Input`, `Output`, with the `--fd-kind-*` colours; when the session has a work item, the outcome of spec 009 (`StageBadge`, `SerenityBadge`, `RoundsBadge`); then `Working directory` (mono, wrapping anywhere), `First activity` and `Last activity`.
- [ ] Unknown session: `Session not found.` with the back link; loading and unreachable states as spec 024.
- [ ] At 360 px, both pages show no horizontal page scroll (tables scroll in their box, the aside goes under). Figures and states refresh without a reload.

## Rules

- Filters, paging and URL parameters keep the behaviour of specs 004 and 013.
- Mockups: `docs/design/b4/sessions.html` and `docs/design/b4/session.html`; this spec wins where they differ (the mockup's `Models` line and API call count are not part of it).

## Expected proof

- Storybook stories of both pages: list with all states, one state selected (a `play` checking the URL), one project, more to show; session with sub-agents and skills, without sub-agent, with an outcome, not found, at 360 px. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of both pages at 360 px and 1280 px, attached to the pull request.

## Out of scope

- New session data (models, API calls, transcript).
- Sorting the session list by another column.
