# 029 · Roles page

Status: ready
Depends on: 018, 021, 023
Checked: 2026-11-22

## User goal

A developer sees how the factory's tokens split between its roles and its models, which role uses the most per thread, and where the role definitions come from, in the new FactoryDeck look.

## Acceptance criteria

- [ ] `/roles` shows a `PageHeader` (spec 019) titled `Roles`, with today's source sentence of spec 006 and 011 as its summary line, and `PeriodPills`.
- [ ] Under it, a tall `SplitBar` (spec 018) of the period's tokens by role, with each share inside the segments wide enough, colours from `roleColors` (spec 014) in the order of the role configuration.
- [ ] A `DataTable` (spec 019) `By role`: `Role` (row header, `RoleTag` of spec 016), `Threads`, `API calls`, `Tokens per thread` (the row's tokens divided by its threads, compact format; `—` for a row with no thread), `Tokens` (`BarCell` of spec 018 in the role's colour); sorted by tokens descending; `unassigned` sorted like the others; a bold `Total` row with the threads, API calls and tokens of the period.
- [ ] A second `DataTable` `By model`, from the overview's `models` (spec 003, with `tokenCounts` of spec 021): `Model` (mono), `API calls`, `Tokens` (`BarCell` in `--fd-accent`); sorted by tokens descending. It replaces the overview's `By model` table, removed by spec 024.
- [ ] Today's empty, loading and unreachable texts stay, shown with `StatusLine`.
- [ ] The roles and models totals equal the overview total for the same period and project.
- [ ] From 1024 px wide, nothing scrolls horizontally; figures refresh without a reload.

## Rules

- The page reads `/api/roles` and `/api/overview` for the current period and project.
- Mockup: `docs/design/b4/roles.html` (it predates `By model`); this spec wins where they differ.

## Expected proof

- Storybook stories of the roles page (default roles, a custom configuration, `unassigned` present, one model only, no activity) pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots at 1024 px, 1280 px and 2560 px, attached to the pull request.

## Out of scope

- Editing roles from FactoryDeck.
- A role-by-model cross table.
