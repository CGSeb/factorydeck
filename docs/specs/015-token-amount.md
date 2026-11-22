# 015 · Token amount

Status: ready
Depends on: 014
Checked: 2026-11-22

## User goal

A developer reading FactoryDeck sees every amount as a number of tokens, and by hovering or focusing it, sees what it cost in dollars and how it splits into input, output, cache read and cache write tokens. This spec builds that component in Storybook; pages use it from spec 023 on.

## Acceptance criteria

- [ ] `src/ui/components/TokenAmount.tsx` exports `TokenAmount`, with props `counts: { input: number; output: number; cacheRead: number; cacheWrite: number }`, `costUsd: number | null`, optional `unknownPriceCalls: number` (default 0), optional `size: 'inline' | 'strong' | 'figure'` (default `inline`) and optional `placement: 'above' | 'below'` (default `above`).
- [ ] It shows the total of the four counts in the compact format of `formatTokens` (`src/ui/format.ts`: `999`, `1.2K`, `41.8M`), in tabular figures, underlined with a dotted line of the current text colour. `inline` keeps the surrounding size and weight; `strong` is bold; `figure` uses `--fd-font-display` at `--fd-figure`, weight 600, in `--fd-accent`.
- [ ] The number is focusable with the keyboard (in the tab order) and is described by its tooltip (`aria-describedby`); a screen reader reads the total, then the tooltip lines.
- [ ] Its tooltip appears while the pointer is over the number or the tooltip itself, and while the number has keyboard focus; `Escape` hides it until the pointer leaves or focus moves. It does not move other content (it overlays it).
- [ ] The tooltip, on `--fd-tooltip-bg` with radius `--fd-radius-card`, holds, in this order, one line per item with the label on the left and the value right-aligned in tabular figures:
  1. `Cost` and the cost of `formatCost` (`~$27.40`, `<$0.01`), in bold, followed by a thin `--fd-tooltip-line` separator;
  2. `Input`, `Output`, `Cache read`, `Cache write`, labels in `--fd-tooltip-muted`, each count in the compact format.
- [ ] With `costUsd` null, the cost line reads `Cost` and `—`, then a line `Price unknown for every call`. With `unknownPriceCalls` above 0 and a cost, a line after the cost reads `Excludes 1 call with unknown price` or `Excludes <n> calls with unknown price`.
- [ ] `placement: 'above'` opens the tooltip above the number, aligned on its right edge; `below` opens it under the number, aligned on its left edge. The tooltip never makes the page scroll horizontally at 360 px wide: when it would overflow the viewport on one side, it shifts to stay inside it.
- [ ] A total of 0 shows `0` and its tooltip like any other.
- [ ] Storybook stories: `Inline`, `Strong`, `Figure`, `Tooltip open` (opened by its `play` function through focus, checking the five lines), `Below`, `Unknown price` (cost null), `Some unknown prices` (2 calls), `Zero`, and `Near the edge` (placed at the right edge of a 360 px wide frame). They pass the axe check of `src/ui/stories.test.tsx`.

## Rules

- The total shown is always the sum of the four counts given, never a separate figure, so the number and its tooltip cannot disagree.
- Colours, fonts and sizes come from the tokens of spec 014 only.
- The existing `TokenCount` component stays as it is until spec 030.

## Expected proof

- Vitest tests of the tooltip lines for each case (cost, unknown cost, some unknown prices, singular and plural).
- The stories above, with `play` functions for the focus, hover and `Escape` behaviour, passing axe.
- A screenshot of `Tooltip open` and `Near the edge` from Storybook, attached to the pull request.

## Out of scope

- Using `TokenAmount` on a page (specs 023 to 029).
- Any change to the APIs (spec 021 adds the counts the pages pass to it).
- A setting to show dollars instead of tokens.
