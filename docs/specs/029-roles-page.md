# 029 · Roles page

Status: done
Depends on: 018, 021, 023
Checked: 2026-11-22

## User goal

A developer sees how the factory's tokens split between its roles and its models, which role uses the most per thread, and where the role definitions come from, in the new FactoryDeck look.

## Acceptance criteria

- [x] `/roles` shows a `PageHeader` (spec 019) titled `Roles`, with today's source sentence of spec 006 and 011 as its summary line, and `PeriodPills`.
- [x] Under the `By role` heading, above its table, a tall `SplitBar` (spec 018) of the period's tokens by role, with each share inside the segments wide enough, colours from `roleColors` (spec 014) in the order of the role configuration.
- [x] A `DataTable` (spec 019) `By role`: `Role` (row header, `RoleTag` of spec 016), `Threads`, `API calls`, `Tokens per thread` (the row's tokens divided by its threads, compact format; `—` for a row with no thread); sorted by tokens descending; `unassigned` sorted like the others; a bold `Total` row with the threads and API calls of the period. The split of tokens is read from the bar above, so the table has no `Tokens` column.
- [x] Under the `By model` heading, above its table, a tall `SplitBar` `Tokens by model` of the period's tokens by model, in the same style as the roles bar, coloured with the category colours (spec 014) in the order of the table, most tokens first; a model with no id is labelled `—`.
- [x] A second `DataTable` `By model`, from the overview's `models` (spec 003, with `tokenCounts` of spec 021): `Model` (mono, with a dot in the model's bar colour), `API calls`; sorted by tokens descending, with no `Tokens` column. It replaces the overview's `By model` table, removed by spec 024.
- [x] Today's empty, loading and unreachable texts stay, shown with `StatusLine`.
- [x] The roles and models totals equal the overview total for the same period and project.
- [x] From 1024 px wide, nothing scrolls horizontally; figures refresh without a reload.

## Rules

- The page reads `/api/roles` and `/api/overview` for the current period and project.
- Mockup: `docs/design/b4/roles.html` (it predates `By model`); this spec wins where they differ.

## Expected proof

- Storybook stories of the roles page (default roles, a custom configuration, `unassigned` present, one model only, no activity) pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots at 1024 px, 1280 px and 2560 px, attached to the pull request.

## Out of scope

- Editing roles from FactoryDeck.
- A role-by-model cross table.
