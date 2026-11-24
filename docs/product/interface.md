# Interface

The rules every page and component follows. New UI work reuses what is here before adding anything.

## Design tokens

Every colour, font, size, radius and spacing comes from the CSS custom properties of [`src/ui/design/tokens.css`](../../src/ui/design/tokens.css) (`--fd-*`), on `:root`. No component CSS names a colour of its own.

- **Text**: `--fd-ink`, `--fd-ink-2`, `--fd-muted`. **Surfaces**: `--fd-page`, `--fd-surface`, `--fd-surface-2`, `--fd-overlay`. **Lines**: `--fd-border`, `--fd-border-2`, `--fd-line`, `--fd-field-border`.
- **Accent**: `--fd-accent` (teal), `--fd-accent-soft`, `--fd-accent-ink`, `--fd-link`, `--fd-link-hover`.
- **Tones**, a background and a text each: success, warning, info, danger, neutral (`--fd-success-bg` / `--fd-success`…).
- **Stage dots**: `--fd-stage-ready`, `--fd-stage-working`, `--fd-stage-review`, `--fd-stage-merged`. **Token kinds**: `--fd-kind-cache-read`, `--fd-kind-cache-write`, `--fd-kind-input`, `--fd-kind-output`.
- **Palettes** for projects, roles and categories are in `src/ui/design/palette.ts` (`projectColors`, `roleColors`); they are mid-tone colours that read on both themes, and `labelTextColor` (`src/ui/colors.ts`) picks the text on them. A component never picks a colour from a name: the caller gives it.
- **Dark theme**: `src/ui/design/theme-dark.css` redefines every colour token under `:root[data-theme='dark']`. Every text and background pair reaches 4.5:1 in both themes (`tokens.test.ts` checks them).
- Figures use tabular numbers.

## Components

Components live in `src/ui/components/`; each has Storybook stories, one per state, and every story passes an axe check. They take their content and colours from the caller and never read the URL or an API. Controls hold no state beyond focus and hover: the page owns the value, in its URL.

- **Amounts and labels**: `TokenAmount` (tokens with the tooltip of cost and kinds), `StageBadge`, `SessionStateBadge`, `SerenityBadge`, `RoundsBadge`, `ProjectTag`, `RoleTag`. A label always says its meaning in text: colour is never the only cue.
- **Controls**: `PeriodPills`, `FilterPills`, `StageStrip`, `SortSelect`, `ProjectPill`, `RefreshControl`, `ShowMore`.
- **Layout**: `Sidebar`, `PageHeader`, `Panel`, `DataTable`, `SplitPage`, `StatusLine`, `WarningBanner`, `Dialog`, `EmptyState`, `Icon` (inline SVG, no icon package).
- **Work**: `IssueCard`, `StageColumn`, `IssueTimeline`, `IssueSummary`.
- **Charts**: `SplitBar` and `SplitLegend`, `DayBars`, `BarCell`, and for stats `StatFigure`, `TrendBars`, `ScoreHistogram`, `CountBars`, `RangeStrip`. The stats components hold no workflow vocabulary; the caller writes labels, nouns and help texts.

## Charts

Charts are plain HTML and CSS, with no chart library and no canvas. They size to their container, never cause a horizontal scroll at 360 px, have no axes, gridlines or zoom, and read well with a screen reader: each has an accessible name and a hidden table of its values. Tooltips share one style.

## Layout

- **No layout shift**: content that stays on screen does not move while data loads. A page loads through `useRefreshing` (`src/ui/skills-api.ts`), which keeps the last data on screen while a filter or the period reloads; a `PageHeader` whose summary loads gets `pending`, so the title, summary and period pills sit at the same place on every page; controls built from loaded data stay with their last values.
- The main column is `--fd-page-max` wide, centred, with `--fd-gutter` padding (16 px below 480 px). The sidebar is 232 px wide, 64 px folded.
- From 1024 px wide nothing scrolls horizontally; tables scroll inside their box. From 360 px no page scrolls horizontally.
- Fold and unfold are not animated under `prefers-reduced-motion: reduce`.

## Browser storage

Only per-browser comfort settings, never sent to the server: the sidebar fold (`factorydeck.sidebar`) and the theme (`factorydeck.theme`). Every read and write survives a `localStorage` that throws. Everything else that a page shows is in its URL.
