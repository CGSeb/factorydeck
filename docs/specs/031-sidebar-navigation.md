# 031 · Sidebar navigation

Status: done
Depends on: 023
Checked: 2026-11-22

## User goal

A developer moving between FactoryDeck views uses a left sidebar, like a dashboard, where each view has an icon and a name, with the project select and the refresh control at hand. They can fold it to a column of icons to give the pages more room, and open it as a drawer on a phone.

## Acceptance criteria

- [x] `src/ui/components/Icon.tsx` draws the icons as inline SVG (24 × 24 view box, `stroke="currentColor"`, stroke width 2, round caps, no fill, `aria-hidden="true"`), at 20 px by default, with one name per icon: `overview` (four squares in a grid), `features` (three stacked layers), `sessions` (a terminal window with a prompt), `skills` (a lightning bolt), `roles` (two people), `collapse` (a panel with a left chevron), `expand` (a panel with a right chevron), `menu` (three lines), `close` (a cross), `project` (a folder), `refresh` (today's arrow of `RefreshControl`). No icon package is added to `package.json`.
- [x] `src/ui/components/Sidebar.tsx` replaces `TopBar`: an `aside` on `--fd-surface` with a right `--fd-border` line, the full height of the window and fixed while the page scrolls (its own content scrolls when the window is too short). From top to bottom: the brand `Factory` + `Deck` of spec 019; a slot for the project select; a `nav` with accessible name `Sections` holding the links given by the caller, each with its icon and label; then, pushed to the bottom, a slot for the refresh control and the fold button.
- [x] Expanded, the sidebar is `--fd-sidebar-width` (232 px) wide. Each link is 40 px high, 12 px side padding, radius `--fd-radius-card`, icon then label 12 px apart, 14 px text, `--fd-ink-2`, hover background `--fd-surface-2`; the current one has `aria-current="page"`, background `--fd-accent-soft`, text and icon `--fd-accent-ink`, weight 600. The project select is the `ProjectPill` of spec 017 at the full width of the sidebar; the refresh control is the `RefreshControl` of spec 017, its status text (`Issues updated 3 min ago`) shown beside its button, in the expanded sidebar and in the drawer, even below 480 px (ellipsed when too long).
- [x] Folded, the sidebar is `--fd-sidebar-collapsed` (64 px) wide and shows the icons only, centred, with no brand text but a `FD` monogram in `--fd-accent`. Each link keeps its label as its accessible name and shows it in a tooltip on hover and keyboard focus, to the right of the icon. The project select becomes a 40 px icon button `project` whose accessible name and tooltip are `Project: <label>` (`Project: All projects` with none chosen); activating it unfolds the sidebar and opens the select; once a project is chosen or the select closes, the sidebar folds back by itself and `localStorage` keeps `collapsed`. The refresh control becomes its 40 px icon button alone, its status text in its tooltip and kept in its accessible name as today.
- [x] The fold button sits at the bottom of the sidebar: icon `collapse` with accessible name `Collapse sidebar` when expanded, icon `expand` with `Expand sidebar` when folded, with `aria-expanded` saying whether the sidebar is expanded. The choice is kept in `localStorage` under `factorydeck.sidebar` (`expanded` or `collapsed`) and restored on the next visit; the sidebar starts expanded when the key is missing, holds another value or `localStorage` throws.
- [x] Below 768 px wide, the sidebar is hidden and a bar `--fd-topbar-height` high, on `--fd-surface` with a bottom `--fd-border` line, sticky at the top of the page, shows a `menu` icon button (accessible name `Open navigation`, `aria-expanded`, `aria-controls` the drawer, set only while it is open) then the brand. The button opens the sidebar, always expanded, as a drawer from the left over a `--fd-overlay` backdrop: a modal `dialog` named `Navigation`, with a `close` icon button (`Close navigation`) at its top. The page behind the open drawer does not scroll; its scrolling comes back when the drawer closes. Focus moves into the drawer and stays inside it on `Tab`; `Escape`, a click on the backdrop, the close button or following a link close it, and focus returns to the menu button. The fold button and the folded state do not exist below 768 px. When the window grows to 768 px or more while the drawer is open, the drawer and its backdrop close and the sidebar shows in its kept state (expanded or folded).
- [x] `Layout` uses `Sidebar` with the links `Overview`, `Features`, `Sessions`, `Skills`, `Roles` in this order and their icons of the same name. The behaviour of specs 008 and 013 is unchanged: the links carry the `project` parameter, the select reads and writes it, the refresh control collects, and the select is not shown while FactoryDeck holds no session (spec 007); the folded `project` button is then not shown either.
- [x] The page content sits to the right of the sidebar: the `WarningBanner` of spec 023 at the top of that area, then the main column (`--fd-page-max`, centred in the remaining width, `--fd-gutter` padding). No page scrolls horizontally from 360 px to 2560 px wide, expanded or folded.
- [x] `TopBar` and its CSS rules in `src/ui/components/layout.css` are deleted with its stories; nothing imports them.
- [x] Storybook stories: `Icon` (every icon side by side, with its name), `Sidebar` (expanded with the first link current, expanded with the last link current, folded, folded with the tooltip of a link shown, without the project select as on the welcome screen, drawer open at 360 px), with `play` functions checking that the fold button folds and unfolds and writes `localStorage`, that the folded `project` button unfolds the sidebar and opens the select, and that the drawer keeps focus inside, closes on `Escape` and gives focus back to the menu button. The `Layout`, `App` and `LayoutProjectSelect` stories show the sidebar, with the `play` functions of spec 013 still passing. All pass the axe check of `src/ui/stories.test.tsx`.

## Rules

- `--fd-sidebar-width: 232px` and `--fd-sidebar-collapsed: 64px` are added to `src/ui/design/tokens.css`; every other size and colour comes from the tokens of spec 014.
- Fold and unfold are not animated when `prefers-reduced-motion: reduce` applies; otherwise the width changes in at most 150 ms.
- `Sidebar` takes its links, their icons and its slots from the caller; it reads neither the URL nor an API. Only the fold state is its own, through `localStorage`.
- The `localStorage` value is a per-browser comfort setting, never sent to the server.
- The fold button is an icon button alone, under the refresh control; folded, it shows its accessible name in a tooltip like the links.
- `Escape` or a scroll hides a folded tooltip.
- In the sidebar, the project select's list is as wide as the pill: long project names are ellipsed, and the list scrolls inside its own maximum height.

## Expected proof

- The stories above, with their `play` functions, pass axe.
- On the real app, with `pnpm demo`: screenshots of the overview with the sidebar expanded and folded at 1280 px, expanded at 2560 px, of the folded tooltip on `Features`, of the drawer open at 360 px, and of the welcome screen (an empty sessions folder), attached to the pull request.

## Out of scope

- New views or navigation entries, sub-entries under a view, badges or counts on the links.
- Breadcrumbs, a dark theme, a user-chosen order of the links.
- Restyling the page bodies.
- Keyboard shortcuts to fold the sidebar or switch views.
