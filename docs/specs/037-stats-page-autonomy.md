# 037 · Stats page and autonomy

Status: done
Depends on: 031, 036
Checked: 2026-11-22

## User goal

A developer opens a `Stats` page and sees whether their factory delivers on its own: the share of merged issues no person had to help, how often a spec question stopped the agents and how long it waited for an answer, why a person stepped in when one did, and whether all of this improves week after week.

## Acceptance criteria

- [x] `/stats` is a React Router route that survives a reload. The sidebar (spec 031) shows a link `Stats` with a new icon `stats` (three bars rising from left to right, drawn like the other icons of `Icon.tsx`), between `Features` and `Sessions`; it carries the `project` parameter like the other links.
- [x] `/stats` shows a `PageHeader` (spec 019) titled `Stats`, with `PeriodPills` (spec 017) on the right keeping the `period` parameter, and the summary `<n> issues merged · <m> without a person` (`1 issue merged · 1 without a person`), or `No issue merged` with none, for the period and project. While the figures load, the header is `pending` (AGENTS.md).
- [x] Under the header, a `Panel` (spec 019) `Autonomy` shows three `StatFigure`s (spec 036) side by side, wrapping below 680 px:
  - `Merged without a person`: the share of merged issues at stage `Merged`, as a whole percent (`75%`); n = merged issues (`merged issue` / `merged issues`); higher is better.
  - `Spec questions`: the share of merged issues that had a needs-spec episode before their merge (`25%`); n = merged issues; lower is better.
  - `Waiting for an answer`: the median time of the needs-spec episodes answered in the period, formatted like `formatDuration` of `src/ui/format.ts` (`3 h 05 min`, `1 d 4 h`); n = answered episodes (`answered question` / `answered questions`); lower is better; with the note `<k> still waiting` when `k` issues of the project carry the needs-spec label now (left out at 0).
- [x] Each figure's change line compares with the previous period of the same length (spec 036): its comparison text is `yesterday` for `Today`, `previous 7 days` for `Last 7 days`, `previous 30 days` for `Last 30 days`; `All time` has no change line.
- [x] Under the figures, `Merged without a person, by week`: a `TrendBars` (spec 036, `share` scale, 64 px high, `--fd-stage-merged`) of the last 12 weeks, whatever the period, the current week last. A week's label is its Monday (`Nov 16`), the current one `this week`; its value is the share of the issues merged that week that are at stage `Merged`, with n = issues merged that week; its tooltip value reads `75% · 3 of 4`.
- [x] Then `Why a person stepped in`: a `CountBars` (spec 036) among the merged issues of the period at stage `Merged after a person` or `Merged by a person`, noun `merged issues helped by a person`, with the rows `Spec question`, `Score below threshold`, `Gates failed`, `Auto-merge off`, in this order before sorting. With no such issue, the text `No person had to step in.` replaces it.
- [x] With no merged issue in the period, the three figures show `Not enough data` (spec 036) and the panel still shows the weekly trend and the reasons text.
- [x] The demo data (`pnpm demo`) gains about 60 synthetic merged issues spread over the last 12 weeks, as git host data only (issues, requests, serenity reports, needs-spec label changes; no session): the share merged without a person rises over the weeks, every reason of `Why a person stepped in` occurs, at least one issue has two reasons, and two open issues still carry the needs-spec label. The existing demo issues and sessions stay as they are, except that the demo GitLab project sets `build.auto_merge: false`, so its existing merged issue #21 also lists the reason auto-merge-off and gives `Auto-merge off` its occurrence.
- [x] `GET /api/stats/autonomy?period=<period>&tz=<time zone>&project=<root>` returns, for the period and its previous one, the counts behind each figure (merged issues, merged at stage `Merged`, merged with a needs-spec episode, the durations of the answered episodes, the issues waiting now), the 12 weeks (start date, issues merged, merged at stage `Merged`), and the four reason counts with their total. The previous period is left out for `all`. Parameters are read and refused like those of `/api/overview` (specs 003 and 013): a missing or unknown `period` or `tz` answers 400.
- [x] The panel loads and fails on its own, with `Loading…` and the unreachable message (`StatusLine`), like the blocks of spec 024; while the period or project changes, the last figures stay on screen (`useRefreshing` with the page as `scope`).
- [x] Figures refresh with each collection (spec 008), without a reload. From 1024 px wide, nothing scrolls horizontally.

## Rules

- **Merged issue**: an issue at stage `Merged`, `Merged after a person` or `Merged by a person` (specs 009 and 034). Its **merge time** is the `mergedAt` of the request that counts under spec 009, or its update time when the git host gives none, as spec 034 orders them. An issue counts in a period, and in a week, when its merge time falls inside it, in the browser's time zone sent as `tz` (spec 003); `All time` takes every merged issue.
- **Needs-spec episode**: as spec 035 builds them (`needsSpecEpisodes` of `src/git-host/milestones.ts`), from the label changes of spec 034. A merged issue had one **before its merge** when one of its episodes started before its merge time.
- **Answered episode**: an episode with a removal time; it counts in the period of its removal time. Its waiting time runs from the label's addition to its removal. **Still waiting**: open issues of the project whose latest episode has no removal time, at the time of the request, whatever the period.
- **Reasons** of a merged issue a person helped, each counted once per issue, before its merge time:
  - `Spec question`: a needs-spec episode started before the merge;
  - `Score below threshold`: a serenity report (spec 034) of any request that closes the issue, earlier than the merge, below its own threshold;
  - `Gates failed`: such a report whose gates did not all pass;
  - `Auto-merge off`: the issue is `Merged by a person` and the project's `build.auto_merge` is `false` (spec 009).
    The reasons follow `refusalReasons` of `src/git-host/outcome.ts` (spec 035), so the issue page and this panel always agree.
- **Weeks** run Monday 00:00 to Sunday 24:00 local time; the 12 weeks end with the current week, partial. A week with no merged issue draws a stub, and its tooltip reads `No issue merged`.
- **Waiting for an answer** shows `Not enough data` in any period without a merged issue, the previous period included, so its change line never compares with a figure the page would not show.
- **Previous period**: the same length just before the period's start (`Today` → yesterday; `Last 7 days` → the 7 days before). Its figures follow the same rules.
- With `All projects`, every factory project counts together; `unassigned` work (spec 006) has no issue and does not count.
- Stage and merge are the current values of the last collection, as spec 010 says.

## Expected proof

- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of `/api/stats/autonomy` over synthetic issues and requests: merges inside, before and after the period; the previous period; a merged request without `mergedAt`; the three merged stages; a needs-spec episode before and after the merge; answered and still-waiting episodes; each reason, an issue with two reasons, auto-merge off; the 12 weeks across a month change; two projects with `All projects`.
- Storybook stories of the stats page: figures above and below the minimum sample, rising and falling changes, `All time` (no change line), no merged issue, no person stepped in, loading, unreachable, at 1024 px; a `play` that changes the period and checks the URL. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of `/stats` at 1024 px and 1280 px, light and dark, attached to the pull request.

## Out of scope

- The quality and flow panels (specs 038 and 039) and frictions (specs 040 and 041).
- Prompts typed by a person per issue, and other human input than spec 034 counts.
- Linking a figure to the issues behind it.
- Configurable weeks, minimum sample or trend length.
