# Contributing to FactoryDeck

Thanks for your interest! FactoryDeck is a universal tool: read [AGENTS.md](AGENTS.md) for its design rules and conventions before you change it. In short, never hard-code a project, role, label or workflow step, and never commit real session data: use small synthetic examples.

## Setup

You need Node.js 24+, pnpm and Docker (or any PostgreSQL 16+ server).

```bash
cp .env.example .env    # then set POSTGRES_PASSWORD and DATABASE_URL
pnpm install
pnpm db:up              # PostgreSQL 18 in Docker, on 127.0.0.1:5434
pnpm db:migrate
pnpm ingest             # read new Claude Code and Codex session logs into the database
pnpm collect            # read issues and pull or merge requests from each project's git host
```

To use your own PostgreSQL server instead of Docker, set `DATABASE_URL` and skip `pnpm db:up`.

## Running it

- `pnpm dev` runs the API and the Vite dev server together: open `http://127.0.0.1:5173`, which reloads on UI changes and proxies `/api` to the API.
- `pnpm build` then `pnpm start` serves the built UI and the JSON API on `http://127.0.0.1:4317`.
- `pnpm build` then `pnpm demo [--port <n>]` serves synthetic sessions and issues on `http://127.0.0.1:4318`, in a `factorydeck_demo_<port>` database of its own. Use it to try a change, and for any screenshot.
- `pnpm storybook` opens the component catalogue on `http://127.0.0.1:6006`.

`pnpm ingest` reads `~/.claude/projects` and `~/.codex/sessions` by default; set `CLAUDE_PROJECTS_DIR` or `CODEX_SESSIONS_DIR` in `.env` to read another folder. `pnpm collect` reads the repository named in each project's `docs/agents/factory.yml` through `gh` or `glab`, authenticated beforehand.

## Checks

Run `pnpm check` before you open a pull request: format, lint, typecheck, tests and the Storybook build must all pass. `pnpm fix` formats and applies lint fixes.

## Database

Schema changes go in `src/db/schema.ts`, then `pnpm db:generate --name <change>` writes the migration to `drizzle/`. Never edit a generated migration.

## Commits

Commit messages follow `type: :gitmoji: Subject`, for example `feat: :sparkles: Add the cost-per-issue view`. A `commit-msg` hook checks them.

## Specs

Each feature starts as a spec in [`docs/specs`](docs/specs) with testable acceptance criteria. The agent workflow that builds them is described in [`docs/agents`](docs/agents).
