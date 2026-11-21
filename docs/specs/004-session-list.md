# 004 · Session list

Status: done
Depends on: 002, 003
Checked: 2026-11-21

## User goal

A developer sees at a glance which of their agent sessions are working, which are waiting for them and which are inactive, with each session's project, branch and spending, and can open one session to see its sub-agents.

## Acceptance criteria

- [x] The navigation bar has a `Sessions` entry, at `/sessions`; `/sessions` and `/sessions/<session id>` are React Router routes, and a reload on either works.
- [x] The list shows one row per session (main sessions only, sub-agents are not rows): state, title (or the first 8 characters of the session id when there is no title), project, branch, last activity (relative, such as `3 min ago`), duration (first to last record), tokens and cost.
- [x] Rows are sorted by last activity, most recent first.
- [x] The state is one of `Working`, `Waiting for you` or `Inactive` (see Rules), shown as a coloured label with its text; counts of each state are shown above the list, such as `2 working · 1 waiting for you · 41 inactive`.
- [x] Filters: project (a list of the projects that have sessions, plus `All projects`, default) and state (`All`, `Working`, `Waiting for you`, `Inactive`; default `All`). The period selector of spec 003 applies, on last activity. Filters are kept in the URL.
- [x] The list shows 50 rows, then a `Show more` button adds the next 50.
- [x] Clicking a row opens `/sessions/<session id>` with: the session header (title, state, project, working directory, branch, first and last activity, tokens with their four kinds, cost), and a table of its sub-agents with type, description, model, first activity, duration, tokens and cost, in start order. A session without sub-agents shows `No sub-agents.`
- [x] An unknown session id shows `Session not found.` with a link back to the list.
- [x] States, times and figures refresh with each re-ingestion of spec 003, without a reload.
- [x] With no session matching the filters, the list shows `No sessions match these filters.`

## Rules

- **Working**: the session's last assistant turn has not ended (spec 002) and its last record is less than `FACTORYDECK_INACTIVE_AFTER_MINUTES` old (root `.env`, default `30`). A long-running command that writes nothing for a while stays `Working` until the threshold.
- **Waiting for you**: the last assistant turn has ended and its last record is less than the same threshold old.
- **Inactive**: the last record is older than the threshold, whatever the turn.
- `FACTORYDECK_INACTIVE_AFTER_MINUTES` is a whole number of at least 1. Environment variables follow spec 001: an empty value means the default, an invalid value ends start-up with the variables listed, and each new variable is documented in `.env.example`.
- The branch is the one spec 002 stores (the `gitBranch` of the last record that carries a working directory); an empty branch shows `—`.
- A session's tokens and cost include its sub-agents, and always cover the whole session: the period only selects which sessions are listed (by last activity), so a row's figures match the session page.
- Turn ended follows spec 002; formats of costs, tokens and missing values follow spec 003.
- Cost and its `—` for unknown prices follow spec 003.

## Expected proof

- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of the state rule at the threshold edges, of sorting, filtering and paging, and of the session detail including sub-agents.
- Storybook stories of the list (with rows, no match, more than 50 rows) and of the session page (with and without sub-agents, not found), with `play` functions for a filter and `Show more`; they pass the axe check of `src/ui/stories.test.tsx`.
- On the real app: with `pnpm start` running, start a Claude Code session, see it `Working`, then `Waiting for you` when it answers; a screenshot of the list and of one session page is attached to the pull request.

## Out of scope

- Acting on a session (stop, resume, send a message) from FactoryDeck.
- Showing prompts, messages, tool calls or a transcript.
- Per-skill figures (spec 005).
- Notifications when a session starts waiting.
