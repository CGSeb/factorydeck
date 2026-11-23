# 046 · Stats figure help and tokens on rework

Status: done
Depends on: 045
Checked: 2026-11-23

## User goal

A developer who does not know what `Lead time` or `Cycle time` means finds out on the `Stats` page itself: each figure has an information icon that explains it in one or two sentences. Under `Where the tokens went`, `Cache reads`, which sits near 97% for any work done with a language model, gives way to `Tokens on rework`: how much of the period's tokens went to fixing work the review sent back.

## Acceptance criteria

- [x] `StatFigure` (spec 036) takes an optional `help` text. When given, a 14 px icon `info` (a circle with an `i`, drawn like the other icons of `Icon.tsx`, `--fd-muted`, `--fd-ink` on hover and focus) sits right after the label, on the same line, vertically centred on it. The component holds no workflow vocabulary: the caller writes the text.
- [x] The icon is a `button` (`type="button"`) whose accessible name is `About <label>` (`About Lead time`). Hovering it, focusing it with the keyboard, or tapping it shows a tooltip in the chart tooltip style holding the help text, at most 260 px wide, wrapping, placed under the icon and kept inside the viewport; the button carries `aria-describedby` pointing to the tooltip while it shows. Moving the pointer away, moving the focus away, `Escape`, or a second tap hides it. Showing it moves no other content.
- [x] Every figure of `/stats` carries its help text, exactly:
  - `Merged without a person`: `Share of the issues merged in the period that the factory merged on its own: no spec question, no refused serenity report, no person merging.`
  - `Spec questions`: `Share of the merged issues whose agents stopped to ask a spec question (the needs-spec label) before the merge.`
  - `Waiting for a person`: `Median time the factory waited once it stopped, on a refused serenity report or a spec question, until the next report, the merge or the close.`
  - `Right the first time`: `Share of the merged issues whose first serenity report already allowed the merge: score at or above the threshold and every gate passed.`
  - `Review rounds`: `Mean number of review rounds in the serenity report that decided each merge.`
  - `Score gain`: `Mean change of the serenity score between an issue's first report and its last one before the merge.`
  - `Lead time`: `Median time from an issue's creation to its merge, including the time it waited before any agent started.`
  - `Cycle time`: `Median time from the first agent call on an issue to its merge: how long the agents took once they started.`
  - `Tokens per merged issue`: `Median tokens a merged issue used over its whole life, its share of the orchestration included.`
  - `Tokens on dropped work`: `Share of the period's tokens spent on issues that were closed without a merge.`
  - `No work item`: `Share of the period's tokens spent in threads tied to no issue.`
  - `Tokens on rework`: `Share of the period's tokens spent on an issue after its first refused serenity report: the cost of fixing work the review sent back.`
- [x] Under `Where the tokens went` (spec 039), `Tokens on rework` replaces `Cache reads`, third after `Tokens on dropped work` and `No work item`: the share of the period's tokens on rework (rules), as a whole percent; n = API calls of the period (`API call` / `API calls`); lower is better; the `share` change line of spec 037. With no call in the period, it shows `Not enough data`, like its two neighbours.
- [x] `GET /api/stats/flow` (spec 039) replaces the input-side and cache read tokens with the rework tokens, for the period and the previous one. Parameters and refusals stay as spec 037 says.
- [x] The demo data (`pnpm demo`) gives at least 3 of the merged issues with sessions (spec 039) calls after their first refused report, and at least one issue whose first report passed and that has calls after it. The other demo data stays as it is.
- [x] From 360 px wide, a tooltip never makes the page scroll horizontally; from 1024 px, nothing scrolls horizontally.

## Rules

- **First refused report** of an issue: its earliest serenity report, among every report of every request that closes it, whose score is below its own threshold or whose gates did not all pass (`refusing report` of spec 045); ties keep the one stored first. An issue without one has no rework.
- **Tokens on rework**: the tokens (the four kinds, spec 003) of the period's calls (by their own time, as the other two figures of `Where the tokens went`) whose issue (spec 010) has a first refused report at or before the call's time. Orchestration shares (spec 010) have no time of their own and do not count as rework. The share is over the same total as `Tokens on dropped work` and `No work item`.
- The issue's current stage does not matter: a call on a dropped issue after its refusal counts in both `Tokens on dropped work` and `Tokens on rework`.
- With `All projects`, every factory project counts together, as spec 037.

## Expected proof

- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of `/api/stats/flow`: calls before, at and after an issue's first refused report, a first report that passed then a refused one, a refusal on an earlier closed request, an orchestration share left out, a dropped issue counted in both shares, no call in the period, the previous period.
- Storybook stories of `StatFigure` with help (hover, keyboard focus with a `play` that tabs to the icon and checks the tooltip and its `aria-describedby`, `Escape`), at 360 px, in both themes; the stats page with every help icon and `Tokens on rework`. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of `/stats` with a tooltip open, at 1024 px, light and dark, attached to the pull request.

## Out of scope

- Help icons on chart titles, sections, the frictions page or other pages.
- Showing the cache read rate anywhere else, or costs in US dollars.
- Rework tokens per issue or per role.
