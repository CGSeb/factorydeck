# 021 · Token breakdown in the APIs

Status: done
Depends on: 010
Checked: 2026-11-22

## User goal

A developer hovering any token amount in the redesigned FactoryDeck sees its cost and its split into input, output, cache read and cache write tokens. For that, every figure the JSON API returns as tokens comes with its four counts. This spec changes the API only; the pages keep their look until specs 023 to 029.

## Acceptance criteria

- [x] Every object of the API responses below that has `tokens` (a number) and `costUsd` also has `tokenCounts: { input, output, cacheRead, cacheWrite }` (the `TokenCounts` type of `src/overview/types.ts`), whose four values add up to its `tokens`:
  - `GET /api/overview`: each `projects` and `models` row;
  - `GET /api/sessions`: each session row; `GET /api/sessions/<id>`: each sub-agent and each skill row;
  - `GET /api/skills`: each skill row; `GET /api/skills/<name>`: the skill itself and each session row;
  - `GET /api/roles`: each role row;
  - `GET /api/features`: each issue row, the `noWorkItem` row and the totals; `GET /api/features/<n>`: each role row, the orchestration row and each session row.
- [x] Objects whose `tokens` is already a `TokenCounts` (the overview totals, the session detail) are unchanged.
- [x] Each point of the overview `series` gets `tokens`, the `TokenCounts` of its bucket (all families together), next to its cost per family, so a chart can show tokens per day or per hour.
- [x] The `merged` summary of `GET /api/features` gets `tokensPerIssue`: the total tokens of the merged issues in the period, orchestration share included, divided by their number, rounded to a whole number; `null` with no merged issue.
- [x] Each issue row of `GET /api/features` gets `lastAt`: the time of its latest call in the period (orchestration share left out), as an ISO date.
- [x] Where an issue's or a role's tokens include the orchestration share of spec 010, each of its four counts includes that share too, split with the same weights; counts are summed before rounding and rounded to whole numbers for the response only, so `tokens` stays the sum of the rounded counts (the rounding difference goes to the largest count).
- [x] For the same period and project, the four counts of the `features` totals equal those of the overview totals, and each list's counts add up to its totals.
- [x] No existing field changes name, type or meaning; the current UI keeps working unchanged.

## Rules

- A call's counts are the input, output, cache read and cache write tokens stored by the ingestion (spec 002); nothing new is ingested.
- Calls with an unknown price count in tokens like any other; only `costUsd` treats them as today (spec 003).
- The API schemas (zod) and TypeScript types are updated with the new fields.

## Expected proof

- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), over synthetic sessions: the counts of each response listed above add up to `tokens`; the features totals equal the overview totals per kind; an orchestration share split across two issues keeps the sums exact; `tokensPerIssue` with none, one and several merged issues; `lastAt` of an issue; the series' `tokens` per bucket for a day period and the `Today` hourly period.
- `pnpm demo`, then `curl` of `/api/features` and `/api/overview` shows the new fields; the output is pasted in the pull request.

## Out of scope

- Any change to the UI.
- Prices, pricing rules or new stored data.
- The per-issue role split and the issue threads (spec 022).
