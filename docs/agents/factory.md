# Factory

How this repository runs its agent workflow. The factorydeck skills (`write-spec`, `check-spec`, `build-feature`, `retro`) and the stop gate read this file. `/setup-factory` wrote it; edit it by hand whenever the workflow changes. Keep the `- Name: value` lines on one line each: the stop gate reads `Check command`, `Stop gate` and `Main branch` from them.

## Repository

- Git host: GitHub
- Git host commands: `docs/agents/git-host.md`
- Main branch: `main`
- Merge method: squash

Every issue, pull request, label, CI and merge operation the skills name in **bold** is a command of `docs/agents/git-host.md`.

## Agents

- Coding agents used here: Claude Code
- Instructions file: `AGENTS.md` (`CLAUDE.md` imports it)
- Project skills folder: `.claude/skills/`
- Model for spec checks: opus
- Model for workers: session default
- Model for reviewers: session default
- Model for shippers: haiku

Each model is a name the coding agent that runs `build-feature` accepts when it starts a subagent, or `session default`. An agent that cannot choose a subagent's model, or does not know the name, uses its own.

## People

- Language for people: English
- Hand work to: `@me`

Every issue comment, question, pull request body and score report is written in the language for people. Skills, code and commit messages stay in English, as the repository already writes them.

## Checks

- Check command: `pnpm check`
- Stop gate: on
- Verification skill: none
- Services check: `docker info >/dev/null 2>&1`
- Services start: `pnpm db:up`

The services check fails when Docker does not answer: the person starts Docker Desktop by hand. Agents never start Docker Desktop themselves. `pnpm db:up` starts PostgreSQL 18 on `127.0.0.1:5434` and waits until it is healthy; run it from the main checkout only, never from a worktree. A worktree links `.env` from the main checkout.

Narrower checks while building: `pnpm vitest run <file>` for one test file, `pnpm typecheck`, `pnpm lint`. Schema changes go in `src/db/schema.ts`, then `pnpm db:generate --name <change>`; never edit a generated migration.

## Specs

- Specs folder: `docs/specs/`
- Spec file name: `NNN-short-name.md`
- Product context: `README.md`

The spec format. Each line below names the text this repository uses for that part of a spec; the skills look for these exact strings.

| Part                 | Text in this repository  |
| -------------------- | ------------------------ |
| Status line          | `Status:`                |
| Status values        | `draft`, `ready`, `done` |
| Depends-on line      | `Depends on:`            |
| Checked line         | `Checked:`               |
| User goal section    | `## User goal`           |
| Criteria section     | `## Acceptance criteria` |
| Rules section        | `## Rules`               |
| Proof section        | `## Expected proof`      |
| Out-of-scope section | `## Out of scope`        |

## Issues

- Issue title: `NNN · Name`
- Dependencies: blocking links of the git host

| Role                           | Label              |
| ------------------------------ | ------------------ |
| A spec's issue                 | `spec`             |
| Ready to build                 | `agent:ready`      |
| An agent is building it        | `agent:working`    |
| Waiting for a product answer   | `agent:needs-spec` |
| Pull request waiting for merge | `agent:review`     |
| Blocked                        | `agent:blocked`    |

## Build

- Parallel workers: 3
- Branch name: `feat/<NNN>-<short-name>`
- Pull request title: `feat: :sparkles: <Subject>`
- Auto-merge: on
- Serenity threshold: 80
- Main branch protection: off while the repository is private (GitHub needs a paid plan); turn it on, requiring the `check` job of `.github/workflows/ci.yml`, when the repository goes public. Until then the merge gate is this file's prose.

Commit messages follow `type: :gitmoji: Subject` (for example `fix: :bug: …`, `test: :white_check_mark: …`, `docs: :memo: …`), checked by the `commit-msg` hook.

## Protected paths

A pull request that changes one of these needs a person, whatever its score: they hold the rules the agents are graded by.

- `AGENTS.md`, `CLAUDE.md`, `docs/agents/`, `.claude/`, `.github/`
- `.oxlintrc.json`, `tsconfig.json`, `.prettierrc.json`, `.prettierignore`, `lefthook.yml`, `.lefthookrc`, `scripts/check-commit-message.ts`
- the `check`, `lint`, `typecheck` and `test` scripts of `package.json`

## Rules for the reviewer

- Nothing workflow-specific is hard-coded: no project, repository, path, role name, label, issue pattern or workflow step. It comes from user configuration, with defaults that work on a plain Claude Code setup.
- No real session data, costs or project names in code, tests, fixtures or docs: only small synthetic examples.
- Data that matches no configuration rule is still counted, as « unassigned », never dropped.
- Imports use the `.ts` extension, and only erasable TypeScript syntax is used (no enums, no namespaces).
