# 017 · Controls

Status: done
Depends on: 015, 016
Checked: 2026-11-22

## User goal

A developer changes the period, filters, sorting and project of FactoryDeck with controls that look the same on every page, are easy to hit and work from the keyboard. This spec builds those controls in Storybook.

## Acceptance criteria

- [x] `src/ui/components/PeriodPills.tsx`: a group (`role="group"`, accessible name `Period`) of four buttons `Today`, `Last 7 days`, `Last 30 days`, `All time` for the periods of spec 003. The selected one has `aria-pressed="true"`, background `--fd-ink` and white text; the others a `--fd-field-border` border on `--fd-surface`. Each button is 36 px high with 14 px side padding, radius `--fd-radius-pill`. It calls `onChange(period)` on click; clicking the selected one changes nothing. The group wraps on narrow widths.
- [x] `src/ui/components/FilterPills.tsx`: a group with an accessible name given by the caller, of buttons each with an optional leading dot colour, a label and a count (`Working 3`), styled like `PeriodPills`; exactly one is pressed; `onChange(value)` on click.
- [x] `src/ui/components/StageStrip.tsx`: four cells side by side, one per stage group of spec 024 (`Ready`, `Working`, `In review`, `Merged`), in a grid of equal columns with 4 px gaps, radius `--fd-radius-panel` on the outer corners. Each cell is 16 px × 20 px padded, with background `--fd-page`. In each cell, a button shows the group's `StageDot` (spec 016) and name (13 px, 600), then its count (`--fd-font-display`, 32 px). Below the button, in the same cell but not inside the button, the group's tokens show as a `TokenAmount` (spec 015) followed by `tokens`, so the amount keeps its focusable tooltip without nesting one interactive element in another. A selected group's button has `aria-pressed="true"`, and its cell has background `--fd-success-bg` for `Merged` and `--fd-accent-soft` otherwise. Clicking the selected button again selects none (`onChange(null)`). At 360 px the four cells stack two by two.
- [x] `src/ui/components/SortSelect.tsx`: a visible label `Sort by` and a native `select` 36 px high, radius 8 px, with the options the caller gives; `onChange(value)`.
- [x] `src/ui/components/ShowMore.tsx`: a centred line with `<shown> of <total>` in `--fd-muted` and a `Show more` button (40 px high, pill, weight 600); with `shown` equal to `total`, nothing is rendered.
- [x] `src/ui/components/RefreshControl.tsx`: the collection status text of spec 008, as `CollectionStatus` words it today (`Issues updated 2 min ago`, `Issues not collected yet`; 12 px, `--fd-muted`) then a round 40 px icon button with an arrow icon (inline SVG, `aria-hidden`), accessible name `Refresh`; while refreshing, the icon turns, the button is disabled and its accessible name is `Refreshing…`. At widths below 480 px the status text is hidden visually and added to the button's accessible name (`Refresh, issues updated 2 min ago`).
- [x] `src/ui/components/ProjectPill.tsx`: the project select of spec 013 with its behaviour unchanged (options, value, accessible name `Project`, 16em maximum width, `…` cut, tooltip), restyled as a pill: 40 px high, radius `--fd-radius-pill`, `--fd-field-border` border, `--fd-page` background, 14 px weight 600.
- [x] Every control shows a visible focus ring (2 px `--fd-accent` outline, 2 px offset) and has a hit area at least 36 px high.
- [x] Storybook stories: `PeriodPills` (each period selected, a `play` that clicks `Last 30 days`), `FilterPills` (session states with counts), `StageStrip` (none selected, `Merged` selected, `Working` selected, at 360 px, a `play` that selects then unselects a group), `SortSelect`, `ShowMore` (more to show, all shown), `RefreshControl` (collected, not collected yet, refreshing, narrow), `ProjectPill` (`All projects`, a long name cut, an unknown project). They pass the axe check of `src/ui/stories.test.tsx`.

## Rules

- Controls hold no state of their own beyond focus and hover: the caller owns the value, so pages keep their URL parameters (specs 003 to 013).
- The existing `PeriodSelector`, `ProjectSelect` and `CollectionStatus` stay until spec 030.

## Expected proof

- The stories above, with their `play` functions, pass axe.
- A screenshot of `StageStrip` at full width and at 360 px, attached to the pull request.

## Out of scope

- Using the controls on pages (specs 023 to 029).
- New URL parameters; specs 025 and 027 add the ones their pages need.
