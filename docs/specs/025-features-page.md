# 025 · Features page

Status: ready
Depends on: 020, 022, 023
Checked: 2026-11-22

## User goal

A developer lists every issue their factory worked on in the period, grouped by where it stands, sees for each how its tokens split between roles, how many review rounds it took and its serenity score, and narrows the list to one stage group in one click.

## Acceptance criteria

- [ ] `/features` shows a `PageHeader` (spec 019) titled `Features`, with the summary `<n> issues · <m> merged, <k> without a person · <t> tokens per merged issue` (the last two parts left out with no merged issue) and `PeriodPills` on the right.
- [ ] Under it, a `StageStrip` (spec 017) with the four groups of spec 024, each with its number of issues and its tokens. Selecting a group shows only that group in the list and sets the URL parameter `stage` to `ready`, `working`, `in-review` or `merged`; selecting it again removes the parameter. Opening `/features?stage=<group>` selects it. Values match exactly: another spelling (`Merged`, `in_review`), an empty value or an unknown value means none; with the parameter repeated, the first one counts.
- [ ] A `DataTable` (spec 019) `Issues` with a `SortSelect` (spec 017) above it on the right, groups its rows under group header rows, in this order: `In review`, `Working`, `Ready`, `Merged`, then `Closed` (stage `Closed without merge`) and `Unknown` (issues not found or not collected); a group with no row is left out. Columns: `Issue` (`#<n> <title>` linked to the issue page, as spec 010), `Project` (`ProjectTag`, only with `All projects`), `Split by role` (a thin `SplitBar` 150 px wide of the row's `roles`, spec 022, colours from `roleColors`), `Sessions`, `Rounds`, `Serenity` (score in `--fd-success` at or above its threshold, `--fd-warning` and `below threshold` under it, `—` without report), `Tokens` (`TokenAmount`).
- [ ] The `SortSelect` options are `Last activity` (default, most recent first, by `lastAt` of spec 021), `Tokens`, `Sessions`, `Review rounds`, `Serenity`, `Issue number`; rows are sorted inside each group; the choice is kept in the URL as spec 010's sort, and the default leaves no parameter.
- [ ] After the groups, a row `No work item` (spec 010) with its sessions and tokens, then a bold `Total` row with all sessions and the period's tokens, whatever the stage filter; with a stage selected, `No work item` and `Total` are left out.
- [ ] The tiles of spec 010 are removed; the summary line replaces them.
- [ ] With no call in the period, `No activity in this period.` replaces the strip and table; loading and unreachable states as spec 024.
- [ ] At 360 px the strip stacks two by two and the table scrolls inside its box; nothing else scrolls horizontally. Figures refresh without a reload.

## Rules

- Groups and their stages are those of spec 024.
- `Total` equals the overview's total tokens for the same period and project (spec 013).
- Mockup: `docs/design/b4/features.html`; this spec wins where they differ.

## Expected proof

- Storybook stories of the features page: `All projects`, one project, a stage selected (with a `play` that selects and unselects it and checks the URL), each sort, a `Closed` and an `Unknown` group, no activity. They pass the axe check of `src/ui/stories.test.tsx`.
- Vitest tests of grouping, sorting inside groups and the `stage` parameter parsing.
- On the real app, with `pnpm demo`: screenshots at 360 px and 1280 px, with and without a stage selected, attached to the pull request.

## Out of scope

- Column-header sorting (replaced by the select).
- Selecting several stage groups at once.
- The issue page (spec 026).
