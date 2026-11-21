# 001 · App skeleton

Status: done
Depends on: none
Checked: 2026-11-21

## User goal

A developer starts FactoryDeck with one command and opens it in their browser, on their own machine only, and sees whether it reaches its database. Later views plug into this server and page.

## Acceptance criteria

- [x] `pnpm build` builds the UI. `pnpm start` serves the built UI and the JSON API from one Node process, bound to `127.0.0.1` on port `FACTORYDECK_PORT` of the root `.env` (default `4317`), and prints `FactoryDeck on http://127.0.0.1:<port>`.
- [x] When the UI was never built, `pnpm start` still starts and serves the API, and `/` answers with the plain text `UI not built. Run pnpm build.`
- [x] A port already in use ends `pnpm start` with exit code 1 and `Port <port> is already in use. Set FACTORYDECK_PORT in .env.`
- [x] `pnpm dev` starts the API and the Vite dev server together (UI on `http://127.0.0.1:5173`), with `/api` proxied to the API, and reloads the page on UI changes.
- [x] `GET /api/health` answers `200` with `{"status":"ok","database":"ok"}` when the database answers, and `503` with `{"status":"degraded","database":"unreachable"}` when it does not; the server keeps running either way.
- [x] Any other `/api/` path answers `404` with `{"error":"Not found"}`; any other path serves the UI, so a reload on a client route works.
- [x] The page at `/` (browser tab title `FactoryDeck`) shows the heading `FactoryDeck` and the health result read once on load: `Database connected.` or `Database unreachable. Start it with pnpm db:up.`
- [x] Invalid environment variables end start-up with the existing message of `src/config/env.ts`, listing every invalid variable.
- [x] `pnpm check` covers the new code (format, lint, types, tests) and stays green.

## Rules

- The API is a thin, stateless [Hono](https://hono.dev/) app (decision recorded in issue #4): no session state in memory beyond caches, so authentication can be added later as middleware.
- Route inputs are validated with zod; queries go through Drizzle.
- Only erasable TypeScript syntax, `.ts` imports, run by Node without a build step for the server.

## Expected proof

- Vitest tests of `/api/health` (database up and down), of the `404` route and of the UI fallback.
- On the real app: `pnpm build && pnpm start`, then `curl http://127.0.0.1:4317/api/health` prints `{"status":"ok","database":"ok"}` and the browser shows `Database connected.`; with the database stopped (`pnpm db:down`) the same curl answers `503`.

## Out of scope

- Any view or the ingestion (specs 002 to 005).
- Authentication, accounts, or listening on another address than `127.0.0.1` (planned for a later, team version).
- NestJS or any framework that needs decorators.
- Refreshing the health result without a reload; automatic refresh comes with spec 003.
