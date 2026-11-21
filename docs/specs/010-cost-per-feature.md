# 010 · Cost per feature

Status: ready
Depends on: 003, 006, 008, 009
Checked: 2026-11-21

## User goal

A developer sees what each issue cost their agent factory, split by role, next to how it ended up (stage, serenity score, review rounds), and what a merged issue costs on average, so they can tell which features or workflow steps are expensive.

## Acceptance criteria

- [ ] The navigation bar has a `Features` entry, after `Overview`, at `/features`; `/features` and `/features/<issue number>?project=<project root>` (the `project` parameter of spec 004's filter, URL-encoded) are React Router routes that survive a reload.
- [ ] `/features` shows four tiles for the period and project: `Cost` (all calls, as the overview's `Cost` tile), `Merged issues` (issues at stage `Merged` or `Merged by a person` with at least one call in the period), `Cost per merged issue`, and `Merged without a person` (share of merged issues at stage `Merged`, as a whole percentage such as `75%`, `—` with no merged issue).
- [ ] A table lists one row per issue with at least one call in the period: `#<n>` and title (spec 008), project, stage (spec 009, coloured label with its text), serenity score, review rounds, sessions, tokens, orchestration cost, cost; sorted by cost descending. A last row `No work item` holds every call no issue receives; it is always last, whatever the sort.
- [ ] The column totals (tokens, cost) equal the overview totals of spec 003 for the same period and project.
- [ ] Column headers sort the table (cost, tokens, sessions, score, rounds, issue number), each ascending then descending on a second click; the sort is kept in the URL.
- [ ] The period selector of spec 003 and the project filter of spec 004 apply and are kept in the URL; with `All projects`, the project column shows, else it is hidden.
- [ ] An issue whose number was not found in the collected data (spec 008) shows `#<n> (not found)`, stage `—`; an issue of a project never collected shows `#<n>` and `—`.
- [ ] Clicking a row opens `/features/<n>?project=<project root>` with: the issue header (number, title linked to the git host, state, labels, outcome line of spec 009, closing requests of spec 008), a table `By role` (role of spec 006, threads, API calls, tokens, cost, sorted by cost descending, with a last row `Orchestration` for the share of spec Rules), and a table `Sessions` (each session that worked on the issue, with its title, state, last activity, and the issue's tokens and cost in it, linking to the session page of spec 004). The period and project of the list apply.
- [ ] An unknown issue page shows `Issue not found.` with a link back to `/features`.
- [ ] With no call in the period, `/features` shows `No activity in this period.` instead of the tiles and table.
- [ ] Figures refresh with each re-ingestion (spec 003) and collection (spec 008), without a reload.
- [ ] The pages work from 1280 px wide down to 768 px, like spec 003.

## Rules

- **Issue of a call**: the work item of its thread (spec 006), in its session's project; a thread with no work item gives its calls to no issue, except for the orchestration share below.
- **Orchestration share**: in each session, the calls of the main thread that has no work item are shared among the issues of that session's sub-agents, in proportion to those sub-agents' tokens on each issue in the same period (all four kinds). Both tokens and cost of those calls are shared with the same weights. When the session's sub-agents have no issue in the period, the main thread's calls stay in `No work item`. A main thread that has a work item keeps its calls on it (no share).
- An issue's `Cost` and `Tokens` include its orchestration share; `Orchestration cost` shows that share alone. Shared token counts are rounded to whole numbers for display only; totals are computed before rounding.
- **Sessions** of an issue: the sessions with at least one call on the issue in the period, its share included.
- **Cost per merged issue**: the sum of the cost of the merged issues in the period (orchestration included) divided by their number; `—` with none. Calls with unknown prices are excluded like the `Cost` tile of spec 003, with the same note.
- Sorting puts `—` values last in both directions; ties keep the cost-descending order.
- Stage, score and rounds come from spec 009 and are the issue's current values, whatever the period.
- An issue is identified by project and number: the same number in two projects is two rows.
- Cost, tokens, `—`, periods and relative times follow specs 003 and 004.

## Expected proof

- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), over synthetic sessions: calls per issue from sub-agents and a main thread with a work item, the orchestration share across two issues (weights, a session whose sub-agents have no issue), period cut-offs, two projects with the same issue number, `No work item`, totals equal to the overview, cost per merged issue and merged without a person.
- Storybook stories of `/features` (with issues, no activity, `All projects` and one project) and of an issue page (found, not found), with `play` functions that sort by a column and change the period; they pass the axe check of `src/ui/stories.test.tsx`.
- On the real app: `pnpm collect`, `pnpm start`, open `/features?period=all` and one issue page; a screenshot of both is attached to the pull request.

## Out of scope

- Exports, charts over time per issue, and budgets or alerts.
- Distributing `No work item` calls other than the orchestration share.
- Frictions (tool errors, refusals, failed checks): a later spec.
- Editing issues or labels from FactoryDeck.
