# 041 · Frictions page

Status: done
Depends on: 037, 040
Checked: 2026-11-22

## User goal

A developer preparing a retro opens a `Frictions` page and sees where their agents stumbled in the period: how often, whether it gets better week after week, which kinds of errors, which tools and commands fail, which commands an agent kept retrying, and which checks stopped an agent from finishing, so they know what to fix in their tools, permissions or instructions.

## Acceptance criteria

- [x] `/frictions` is a React Router route that survives a reload. The sidebar (spec 031) shows a link `Frictions` with a new icon `frictions` (a triangle with an exclamation mark, drawn like the other icons of `Icon.tsx`), right after `Stats` (spec 037); it carries the `project` parameter like the other links.
- [x] `/frictions` shows a `PageHeader` (spec 019) titled `Frictions`, with `PeriodPills` on the right and the summary `<n> frictions · <r> per 100 API calls` (`1 friction`; `<r>` with one decimal, `0.4`) for the period, project and kind, or `No friction · <c> API calls` with none. While it loads, the header is `pending` (AGENTS.md).
- [x] Under it, `FilterPills` (spec 017) named `Kind`: `All`, `Tool errors`, `Stop blocked`, `Compactions`, each with its count for the period and project. It reads and writes the URL parameter `kind` (`tool-error`, `stop-blocked`, `compaction`; `All` removes it). Values match exactly; another spelling, an empty or unknown value means `All`; with the parameter repeated, the first counts. The counts stay on screen with their last values while new data loads.
- [x] Then `Frictions per 100 API calls, by week`: a `TrendBars` (spec 036, `count` scale, 64 px high, `--fd-warning`) of the 12 weeks of spec 037, each week's value the frictions of the selected kind per 100 API calls of that week (one decimal), with n = the week's API calls (`API call` / `API calls`), tooltip value `2.4 · 12 frictions`.
- [x] With `All` or `Tool errors`, a `DataTable` (spec 019) `By category`: `Category`, `Errors`, `Share` (whole percent of the tool errors, `<1%` above 0), one row per category with at least one error, sorted by errors descending, ties in the order `Permission denied`, `Blocked by a hook`, `Tool misuse`, `Command failed`, `Other` (the categories `permission-denied`, `hook-blocked`, `tool-misuse`, `command-failed`, `other` of spec 040).
- [x] With `All` or `Tool errors`, a `DataTable` `By tool`: `Tool` (the name as stored, in `--fd-font-mono`), `Errors`, `Main category` (its most frequent category, ties in the order above), `Threads` (distinct threads with an error of that tool); sorted by errors descending, then tool name.
- [x] With `All` or `Tool errors`, a `DataTable` `Failed commands` over the tool errors of category `command-failed`: `Program` (mono; `—` for none), `Failures`, `Exit codes` (the distinct codes in ascending order, comma-separated, at most 5 then `, …`; `—` with none), `Distinct commands` (distinct command hashes); sorted by failures descending, then program.
- [x] With `All` or `Tool errors`, a `DataTable` `Repeated failures`: one row per thread and command hash with 3 or more `command-failed` errors in the period: `Program`, `Failures`, `Role` (`RoleTag`, spec 016, role of the thread, spec 006 and 032), `Issue` (`#<n>` linked to its issue page with the current period, or `—` without a work item), `Session` (the session title, or its id's first 8 characters when it has none, linked to its session page, spec 027), `Last` (local date and time of the latest failure, `22 Nov, 17:33`); sorted by failures descending, then latest first. With none: `No command failed 3 times in one thread.`
- [x] With `All` or `Stop blocked`, a `DataTable` `Stop blocked`: `Hook` (the stored command, mono, ellipsed past the column with the full text in a tooltip and as its accessible name), `Blocks`, `Sessions` (distinct), `Last` (date and time); sorted by blocks descending, then latest first.
- [x] With `All` or `Compactions`, a `DataTable` `Compactions`: rows `Auto` and `Manual` (a row at 0 is left out): `Compactions`, `Median tokens before` (compact like `formatTokens`, `306K`; `—` when none of them has the figure), `Threads` (distinct).
- [x] Each table shows its first 10 rows and a `ShowMore` (spec 017) for the rest; a table with no row for the period and kind is left out, except `Repeated failures` with its text above.
- [x] With no API call in the period, `No activity in this period.` replaces the filter, trend and tables; with calls but no friction of the selected kind, `No friction in this period.` replaces the tables (the filter and the trend stay). Loading and unreachable states as spec 024, with `StatusLine`.
- [x] `GET /api/frictions?period=<period>&tz=<time zone>&project=<root>&kind=<kind>` returns the header figures, the counts per kind, the 12 weeks (start date, frictions of the kind, API calls) and every row of the tables above for the kind. Parameters are read and refused like `/api/stats/autonomy` (spec 037); `kind` follows the URL rule above.
- [x] Figures refresh with each re-ingestion (spec 003), without a reload; while the period, project or kind changes, the last data stays on screen (`useRefreshing` with the page as `scope`). From 1024 px wide, nothing scrolls horizontally; tables scroll inside their box.

## Rules

- A friction belongs to the period by its time, in the browser's time zone (spec 003); weeks as spec 037.
- **API calls** of the period or a week are those of the overview (spec 003) for the same project, so the rate's denominator matches the overview total.
- A friction's **thread** is its sub-agent, or the main thread; its role and work item are those its calls get (specs 006, 010 and 032): for a main thread split by markers, the marker in force at the friction's time.
- Frictions of every coding agent count together (spec 040); kinds and categories are agent-neutral.
- With `All projects`, every factory project counts together; a friction outside any work item still counts (as `—` in `Issue`).
- Ties not stated above keep the order of the latest friction first.

## Expected proof

- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of `/api/frictions` over synthetic frictions and calls: each kind filter, the rate and its weeks, category and tool ordering with ties, exit codes past 5, a repeated failure at 2 and at 3 errors, in a sub-agent and in a main thread split by a marker, a hook with a long command, compactions with and without tokens, the period cut-off, two projects.
- Vitest tests of the `kind` parameter parsing.
- Storybook stories of the frictions page: `All` with every table, each kind selected (a `play` that selects and unselects one and checks the URL), no repeated failure, no friction, no activity, loading, unreachable, at 1024 px. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of `/frictions` at 1024 px, 1280 px and 2560 px, light and dark, attached to the pull request.

## Out of scope

- Frictions by role, issues with the most frictions, context peaks, and the friction counts and filters on the session and issue pages: spec 042.
- A filter by coding agent, by tool or by program.
- The text of errors or commands (not stored, spec 040).
- Marking a friction as fixed or ignored.
