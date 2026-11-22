# 022 · Issue threads and role split in the API

Status: done
Depends on: 021
Checked: 2026-11-22

## User goal

A developer sees, on every issue of the redesigned features list, how its tokens split between roles, and on the issue page, the threads that worked on it in the order they ran. This spec adds that data to the features API; the pages use it in specs 025 and 026.

## Acceptance criteria

- [x] Each issue row of `GET /api/features` gets `roles`: one entry per role with calls on that issue in the period (role of spec 006), each with `role`, `tokens`, `tokenCounts` (spec 021) and `costUsd`, sorted by tokens descending, then a last entry for the orchestration role of spec 010 when the issue has an orchestration share. The entries' tokens add up to the row's `tokens`.
- [x] `GET /api/features/<n>?project=<root>` gets `threads`: each thread of spec 006 whose work item is the issue and that has at least one call in the period, with `sessionId`, `sessionTitle`, `threadId`, `role`, `description` (the sub-agent description, or `null` for a session's main thread), `firstAt` and `lastAt` (its first and last call in the period), `tokens`, `tokenCounts` and `costUsd`; sorted by `firstAt`, then by `threadId`.
- [x] The threads' tokens plus the issue's orchestration share (the `orchestration` row of spec 010) add up to the issue's tokens on the list, for the same period and project.
- [x] A main-thread session with the issue as its work item (spec 006) appears as one thread with `description: null`; a sub-agent appears as its own thread, even when its session works on several issues.
- [x] An issue with calls only through the orchestration share has an empty `threads` list.
- [x] No existing field changes; the current UI keeps working unchanged.

## Rules

- **Thread**: a session's main thread or one of its sub-agents (spec 002), with the role and work item spec 006 gives it.
- The orchestration share is not a thread: it stays in the `orchestration` row of spec 010.
- The period and project filters apply as for the rest of the features API.

## Expected proof

- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), over synthetic sessions: role split of an issue with two roles and an orchestration share; threads of an issue built by a sub-agent, reviewed by two sub-agents of another session, and worked on by a main thread; ordering; a period cut-off that leaves one thread out; the sums of the criteria.
- `pnpm demo`, then `curl` of `/api/features/<n>?project=<root>` for a demo issue shows its threads; the output is pasted in the pull request.

## Out of scope

- Any change to the UI.
- Grouping threads into timeline steps (spec 026).
- Review rounds or outcomes per thread.
