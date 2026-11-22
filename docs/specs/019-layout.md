# 019 · Layout

Status: done
Depends on: 016, 017
Checked: 2026-11-22

## User goal

A developer moving between FactoryDeck pages finds the same top bar, page header, panels, tables, warnings and dialogs everywhere, and can use them from a phone-width window to a wide screen. This spec builds those layout components in Storybook.

## Acceptance criteria

- [x] `src/ui/components/TopBar.tsx`: a white bar with a bottom `--fd-border` line, its content in a column of `--fd-page-max` centred with `--fd-gutter` side padding, at least `--fd-topbar-height` high. From left to right: the brand `Factory` + `Deck` (`--fd-font-display`, 18 px, 700; `Deck` in `--fd-accent`); a `nav` with accessible name `Sections` and a list of links given by the caller (pills 40 px high, 14 px side padding, 14 px text; the current one has `aria-current="page"`, background `--fd-accent-soft`, text `--fd-accent-ink`, weight 600; the others `--fd-ink-2`); then, pushed right, a slot for `ProjectPill` and `RefreshControl` (spec 017). It wraps without horizontal scroll: at 360 px, the brand, project pill and refresh button share the first line, and the links take the next line.
- [x] `src/ui/components/PageHeader.tsx`: an optional back link (`← <text>`, 13 px, no underline), a title (`h1`, `--fd-font-display`, `--fd-title-md`, weight 600, letter spacing −0.02em), an optional summary line under it (14 px, `--fd-muted`, tabular figures), and a right slot (for `PeriodPills`), aligned on the bottom of the title block; the slot moves under the title when space runs out. A `headline` variant uses `--fd-title-lg` and lets the title hold a `TokenAmount`.
- [x] `src/ui/components/Panel.tsx`: a `section` on `--fd-surface`, radius `--fd-radius-panel`, padding 18 px × 20 px, with an optional heading (`h2`, `--fd-font-display`, 17 to 18 px, 600) and an optional link on the heading's right.
- [x] `src/ui/components/Aside.tsx`: the side column of detail pages: background `--fd-page`, radius `--fd-radius-aside`, padding 22 px, its blocks separated by a `--fd-border` line and 16 px. `src/ui/components/SplitPage.tsx` places a main column (`flex: 999 1 600px`) and an `Aside` (`flex: 1 1 320px`) side by side with 32 px between them, the aside going under the main column when space runs out.
- [x] `src/ui/components/DataTable.tsx` styles a native table given by the caller: header cells 12 px `--fd-muted`, weight 500, with a 2 px `--fd-ink` line under the header row; body rows separated by `--fd-line`; numeric columns right-aligned in tabular figures; optional group header rows (`th` with `scope="colgroup"`, 12 px uppercase, letter spacing 0.06em, a `StageDot` or colour dot, the group name and its count); an optional total row in bold. The table sits in a box that scrolls horizontally when narrower than the table's minimum width, so the page itself never scrolls horizontally.
- [x] `src/ui/components/WarningBanner.tsx`: a full-width band under the top bar, background `--fd-warning-bg`, bottom border `--fd-banner-border`, text `--fd-banner-ink`, its content aligned on the page column, with accessible name given by the caller. It lists messages, each with a warning icon (inline SVG, `aria-hidden`) and an optional action button on the right (pill, 36 px, white, weight 600) described by the message (`aria-describedby`).
- [x] `src/ui/components/Dialog.tsx`: a modal (`role="dialog"`, `aria-modal`, labelled by its title and described by its text) over a `--fd-overlay` backdrop, a white card of at most 480 px, radius `--fd-radius-dialog`, padding 28 px, title in `--fd-font-display` 22 px; its buttons are right-aligned pills 42 px high: a secondary one and an optional danger one filled `--fd-danger-strong`. It keeps the behaviour of today's `DeleteProjectDialog` (spec 007): focus starts on the secondary button, `Tab` stays inside, `Escape` and a click on the backdrop cancel, focus returns to the opener when it closes.
- [x] `src/ui/components/EmptyState.tsx`: a centred white card of at most 720 px, radius 18 px, padding 40 px, with an optional eyebrow line (13 px, `--fd-accent`, 600), a title (`h1`, 32 px display), a paragraph, an optional numbered list whose numbers sit in 32 px `--fd-accent-soft` circles, and an optional footnote under a `--fd-border-2` line.
- [x] `src/ui/components/StatusLine.tsx`: the one-line page states (`Loading…`, the unreachable message, `No activity in this period.`): 14 px, `--fd-muted`, 24 px vertical padding.
- [x] Storybook stories: `TopBar` (first link current, last link current, at 360 px), `PageHeader` (plain, with back link, headline with a token amount, with period pills, at 360 px), `Panel`, `SplitPage` (wide, narrow), `DataTable` (plain, grouped with a total, scrolling at 360 px), `WarningBanner` (one message with an action, two messages), `Dialog` (with a `play` checking focus, `Tab` and `Escape`), `EmptyState`, `StatusLine`. They pass the axe check of `src/ui/stories.test.tsx`.

## Rules

- Components take their content from the caller; none reads the URL or an API.
- Sizes and colours come from the tokens of spec 014 only.
- No layout shift: `PageHeader` with `pending` keeps the summary line's height while it loads, and the header slot (period pills) is aligned with the top of the title, so the header looks the same on every page and in every state.
- Existing `Layout`, `FactoryBanner`, `DeleteProjectDialog` and `WelcomePanel` keep working as they are; spec 023 moves them onto these components.

## Expected proof

- The stories above, with their `play` functions, pass axe.
- Screenshots of `TopBar`, `PageHeader` and `DataTable` at 360 px and 1280 px, attached to the pull request.

## Out of scope

- Using these components on the app's pages (spec 023 onwards).
- A side navigation, breadcrumbs, a dark theme.
