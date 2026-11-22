# 028 · Skills pages

Status: ready
Depends on: 018, 021, 023
Checked: 2026-11-22

## User goal

A developer sees which skills their agents launch, how often and with how many tokens, and opens one to see its launches per day and the sessions that used it, in the new FactoryDeck look.

## Acceptance criteria

- [ ] `/skills` shows a `PageHeader` (spec 019) titled `Skills` with the summary `<k> skills launched <n> times · <t> tokens in skill sessions` (`1 skill launched 1 time` in the singular; the tokens of every row but `No skill`) and `PeriodPills`.
- [ ] A `DataTable` (spec 019) `Skills` with the columns `Skill` (row header, `--fd-font-mono`, 600, linked to the skill page), `Launches`, `Sessions`, `Tokens per launch` (the row's tokens divided by its launches, compact format), `Tokens` (`BarCell` of spec 018 in `--fd-accent`, against the largest row). Sorted by tokens descending. The `No skill` row of spec 005 is last, in `--fd-muted` italics, not linked, with `—` for launches and tokens per launch, and a bar in `--fd-stage-ready`.
- [ ] `/skills/<name>` shows a back link `← Skills` (keeping `project` and `period`), the skill name as `h1` in `--fd-font-mono` 30 px, and `PeriodPills`; then three figures side by side on `--fd-page` (`Launches`, `Tokens` as a `TokenAmount` with its tooltip, `Per launch`), next to a panel `Launches per day` (`Launches per hour` for `Today`) with `DayBars` (spec 018) of the skill's launches, 80 px high, each column labelled with its count.
- [ ] Under them, `Sessions that launched it`: a `DataTable` with `Session` (row header, linked to the session page), `Project` (`ProjectTag`, only with `All projects`), `Launches`, `Tokens` (`TokenAmount`), sorted by tokens descending.
- [ ] Today's empty and error texts stay (`No session launched this skill in this period.`, not found, loading, unreachable), shown with `StatusLine`.
- [ ] From 1024 px wide, nothing scrolls horizontally; figures refresh without a reload.

## Rules

- The skills list has no activity date, so it sorts by tokens (decision of the redesign: by activity when a list has one, else by tokens).
- Mockups: `docs/design/b4/skills.html` and `docs/design/b4/skill.html`; this spec wins where they differ (the mockup's `Last activity` column is not part of it).

## Expected proof

- Storybook stories of both pages (several skills with `No skill`, one project, no activity; a skill with 7 days of launches, `Today` by hour, no launch) pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of both pages at 1024 px, 1280 px and 2560 px, attached to the pull request.

## Out of scope

- New skill data (activity dates, success rates).
