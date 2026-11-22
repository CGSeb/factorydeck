# 020 · Work components

Status: done
Depends on: 018, 019
Checked: 2026-11-22

## User goal

A developer follows each issue of the factory as a card on a board, then as a timeline of the role threads that built, reviewed and shipped it, with what each step used in tokens. This spec builds the issue card, the board column, the issue timeline and the issue summary in Storybook.

## Acceptance criteria

- [x] `src/ui/components/IssueCard.tsx` takes an issue (project root, display name and colour, number, title, link target), an optional badge (a `StageBadge`, `SerenityBadge` or `RoundsBadge` of spec 016, or a short neutral text such as `by a person`), the issue's token counts and cost, and `showProject`. It renders a card (border `--fd-border-2`, radius `--fd-radius-card`, padding 11 px × 13 px, gap 8 px): the `ProjectTag` when `showProject` is true; a link `#<n> <title>` (14 px, 600, number in `--fd-muted` weight 500) to the issue page; then a line with the badges on the left and a strong `TokenAmount` (spec 015) on the right. The card itself is not a link: the title link and the token amount are separate focusable elements.
- [x] An issue whose title is unknown (spec 008: not found or not collected) shows `#<n> (not found)` or `#<n>`, as the features list does today.
- [x] `src/ui/components/StageColumn.tsx` takes a stage group (`Ready`, `Working`, `In review`, `Merged`), its count, its token counts and cost, its cards and a `more` link (count and target). It renders a white panel (radius `--fd-radius-panel`, padding 12 px, gap 10 px) headed by an `h2` with the `StageDot`, the group name and its count in `--fd-muted`, and the group's tokens as a `TokenAmount` with its tooltip below; then the cards; then, when `more` is above 0, a link `+ <n> more`. With no card, the panel shows `No issue` in `--fd-muted`.
- [x] `src/ui/components/IssueTimeline.tsx` takes steps, each with a role, its colour, a title, a detail line, token counts and cost, and threads (title, link target, date text, token counts and cost). It renders an ordered list along a 2 px `--fd-border-2` line: each step has a 16 px round marker with a 4 px border of the role colour, its title (15 px, 600), its `TokenAmount` (strong) on the right, its detail line (13 px, `--fd-muted`), then its threads as rows on `--fd-surface-2`, radius 8 px, each a link to its target, the date and a `TokenAmount`. A step with no threads shows no rows.
- [x] `src/ui/components/IssueSummary.tsx` fills an `Aside` (spec 019) with, in order: `Tokens` and the issue's total as a `figure` `TokenAmount` (tooltip opening below); a line `Orchestration <tokens> · <p>% of the tokens` when there is an orchestration share (spec 010); a medium `SplitBar` by role and its `SplitLegend` (spec 018); `Serenity` and `Review rounds` as two figures (`--fd-font-display`, 26 px; a score below its threshold in `--fd-warning` followed by `below threshold`; `—` without report); then a definition list: `Pull request` (`#<n>` linked to the git host and its state), `Checks` (the checks state of spec 008), `Labels` (comma-separated), `Reworked` (`Yes` or `No`), each line left out when its data is missing.
- [x] Storybook stories: `IssueCard` (with project, without project, each badge kind, title not found), `StageColumn` (three cards, no card, with `+ 4 more`), `IssueTimeline` (five steps with one to two threads each, a step without threads), `IssueSummary` (merged above threshold, merged by a person below threshold, in review without report, no orchestration share). They pass the axe check of `src/ui/stories.test.tsx`.

## Rules

- The components only display what they are given; grouping threads into steps and picking a card's badge belong to specs 024 to 026.
- Colours come from the tokens and palettes of spec 014.

## Expected proof

- The stories above pass axe; screenshots of `StageColumn` and `IssueTimeline` at 360 px and 1280 px, attached to the pull request.

## Out of scope

- Data and APIs (specs 021 and 022) and the pages (specs 024 to 026).
- Dragging cards between columns or changing an issue from FactoryDeck.
