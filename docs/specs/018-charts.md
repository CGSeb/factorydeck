# 018 · Charts

Status: done
Depends on: 015
Checked: 2026-11-22

## User goal

A developer sees where tokens went (by role, by token kind, by skill), how they spread over the days, and how often a skill was launched, in light charts drawn with plain HTML and CSS that read well with a screen reader. This spec builds those charts in Storybook, without Recharts.

## Acceptance criteria

- [x] `src/ui/components/SplitBar.tsx` takes segments (`label`, `value`, `color`, optional `counts` and `costUsd` for a `TokenAmount`) and a height (`thin` 8 px, `medium` 12 px, `tall` 40 px). It draws one horizontal bar, radius half its height, where each segment's width is proportional to its value, with 2 px gaps; a segment above 0 is at least 2 px wide; segments at 0 are left out. In `tall`, a segment at least 48 px wide shows its share inside, white, 12 px, weight 600 (`45%`, whole percent).
- [x] `SplitBar` has an accessible name given by the caller and, for screen readers, a list of its segments with their label and share (`builder 45%`); the coloured blocks themselves are `aria-hidden`.
- [x] `src/ui/components/SplitLegend.tsx` lists the same segments, wrapping, gap 6 px × 18 px: a 9 px square of the segment colour, the label, then its value as a `TokenAmount` (spec 015) when counts are given, else as a number.
- [x] `src/ui/components/BarCell.tsx` draws, inside a table cell, a 10 px track (`--fd-line`, pill) with a bar of the given colour whose width is the value divided by the largest value of the column (a value of 0 draws no bar), then the value as a `TokenAmount`, right-aligned, at least 48 px wide.
- [x] `src/ui/components/DayBars.tsx` takes buckets (`label`, `value`, optional `counts` and `costUsd`), a colour and a height in px. It draws one column per bucket, bottom-aligned, gap 6 px, radius 4 px on top, height proportional to the largest value (a bucket at 0 shows a 2 px stub); each column's tooltip (`title`) is `<label> · <value>` (with tokens: `Nov 20 · 1.9M tokens`). Under the chart, the first and last bucket labels show at the two ends; with 7 buckets or fewer, every label shows under its column.
- [x] `DayBars` has `role="img"` and an accessible name given by the caller, and a visually hidden table of every bucket and its value for screen readers.
- [x] Bucket labels use `formatBucket` of `src/ui/format.ts` (`Nov 20` for a day, `14:00` for an hour), so the `Today` period of spec 003, bucketed by hour, works the same.
- [x] Storybook stories: `SplitBar` (thin, medium, tall with shares, one segment, a tiny segment, all zero), `SplitLegend` (with and without token counts), `BarCell` (in a small table of 4 rows, one at 0), `DayBars` (7 days, 30 days, 24 hours, all zero, launches as counts). They pass the axe check of `src/ui/stories.test.tsx`.

## Rules

- Charts are HTML and CSS only (no canvas, no chart library); they size to their container and never cause a horizontal scroll at 360 px.
- Colours are given by the caller from the tokens and palettes of spec 014.
- The existing `CostChart` and `LaunchChart` (Recharts) stay until spec 030, which removes Recharts.

## Expected proof

- Vitest tests of the width and height arithmetic (proportions, 2 px minimum, all zero) and of the share rounding.
- The stories above pass axe; a screenshot of `SplitBar` tall and `DayBars` 30 days, attached to the pull request.

## Out of scope

- Axes, gridlines, zoom or interactive legends.
- Using the charts on pages (specs 024 to 029).
