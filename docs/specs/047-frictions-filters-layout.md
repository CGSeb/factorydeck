# 047 · Frictions by role, period trend and one column

Status: ready
Depends on: 042, 044
Checked: 2026-11-23

## User goal

A developer hunting for problems on the `Frictions` page narrows it to one role (the builders, the reviewers…), sees the trend cut by hour, day or week like the rest of the page, reads every table in one full-width column without gaps between blocks of different heights, and no longer sees compactions counted as frictions.

## Acceptance criteria

- [ ] **Layout**: every block of `/frictions` takes the full width of the content area, one under the other, in this order: header (spec 041), `Kind` filter, `Role` filter, filter chip (spec 042), trend, `By category`, `By tool`, `Failed commands`, `Repeated failures`, `Stop blocked`, `By role`, `Issues with the most frictions`, `Context peaks`. No two blocks share a row at any width. A block left out by the kind or the filters leaves no gap.
- [ ] **Compactions are not frictions any more**: the `Compactions` pill of `Kind`, the `Compactions` table (spec 041) and the `Compactions` column of `Issues with the most frictions` (spec 042) are gone; `kind=compaction` in the URL means `All`, as any unknown value (spec 041). `Main kind` of `By role` takes `Tool errors` or `Stop blocked`. The header, the kind counts, the trend, every table, and the `Frictions` rows of the session page and the issue page (spec 042) count tool errors and stop blocks only.
- [ ] `Context peaks` (spec 042) shows with `All` and with no other kind, and still reads `<k> of <n> threads compacted` from the stored compactions.
- [ ] **Role filter**: under `Kind`, `FilterPills` (spec 017) named `Role`: `All`, then one pill per role with at least one thread that has an API call in the period under the project, session and issue filters, labelled with the role name, each with its frictions of the selected kind; sorted by frictions descending, then role name, `unassigned` last. It reads and writes the URL parameter `role` (`All` removes it). Values match a role name exactly; with the parameter repeated, the first counts; an empty value means `All`. A role in the URL with no thread in the period keeps its pill, at 0 and selected, and the page shows `No activity in this period.` (spec 041). The pills stay on screen with their last counts while new data loads.
- [ ] With a role selected, every figure of the page counts only the threads of that role, their API calls and their frictions: the header, the kind counts, the trend's rate (its API calls too), every table and `Context peaks`. `By role` is left out. The role combines with `kind`, `session` and `issue` (spec 042): all of them apply.
- [ ] **Trend**: `Frictions per 100 API calls, by hour` (`by day`, `by week`, `by month`, `by year`) follows the cut of spec 044 for the period, with its labels, its small-sample bars (`n` = the bucket's API calls) and its tooltip value `2.4 · 12 frictions`. Under `All time`, the first bucket holds the earliest API call of the page's selection (project, session, issue, role) instead of the earliest merged issue.
- [ ] `GET /api/frictions` (specs 041 and 042) reads `role` as above, returns the role pills with their counts, and replaces `weeks` with `unit` and `buckets` as spec 044 does. It no longer returns compaction rows or counts, except the compacted thread count of `Context peaks`.
- [ ] From 1024 px wide, nothing scrolls horizontally; tables scroll inside their box (spec 041).

## Rules

- A friction's thread, role and work item are those of spec 041. A thread's **role** is the one its calls get (specs 006, 011 and 032); a main thread split by markers counts, under a role, only its calls and frictions while that role's marker is in force. Orchestration shares (spec 010) carry no friction and stay with their main thread's role.
- Compactions are still ingested (spec 040): only `Context peaks` reads them.
- Ties not stated keep the order of spec 041.

## Expected proof

- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of `/api/frictions`: the role pills and their order, `unassigned`, a role selected with and without threads, a main thread split by markers under a role, the role combined with each kind and with a session and an issue filter, compactions left out of every count but the compacted thread count, `kind=compaction`, the buckets of each period with the `All time` start on the earliest call.
- Vitest tests of the `role` parameter parsing.
- Storybook stories of the frictions page in one column with every block, with a role selected (a `play` that selects and clears a role and checks the URL), an unknown role, at 1024 px and 1280 px. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of `/frictions` with `All` and with a role, at 1024 px and 1280 px, light and dark, attached to the pull request.

## Out of scope

- The occurrences of a row (spec 048) and the dot strip of `Context peaks` (spec 049).
- Several roles at once, or a filter by coding agent, tool or program.
- Removing compactions from ingestion or from the database.
