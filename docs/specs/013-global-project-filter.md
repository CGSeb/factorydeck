# 013 · Global project filter

Status: done
Depends on: 012
Checked: 2026-11-22

## User goal

A developer picks a project once, in the top bar, and every page of FactoryDeck shows that project only, as they move from page to page. The pages no longer each carry their own project filter.

## Acceptance criteria

- [x] The top bar of every page has a select with no visible label, whose accessible name is `Project`, placed just before the refresh control of spec 008 (`CollectionStatus`). Its options are those of the project filters of spec 012: `All projects` first (the default), then each project with stored sessions by display name.
- [x] The select reads and writes the `project` URL parameter of specs 004 to 010 (the project root, URL-encoded). Opening any URL with `?project=<root>` selects that project; `All projects` removes the parameter.
- [x] Choosing a project on `/`, `/sessions`, `/skills`, `/skills/<name>`, `/roles` or `/features` stays on that page, keeps its other URL parameters (`period`, `state`) and shows that project's data; the session list starts again from its first page.
- [x] Choosing a project on a session page (`/sessions/<id>`) opens `/sessions` with that project; on an issue page (`/features/<n>?project=<root>`) it opens `/features` with that project; both keep the `period` parameter. `All projects` opens the same list without `project`.
- [x] The select always shows the `project` URL parameter of the current page: on an issue page, the issue's project (its `project` parameter of spec 010); on a session page opened without the parameter, `All projects`, whatever the session's project.
- [x] An empty `project` parameter (`?project=`) means `All projects`. A parameter is matched to a project root exactly: another spelling (a trailing `/`, another letter case) is an unknown project.
- [x] The section links of the top bar (`Overview`, `Features`, `Sessions`, `Skills`, `Roles`) carry the current `project` parameter, and only that one; with `All projects` they have none. A reload keeps the selected project.
- [x] Links inside the pages carry the current `project` parameter too: a session row to its session page, a skill row to its skill page, the back links of the session, skill and issue pages. A link that names its own project (an issue row of `/features`, the issue's link back to `/features`) keeps it, as in spec 010.
- [x] The overview follows the select: the tiles, the daily chart, `By model` and `By project` show only the selected project's data; `By project` then has that project's row only. Its totals equal those of `/sessions`, `/skills`, `/roles` and `/features` for the same period and project.
- [x] The project filters inside `/sessions`, `/skills`, `/skills/<name>`, `/roles` and `/features` are removed; the period selector and the state filter of `/sessions` stay where they are.
- [x] A `project` parameter that names no project with stored sessions shows as an extra option with its display name (spec 012: its folder name), selected, and the pages show no data for it, as the filters of spec 004 do today.
- [x] While FactoryDeck holds no session (the welcome panel of spec 007), the select is not shown. After a project is deleted (spec 007), it leaves the options without a reload; if it was selected, the select falls back to `All projects` and the parameter is removed.
- [x] At a window width of 360 px, the top bar wraps without a horizontal scroll; the closed select is at most 16em wide, and a longer name is cut with `…` there, shown in full in its options (up to the 60 characters of spec 012) and its tooltip.
- [x] The select lists every project with stored sessions, with no limit on their number.

## Rules

- The selected project is the `project` URL parameter, nothing else: no browser storage, no server setting.
- On `/features` with `All projects`, the project column shows; with one project it is hidden, as in spec 010.
- The project list of the select refreshes with the factory status of spec 007 (each re-ingestion of spec 003).
- The period stays per page, as today: the section links do not carry it.

## Expected proof

- Vitest tests of the overview API with a `project` parameter: tiles, daily buckets, models and projects of that project only, and totals equal to those of the sessions, skills, roles and features APIs for the same period and project.
- Storybook stories of the layout with the select (`All projects`, one project selected, an unknown project, two projects of the same name, no session), with `play` functions that choose a project and check the URL and the section links, and of a session page and an issue page where choosing a project opens the list; stories of `/sessions`, `/skills`, `/roles` and `/features` without their own project filter. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: choosing a demo project in the top bar on the overview, then following `Sessions` and `Features`, shows that project only on each page; screenshots at full width and at 360 px are attached to the pull request.

## Out of scope

- Selecting several projects at once.
- Carrying the period from page to page.
- Remembering the last project chosen when FactoryDeck is opened without a `project` parameter.
- Project names themselves (spec 012).
