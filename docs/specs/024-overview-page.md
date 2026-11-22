# 024 · Overview page

Status: done
Depends on: 025
Checked: 2026-11-22

## User goal

A developer opening FactoryDeck sees first what their factory delivered in the period and what it used in tokens: how many issues merged, where each issue stands on a board by stage, which roles used the tokens and how they spread over the days.

## Acceptance criteria

- [x] `/` shows a `PageHeader` (spec 019, `headline` variant) titled `<n> issues merged for <tokens> tokens` (`1 issue merged for …`; with none, `No issue merged · <tokens> tokens`), where `<n>` is the `Merged issues` figure of spec 010 and `<tokens>` a `TokenAmount` (spec 015) of the period's total, tooltip below. The summary line reads `<t> tokens per merged issue · <m> of <n> merged without a person · <s> sessions`, leaving out the first two parts with no merged issue. `PeriodPills` (spec 017) sits on the right and keeps the `period` parameter.
- [x] Under it, a board of four `StageColumn`s (spec 020), side by side in equal columns at least 250 px wide (wrapping below), for the issues of `/features` (spec 010) in the same period and project, grouped by stage:
  - `Ready`: stages `Open`, `Needs spec`, `Ready`, `Blocked`;
  - `Working`: `Working`;
  - `In review`: `In review`;
  - `Merged`: `Merged`, `Merged by a person`.
    Issues `Closed without merge`, not found or not collected are not on the board.
- [x] Each column's count is the number of its issues; its `TokenAmount` is the sum of their tokens. It shows the 5 issues with the latest activity (`lastAt` of spec 021), most recent first, as `IssueCard`s, and `+ <k> more` linking to `/features?stage=<group>` (spec 025) with the current `project` and `period` when it has more.
- [x] Each card shows its project (`ProjectTag`, colour from `projectColors` in the order of the project select) only with `All projects`, and one badge: in `Ready`, the issue's `StageBadge` when its stage is not `Ready`; in `In review`, a `RoundsBadge` in review when its serenity report has rounds; in `Merged`, its `SerenityBadge`, and for `Merged by a person` both its `SerenityBadge` and a `by a person` badge, side by side. A card links to its issue page (spec 010) with the current `period`.
- [x] Under the board, a `Panel` `Where the tokens went`, with a link `Roles` to `/roles` (keeping `project` and `period`): a medium `SplitBar` of the period's tokens by role (`GET /api/roles`, colours from `roleColors`) and its `SplitLegend` with a `TokenAmount` per role; next to it (under it below 680 px), `Tokens per day` (`Tokens per hour` for `Today`): `DayBars` (spec 018) of the overview series' tokens, 56 px high, in `--fd-ink`.
- [x] The tiles, the cost chart and the `By project` and `By model` tables of spec 003 are removed from the overview; `By model` moves to `/roles` (spec 029).
- [x] With no call in the period, the page shows the header with `No issue merged · 0 tokens` and `No activity in this period.` instead of the board and panel; while loading, `Loading…`; when the API is unreachable, today's unreachable message (`StatusLine`, spec 019). Each block loads and fails on its own: the header (overview and features figures; titled `Overview` until they arrive), the board (features) and the `Where the tokens went` panel (roles and the overview series) each show `Loading…` or the unreachable message by themselves, so one slow or failing API does not hide the others.
- [x] The overview, `/features` and `/roles` totals stay equal for the same period and project (spec 013).
- [x] Figures refresh with each re-ingestion and collection, without a reload (specs 003 and 008). From 1024 px wide, nothing scrolls horizontally.

## Rules

- The page reads `/api/overview`, `/api/features` and `/api/roles` for the current period and project.
- Ties in last activity are broken by issue number, highest first.
- A column's `+ <k> more` counts the issues it does not show.
- Mockup: `docs/design/b4/overview.html`; when it differs from this spec, this spec wins. FactoryDeck targets computers: no layout is required below 1024 px.

## Expected proof

- Storybook stories of the overview page: `All projects` with full columns and `+ n more`, one project selected (cards without project), no merged issue, no activity, loading, unreachable, one API unreachable while the other blocks still render, at 1024 px. They pass the axe check of `src/ui/stories.test.tsx`.
- Vitest tests of the grouping of stages into columns, the card limit and ordering, and the badge picked for each stage.
- On the real app, with `pnpm demo`: screenshots at 1024 px, 1280 px and 2560 px, with `All projects` and with one project, attached to the pull request.

## Out of scope

- Dragging cards or changing an issue's stage.
- A `By project` breakdown anywhere (dropped by the redesign).
- The features list itself (spec 025).
