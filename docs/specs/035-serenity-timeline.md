# 035 · Serenity timeline

Status: done
Depends on: 034
Checked: 2026-11-22

## User goal

A developer opening an issue sees, in the order they happened, each serenity score the factory gave it and each time it waited for a person, so a merge that followed a refusal or a spec question reads as such, and the score's path from the first report to the last is visible wherever the score is shown.

## Acceptance criteria

- [x] The issue API of spec 022 returns the issue's milestones: every serenity report (spec 034) of every pull or merge request that closes the issue, and every needs-spec episode (spec 034), each with its time; a report also gives its request number and link, its score, threshold, and whether it refused the merge and why.
- [x] On the issue page (spec 026), `IssueTimeline` shows the milestones between its steps. A milestone goes after the last step whose first thread starts at or before the milestone's time, or before the first step when it is earlier than all of them; several milestones after the same step keep their time order. The `Orchestration` step stays last.
- [x] A report milestone reads `Serenity <score>/100 (threshold <threshold>)`, then ` · merge refused: <reasons>` or ` · merge allowed`, where reasons are `below threshold`, `gates failed`, `auto-merge off`, joined by `, `. Its detail line is the local date and time (`22 Nov, 17:33`) and `#<n>`, linked to the request on the git host. A refused report uses the warning tone, an allowed one the success tone; the text always says which.
- [x] A needs-spec milestone reads `Needs spec`, with the detail `waiting for a person` while the label is still on the issue, or `answered <date and time>` (the time the label was removed); its time is when the label was added. It uses the warning tone.
- [x] A milestone's marker is smaller than a step's and is not a role colour; it carries no token amount and no thread rows. Milestones are items of the timeline's list, so a screen reader reads them in order with the steps.
- [x] Milestones follow the page's period like the threads: only those whose time is inside the period are shown. An issue with milestones but no thread in the period still shows `No activity in this period.`
- [x] When the request whose report counts (spec 009) has two or more reports and its first score differs from its last, the score is shown as a path: `Serenity <first> → <last>/100 (threshold <t>)` in the session header outcome (spec 009, 027), `serenity <first> → <last>` in `SerenityBadge` (spec 016; warning tone and `below threshold` after it when the last is under its threshold), and in `IssueSummary` (spec 020) the last score as today's figure with a line `from <first>` under it in `--fd-muted`. With one report, or equal first and last scores, nothing changes.
- [x] The `Serenity` column and sort of `/features` (spec 025) keep the last score only.

## Rules

- A report refused the merge as spec 009 says (score below threshold, gates not all passed, or `build.auto_merge` off); the reasons list each one that applies, in that order.
- Milestone times are the report comment's time and the label's add time; ties between a step and a milestone put the milestone after the step.
- The score path compares only the reports of the request that counts; reports of other requests appear as milestones only. The threshold shown with a path is the last report's.
- The timeline shows every milestone of the period, with no limit, like threads (spec 026). A needs-spec episode whose label was added before the period is not shown, even when it was removed inside it.
- No new data is collected: everything comes from spec 034.

## Expected proof

- Vitest tests of milestone placement (before every step, between steps, after the last step and before `Orchestration`, two milestones after one step, a tie), of the period filter, of the refusal reasons text, and of the score path (one report, equal scores, rising, falling under the threshold).
- Storybook stories: `IssueTimeline` with a refused report, an allowed report and a needs-spec episode (answered and waiting); `SerenityBadge` with a path above and below the threshold; `IssueSummary` with a path; the issue page merged after a person through a refused report, at 1024 px. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of the demo issues `Merged after a person` of spec 034 at 1024 px and 1280 px, attached to the pull request.

## Out of scope

- A milestone for the merge itself or for label changes other than needs-spec.
- The text of the report comments or of the spec questions.
- A score path in the `/features` table or on overview cards beyond `SerenityBadge`.
