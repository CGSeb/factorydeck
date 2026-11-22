# 023 · App shell

Status: done
Depends on: 019
Checked: 2026-11-22

## User goal

A developer opening any FactoryDeck page sees the new top bar with the project select and refresh control, the new warning banner and delete dialog when a project lost its factory file, and the new welcome screen before any session exists. The page contents keep their current look until specs 024 to 029.

## Acceptance criteria

- [x] Every page uses the `TopBar` of spec 019 instead of today's header, with the links `Overview`, `Features`, `Sessions`, `Skills`, `Roles` and, in its right slot, the `ProjectPill` and `RefreshControl` of spec 017. The behaviour of specs 008 and 013 is unchanged: the links carry the `project` parameter, the select reads and writes it, the refresh control collects.
- [x] `src/ui/design/tokens.css` and the fonts of spec 014 are loaded by the app; `body` uses `--fd-font-body`, `--fd-ink` text and the `--fd-page` background; the main column is `--fd-page-max` wide, centred, with `--fd-gutter` padding (16 px below 480 px wide).
- [x] The factory banner of spec 007 uses `WarningBanner` (spec 019), under the top bar, with the same messages: `Factory configuration not found for <name>: <file>. Its data is kept, but new sessions are no longer read.` with a `Delete project` button, and each collection failure of spec 008 (`failureMessage`) without a button.
- [x] The delete confirmation of spec 007 uses `Dialog` (spec 019) with today's wording, states (`Deleting…`, errors) and behaviour.
- [x] While FactoryDeck holds no session, the welcome screen of spec 007 uses `EmptyState` (spec 019): eyebrow `No factory project yet`, title `Install the factory in a project`, today's paragraph and three numbered steps, and the footnote `The project select appears once a project has sessions.`; the project select is not shown (spec 013).
- [x] At 360 px wide, no page scrolls horizontally: the top bar wraps as spec 019 says and the banner's button goes under its message.
- [x] The old `Layout` header markup and its CSS rules in `src/ui/styles.css` are removed; `FactoryBanner`, `DeleteProjectDialog` and `WelcomePanel` keep their names and stories, now built on the components of spec 019.

## Rules

- Page bodies (`/`, `/features`, `/sessions`, `/skills`, `/roles` and their detail pages) are not restyled here; they may look mixed until their own spec.
- Mockups: `docs/design/b4/welcome.html`, `docs/design/b4/missing.html` and the top bar of every file of `docs/design/b4/`.

## Expected proof

- The stories of `Layout`, `FactoryBanner`, `DeleteProjectDialog` and `WelcomePanel` are updated for the new look and pass the axe check of `src/ui/stories.test.tsx`, with the `play` functions of spec 013 still passing.
- On the real app, with `pnpm demo`: screenshots of the overview with the top bar at 360 px, 1280 px and 2560 px, of the banner with the dialog open (a demo project whose factory file is removed), and of the welcome screen (an empty sessions folder), attached to the pull request.

## Out of scope

- Restyling the page bodies (specs 024 to 029).
- New navigation entries or a side navigation.
