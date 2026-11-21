# 003 · Usage overview

Status: ready
Depends on: 001, 002
Checked: 2026-11-21

## User goal

A developer opens FactoryDeck in their browser and sees, for a period they choose, how many tokens their agents used and what that would cost at API prices, overall, per day, per project and per model, kept up to date while they work.

## Acceptance criteria

- [ ] While the server of spec 001 runs, it runs the ingestion of spec 002 at start-up and then every `FACTORYDECK_INGEST_INTERVAL_SECONDS` of the root `.env` (default `10`, a whole number of at least 1); a run never starts while the previous one is still going.
- [ ] The page has a navigation bar with `Overview` (this spec) and room for the later sections; `Overview` replaces the skeleton page of spec 001 as the home page at `/`.
- [ ] A period selector offers `Today`, `Last 7 days`, `Last 30 days` and `All time`, in that order; default `Last 7 days`. The choice is kept in the URL (`?period=7d`), so a reload or shared link keeps it.
- [ ] Four tiles show, for the period: `Cost` (US dollars, two decimals, prefixed `~$`), `Tokens` (sum of the four token kinds, compact form such as `12.4M`), `Sessions` (sessions with at least one API call in the period) and `API calls`.
- [ ] Under `Tokens`, a breakdown shows input, cache write, cache read and output tokens.
- [ ] A chart shows cost per day over the period (hours for `Today`), one stacked series per model family (`opus`, `sonnet`, `haiku`, `other`). Days without calls show as zero, not as gaps.
- [ ] A table `By project` lists each project with sessions, API calls, tokens and cost, sorted by cost descending; the project `unassigned` is listed like the others.
- [ ] A table `By model` lists each model id with API calls, tokens and cost, sorted by cost descending.
- [ ] Calls of a model with no known price count in tokens and API calls; their cost shows `—` and the `Cost` tile carries the note `Excludes <n> calls with unknown prices.`
- [ ] The page refreshes its figures every interval of re-ingestion without a reload, and shows `Updated <hh:mm:ss>` with the time of the last finished ingestion.
- [ ] With no data at all, the page shows `No sessions yet. FactoryDeck reads <sessions folder>.` instead of the tiles, chart and tables.
- [ ] When the database is unreachable, the page shows `Database unreachable. Start it with pnpm db:up.` and the server keeps running and retries. A database that accepts connections but never answers is shown unreachable within 5 seconds.
- [ ] The layout works from 1280 px wide down to 768 px.

## Rules

- A call belongs to a period by its timestamp, in the browser's local time zone; `Today` starts at local midnight.
- Cost uses `costOf` of `src/pricing.ts`: API list prices, an estimate, labelled as such by the `~`. Everywhere in FactoryDeck, a cost is shown in US dollars with two decimals, and a non-zero cost under $0.01 shows `<$0.01`.
- Everywhere in FactoryDeck, token counts show in compact form (`950`, `12.4K`, `12.4M`, one decimal) with the exact number on hover, and a missing value (model, branch, type) shows `—`.
- The chart is drawn with Recharts; routes and the period in the URL use React Router (decisions recorded in `AGENTS.md`).
- Environment variables follow spec 001: an empty value means the default, an invalid value ends start-up with the variables listed, and each new variable is documented in `.env.example`.
- At most one database health check runs at a time: while one is pending, a new request waits for its result instead of starting another, so a database that never answers holds at most one pool connection for it. Aggregation queries have no time limit of their own.
- Model family `other` holds every model `modelFamily` does not know; its cost is unknown, so it adds nothing to the chart's cost.
- Sub-agent calls count in their parent session's project.
- All figures include every stored call; nothing matching no project is dropped (it shows under `unassigned`).

## Expected proof

- Vitest tests of the API aggregations on a scratch PostgreSQL database (`src/test/postgres.ts`) with synthetic rows (periods, unknown prices, empty data, `unassigned`), and of the health check that never answers (one check at a time, unreachable within 5 seconds).
- Storybook stories of the page states (data, empty, database unreachable, unknown prices), with a `play` function that changes the period; they pass the axe check of `src/ui/stories.test.tsx`.
- On the real app: `pnpm start`, then open `http://127.0.0.1:4317/?period=all` and see the tiles, the chart and both tables; a screenshot is attached to the pull request.

## Out of scope

- Session list and session states (spec 004).
- Per-skill figures (spec 005).
- Retrospectives, frictions, GitHub data, and the factory configuration editor.
- Authentication or access from another machine: the server only listens on `127.0.0.1`.
- Custom date ranges, time zone settings, exports.
