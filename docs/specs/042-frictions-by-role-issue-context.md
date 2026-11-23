# 042 · Frictions by role, issue and context

Status: done
Depends on: 041
Checked: 2026-11-22

## User goal

A developer sees which roles and which issues stumble the most, how full their agents' contexts get before they are compacted, and, from a session or an issue they are looking at, opens the frictions of that session or issue alone.

## Acceptance criteria

- [x] On `/frictions` (spec 041), after its tables, with `All` or any kind selected, a `DataTable` `By role`: `Role` (`RoleTag`, spec 016), `Threads` (threads of that role with at least one API call in the period, as `/roles` counts them, spec 029), `Frictions` (of the selected kind), `Per thread` (frictions divided by threads, one decimal), `Main kind` (`Tool errors`, `Stop blocked` or `Compactions`, the most frequent, ties in that order; `—` with no friction). One row per role with at least one thread, `unassigned` included; sorted by `Per thread` descending, then frictions, then role name.
- [x] Then a `DataTable` `Issues with the most frictions`: `Issue` (`#<n> <title>` linked to its issue page with the current period, `#<n> (not found)` as spec 010), `Project` (`ProjectTag`, only with `All projects`), `Stage` (`StageBadge`, spec 016; `—` when not found or not collected), `Frictions` (of the selected kind), `Repeated failures` (rows of spec 041's `Repeated failures` on that issue), `Compactions`. One row per issue with at least one friction of the kind; sorted by frictions descending, then issue number descending; first 10 rows and `ShowMore` (spec 017). With none, the table is left out.
- [x] With `All` or `Compactions`, a `Panel` `Context peaks`: a `StatFigure` (spec 036) `Median context peak`, the median of the context peaks (rules) of the threads with at least one call in the period, compact like `formatTokens` (`142K`), n = those threads (`thread` / `threads`), lower is better, with the change line of spec 037 (`amount`); beside it the text `<k> of <n> threads compacted` (`1 of 1 thread compacted`); under them a `RangeStrip` (spec 036) of those threads, one dot per thread valued by its peak, labelled with the thread's description, or its session title for a main thread or a blank description (as spec 026), linking to its session page (spec 027).
- [x] `/frictions` reads two more URL parameters: `session=<session id>`, and `issue=<n>` with `project=<root>`. With one of them, a chip under the header reads `Session: <title>` (or the id's first 8 characters without a title) or `Issue: #<n> <title>`, followed by a remove button (`×`, accessible name `Remove filter`) that drops the parameter and keeps the others; every figure, count, trend and table of the page then counts only the frictions, calls and threads of that session or issue, and `Issues with the most frictions` is left out under an issue filter.
- [x] `session` matches a session id exactly; `issue` is a whole number above 0 and needs `project`, else it is ignored. With both, `session` wins and `issue` is ignored. A session or issue FactoryDeck does not know shows its chip with the raw value, and the page shows `No activity in this period.`
- [x] The session page aside (spec 027) gains a row `Frictions` with the session's number of frictions over its whole life, linking to `/frictions?session=<id>&period=all` (with the current `project`); with 0, the row reads `None` and is not a link.
- [x] The issue page summary (`IssueSummary`, spec 020) gains a row `Frictions` with the issue's number of frictions in the page's period, linking to `/frictions?project=<root>&issue=<n>&period=<period>`; with 0, `None` without a link.
- [x] `GET /api/frictions` (spec 041) reads `session` and `issue` as above and returns the `By role` rows, the issue rows, the threads' context peaks with their labels and session ids, the compacted threads count, and the median peak of the previous period (left out for `all`). The session detail API (spec 004) and the issue API (spec 022) each return the friction count their row shows.
- [x] Loading, unreachable, empty states and refresh as spec 041. From 1024 px wide, nothing scrolls horizontally.

## Rules

- A friction's **thread**, role and work item are those of spec 041. An issue's frictions are those of its threads; a main thread split by markers (spec 032) gives each friction to the marker in force at its time. Orchestration shares (spec 010) carry no friction.
- **Context peak** of a thread: the largest sum of input, cache write and cache read tokens of one of its API calls in the period (output tokens left out). A thread **compacted** has at least one `compaction` friction in the period.
- Under a `session` filter, the threads are that session's main thread and sub-agents; under an `issue` filter, the threads whose work item is that issue, each counting only its frictions and calls on that issue.
- The session page row counts every friction of the session, whatever the period, because the session page has no period.
- The weeks of the trend under a filter count only that session's or issue's frictions and calls.

## Expected proof

- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), over synthetic frictions, calls and threads: `By role` with a role without friction and `unassigned`, ties; issue rows with not found and not collected issues; context peaks (output tokens excluded, a call outside the period ignored, compacted count); each filter, both filters at once, an unknown session, `issue` without `project`; the counts of the session and issue APIs.
- Vitest tests of the `session` and `issue` parameter parsing.
- Storybook stories: the frictions page with the three new blocks, with a session filter, with an issue filter (a `play` that removes the chip and checks the URL), an unknown session; the session aside and `IssueSummary` with frictions and with `None`. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of `/frictions` with the new blocks and with a session filter, at 1024 px and 1280 px, and of a session page and an issue page with their `Frictions` row, attached to the pull request.

## Out of scope

- Context as a share of a model's context window (FactoryDeck does not know window sizes).
- Filtering on a role, a tool, a program or a coding agent.
- Frictions on the sessions list, the features list or the overview.
