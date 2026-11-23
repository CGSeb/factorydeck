# 049 · Dot strip columns

Status: ready
Depends on: 042
Checked: 2026-11-23

## User goal

A developer looking at a dot strip with many close values (`Context peaks` with 255 threads, `Lead time` or `Tokens per merged issue` on a busy month) reads every `+k` count, because the counts of neighbouring stacks never overlap any more.

## Acceptance criteria

- [ ] `RangeStrip` (spec 036) places its dots in columns instead of stacking dots closer than 8 px: the line is split into columns 28 px wide from its left end (the last one narrower when the width does not divide), each item goes to the column holding its exact position, and its dot sits on the column's centre, so a dot moves at most 14 px from its value.
- [ ] A column stacks its dots 10 px apart, from the line up, in value order; with more than 5 items, it draws its 4 lowest dots and, on the 5th level, the pill `+<m − 4>` centred on the column. A pill fits its column: its count reads `+99` at most, and `99+` above. Two pills never overlap, whatever the data and the width.
- [ ] The rest of spec 036 holds: the line, `0` and the largest value under its ends, the median and `p90` ticks at their exact positions, the fixed height, `No data`, `Not enough data for median and p90`, links, keyboard order, tooltips and the accent ring of a folded item.
- [ ] Its stories gain 255 items crowded near the median, at 360 px and 1024 px, in both themes; a `play` checks that no two pills overlap.

## Rules

- Column of an item: `floor(x / 28)`, `x` being its exact position in px from the line's left end; an item at the right end goes to the last column.
- Value order within a column: by value, then the given order.

## Expected proof

- Vitest tests of the column layout: equal values, values 1 px apart across a column edge, an item at each end, 5 and 6 items in a column, 103 items in a column (`+99`) and 104 (`99+`), a strip narrower than one column.
- The stories above pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of `Context peaks` and of the `Flow and cost` strips at 1024 px, light and dark, attached to the pull request.

## Out of scope

- Another chart in place of the strip, or a zoom.
- Changing the median and `p90` marks.
