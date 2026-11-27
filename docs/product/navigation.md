# Navigation and conventions

What every page shares: the first-manager screen, the sign-in screen, the unreachable screen, the sidebar, the project select, the period, the refresh, the theme, the banners, and how figures, empty states and errors read.

FactoryDeck serves its pages and its JSON API from one Node process, on `127.0.0.1` only (`FACTORYDECK_PORT`, default 4317). Any path that is not `/api/…` serves the app, so a reload or a shared link works on every page.

## Sidebar

A left sidebar holds, from top to bottom: the brand, the project select, the links `Overview`, `Features`, `Bugs`, `Stats`, `Frictions`, `Sessions`, `Skills`, `Roles` (each with its icon), and for a manager `Team` (see [The Team page](accounts.md#the-team-page)), then at the bottom the refresh control, the theme button and the fold button, then a small muted credit line, `Open source · by CGSeb` followed by a `GitHub` link (icon and text) to FactoryDeck's own repository, `https://github.com/CGSeb/factorydeck`. The link opens in a new tab and its accessible name is `FactoryDeck on GitHub`; the line is the same on every page, welcome screen included, and needs no data. After the credit line, at the very bottom, comes the account menu (below). The current link is highlighted and has `aria-current="page"`. `Bugs` shows only when at least one project of the selection has a [bug label](outcomes.md#kinds) (any project with `All projects`, the selected one otherwise); otherwise it is absent. The API gives these projects as `bugTickets`, the list of their roots, in `GET /api/projects/factory`. The last list received is kept in `localStorage` (`factorydeck.bugTickets`, removed when empty), so the link is in place from the first paint and stays while the database does not answer; a missing or unreadable value means no project. Deleting a project removes it from that list at once, so its `Bugs` link goes with it. `Team` shows only once `GET /api/auth/me` answers a manager: it is the same read as the account menu's, once each time the app enters the signed-in dashboard. While that read loads, or when it answers `401`, `503` or nothing, there is no `Team` link. Its icon is two people in outline; being the last link, its appearance moves no other link, and folded its tooltip reads `Team`.

`Features` and `Bugs` each carry a small badge on the right of their name, on the same line: the number of issues the factory can take now, the features and the bugs at [stage](outcomes.md#stages) `Ready`. The `Features` badge is in a neutral, muted tone; the `Bugs` badge is in the danger tone, as the `Bug` badge of the features list; both stay readable on the highlighted link. A count of 0 shows no badge, and a count above 99 shows `99+`. The badge's text is hidden from assistive technologies: the link's accessible name is `Features, <n> ready` or `Bugs, <n> ready`, with the exact count, and stays `Features` or `Bugs` without a badge. The badge never moves the link's name or icon, nor changes its height.

- **What counts.** A ready issue is an open issue whose current stage is `Ready`: it carries the `ready` label of `issues.labels` and none of `blocked`, `needs_spec`, `review`, `working`, and no pull request closing it was merged. Its [kind](outcomes.md#kinds) comes from its current labels; in a project without a bug label every ready issue counts under `Features`. The counts read every issue the [git host collection](data.md#git-host) stores for the projects of the selection, with or without a call, so a ready issue no agent has touched yet counts, and a project whose collection failed counts from its last stored data. They are not the `Ready` column of the overview board nor the `Ready` group of `/features`, which hold only issues with a call in the period.
- **Selection.** The counts follow the project select: the sum over every project with `All projects`, that project only otherwise, and no badge for an unknown project. They do not depend on the period, and the sidebar links still carry only `project`. The `Bugs` badge shows only with the `Bugs` link.
- **Refresh.** The counts reload on the refresh interval and after each collection, without a reload of the page. While they reload (a project change, a refresh), the last badges stay on screen until the new counts arrive. Before the first counts arrive, and while the database does not answer at first, no badge shows; once shown, badges keep their last values while the database does not answer.
- **API.** `GET /api/sidebar?project=<root>` answers `{ "ready": { "feature": <f>, "bug": <b> } }`. Without `project`, or with `project=` empty, it counts every project; an unknown project answers 0 for both, and `503` when the database does not answer.

- **Folded**, it is a column of icons with an `FD` monogram; each link shows its name in a tooltip on hover and focus. The ready count of `Features` and `Bugs` becomes a small pastille on the top-right corner of the link's icon, with the same value, tone and `99+` limit, and the tooltip reads `Features · <n> ready` or `Bugs · <n> ready` (`Features` or `Bugs` alone at 0). The credit line becomes a GitHub icon link to the same repository, whose tooltip reads `Open source · by CGSeb on GitHub`. The project select becomes an icon button `Project: <label>` that unfolds the sidebar and opens the select, then folds back once a project is chosen. The fold choice is kept in `localStorage` (`factorydeck.sidebar`); the sidebar starts expanded when the key is missing, unknown or unreadable.
- **Below 768 px**, a bar at the top shows a menu button (`Open navigation`) and the brand. The button opens the sidebar, always expanded and with its badges as the expanded sidebar shows them, as a drawer over a backdrop: focus stays inside it, the page behind does not scroll, and `Escape`, the backdrop, the close button or following a link close it and give the focus back to the menu button. Growing the window past 768 px closes it.

- **Account menu.** The last item of the sidebar is a button with the signed-in account's name and its role (`Manager` or `Dev`); a long name is cut with an ellipsis and shows in full in its tooltip. Its accessible name is `Account: <name>, <Role>`. It opens upward, above the button, a menu with the account's email in muted text (wrapped anywhere, never cut), a separator, then `Sign out` with an icon. Enter and Space open and close it, opening moves the focus to `Sign out`, and `Escape` closes it and gives the focus back to the button; a click outside or the focus leaving the menu close it. The button carries `aria-expanded`. In the narrow-screen drawer, `Escape` closes the menu first, and a second `Escape` closes the drawer. Folded, the button shows the account's initials (the first letter of the first and of the last word of the name, upper case: `Ada Lovelace` → `AL`; one letter for a one-word name), its tooltip reads `<name> · <Role>`, and the menu opens as a popover beside it while the sidebar stays folded. The menu shows on every page with a sidebar, the welcome screen and the drawer included, never on `/setup`, the sign-in screen or the unreachable screen.
  - **Account.** The app reads `GET /api/auth/me` once each time it enters the dashboard (first load, after the first manager is created, after each sign-in), not on each page; a `401` from that read opens the [sign-in screen](accounts.md#the-sign-in-screen). While it loads, the button keeps its size with two muted bars in place of the name and role (a muted circle when folded). When it answers a `503`, a network error or an unexpected answer, the placeholder stays and the button cannot be opened.
  - **Signing out.** `Sign out` sends `POST /api/auth/sign-out` with no body; while it runs it reads `Signing out…` and is disabled. On `204` the app loads `/sign-in` (with no `next`) as a full page load that replaces the current history entry, so no page data stays in memory or comes back with Back. A failure keeps the page and the menu open, with `Database unreachable. Start it with pnpm db:up.` under `Sign out` on a `503`, `Could not reach the server` on a network error or any other answer; the session is still open, so the person can try again.

## Project select

One select, with no visible label (accessible name `Project`), chooses the project of every page: `All projects` first (the default), then every project with stored sessions by display name, case-insensitive. It lists every project, with no limit.

- The choice is the `project` URL parameter (the project root), nothing else: no browser storage, no server setting. `All projects` removes it; `?project=` empty means `All projects`. A root is matched exactly: a trailing `/` or another letter case is an unknown project.
- An unknown project shows as an extra selected option (its folder name) and the pages show no data for it.
- On a list page, choosing a project stays on the page and keeps its other parameters; the session list starts again from its first page. On a session page it opens `/sessions` with that project; on an issue page, `/features`, or `/bugs` on a bug's page; both keep `period`.
- The sidebar links and the links inside pages carry `project` and only that. A link that names its own project (an issue row, a dot on a chart) keeps it.
- The select is hidden while FactoryDeck holds no session. A deleted project leaves it at once; if it was selected, the select falls back to `All projects`.
- With `All projects`, project columns and project tags show; with one project they are hidden.

## Period

`Today`, `Last 7 days` (the default), `Last 30 days` and `All time`, as pills on the right of each page header. The choice is the `period` URL parameter (`today`, `7d`, `30d`, `all`), per page: the sidebar links do not carry it.

- A call, a merge or a friction belongs to a period by its time, in the browser's local time zone; `Today` starts at local midnight. APIs that cut by period take the time zone as `tz`.
- The **previous period** is the same length just before (`Today` → yesterday). `All time` has none.

## Refresh

Every figure refreshes without a reload: after each ingestion (every few seconds) and each collection (every few minutes). The refresh control at the bottom of the sidebar shows `Issues updated <relative time>` (`Issues not collected yet` before the first run) and a refresh button that starts a collection at once; while it runs, it reads `Refreshing…`, and if one is already running it waits for that one.

## Theme

`System` (the default), `Light` or `Dark`. The theme button cycles through them; its accessible name is `Theme: <choice>`. `System` follows the device and switches live. The choice is kept in `localStorage` (`factorydeck.theme`, removed for `System`); a missing, unknown or unreadable value means `System`. The theme is applied before the first paint, so a dark page never flashes light.

## Banners

A warning banner above the content of every page lists, one line per project in name order:

- `Factory configuration not found for <project name>: <root>/docs/agents/factory.yml. Its data is kept, but new sessions are no longer read.`, with a `Delete project` button ([Data](data.md#deleting-a-project));
- `Could not read <GitHub|GitLab> for <project name>: <reason>.` for a failed collection, without a button.

## First-manager screen

While the instance has no account, every page opens `/setup`, the [first-manager screen](accounts.md#the-first-manager-screen), without the sidebar, the banners or the welcome screen, and the app loads no data. Once the first manager is created, the app opens `/`, and `/setup` opens `/` from then on.

## Sign-in screen

When the app loads, it reads `GET /api/auth/state`, then `GET /api/auth/me` only when `setup` is `false`, and calls no data route before `/me` answers an account. A page opened without a session shows the [sign-in screen](accounts.md#the-sign-in-screen) at `/sign-in?next=<the page asked for>`, without the sidebar, the banners or the welcome screen; once signed in, the app opens that page, path, query and hash included. The same happens when the API answers `401` while the app is open (a session that expired or was closed elsewhere): the next click or refresh that reaches the API opens the sign-in screen with `next` set to the current page, and the page loads afresh after the sign-in. A signed-in person who opens `/sign-in` goes to its `next`, or `/`.

## Invitation screen

`/invite/<token>` opens the [invitation screen](accounts.md#the-invitation-screen), with or without a session, without the sidebar, the banners or the welcome screen: it skips the sign-in redirect. The app reads `GET /api/auth/state`, then `GET /api/auth/me`, as on any load: `setup: true` opens `/setup`, an account adds a line naming it, a `401` shows the screen without that line, and any other failure shows the unreachable screen. It then reads the invitation and calls only `/api/auth/*`. Creating the account enters the signed-in dashboard as a sign-in does: `/` opens in place of the invitation screen in the history, and the sidebar's account menu and `Team` link come from one `GET /api/auth/me`.

## Unreachable screen

When the state or the account cannot be read at load (no answer, a `503`, or any other answer than the ones expected), the app shows the [unreachable screen](accounts.md#the-unreachable-screen) at the address asked for, without the sidebar, and loads no data until `Retry` succeeds.

## Welcome screen

While FactoryDeck holds no session, every page shows the welcome screen instead of its content: eyebrow `No factory project yet`, title `Install the factory in a project`, the text `FactoryDeck shows the projects that use the factorydeck-skills workflow. None of yours does yet.`, three numbered steps (install factorydeck-skills, with a link to its install steps; run `/setup-factory` in the project; work in it with a coding agent), and the footnote `The project select appears once a project has sessions.` It goes at the first ingestion that stores a session.

## Figures and formats

- **Tokens** are the sum of the four kinds (input, cache write, cache read, output). They show in compact form (`950`, `12.4K`, `12.4M`) with tabular figures. Hovering or focusing an amount shows its exact number, its cost and its split into the four kinds; the total is always the sum of the four counts shown, so the number and its tooltip never disagree.
- **Cost** is an estimate at API list prices (`src/pricing.ts`), in US dollars with two decimals and `~$`, `<$0.01` for a non-zero cost below a cent. A model with no known price counts in tokens and calls; its cost shows `—` and is left out of cost totals.
- A missing value (model, branch, type, score) shows `—`.
- **Durations**: `3 h 05 min`, `1 d 4 h`. **Relative times**: `3 min ago`. **Dates**: `18 Nov`, `22 Nov, 17:33`.
- **Totals agree**: for the same period and project, the token totals of the overview, features, roles, skills and sessions are equal, and every list's rows add up to its total.

## Loading, empty and errors

- Each block of a page loads and fails on its own: one slow or failing API never hides another block. A block shows `Loading…`, or the unreachable message, by itself.
- While a filter, the period or the project changes, the last data stays on screen until the new data arrives; a header whose figures are loading keeps its height, so nothing moves.
- With no call in the period: `No activity in this period.`
- An unknown session, issue or skill shows its not-found text with a link back to its list.
- When the database does not answer, the page says `Database unreachable. Start it with pnpm db:up.`; the server keeps running and retries. `GET /api/health` answers `200` with `{"status":"ok","database":"ok"}`, or `503` with `{"status":"degraded","database":"unreachable"}`. An unknown `/api/` path answers `404` with `{"error":"Not found"}`; invalid parameters answer `400`.
- From 1024 px wide nothing scrolls horizontally; tables wider than the page scroll inside their box. From 360 px no page scrolls horizontally.
