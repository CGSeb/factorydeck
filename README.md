# FactoryDeck

A local-first, open-source dashboard for an AI agent software factory.

Token dashboards for Claude Code stop at sessions. FactoryDeck links what your agents spend to the work they deliver: cost per issue and per role, review rounds, merge outcomes and the frictions worth fixing in your next retro.

It works with any project and any agent workflow. Point it at your own Claude Code sessions and repositories: nothing assumes a particular codebase, set of roles or labelling scheme.

> Status: early development. Nothing to install yet.

## How it works

- **Ingest** Claude Code session logs (`~/.claude/projects/**/*.jsonl`, including sub-agents) into a local PostgreSQL database, incrementally.
- **Collect** issues, pull requests and labels from GitHub with `gh`.
- **Show** three views: cost per feature, overview by day, project and model, and frictions (tool errors, refusals, failed checks, context peaks).

Everything stays on your machine.

## Your workflow, your vocabulary

Every team splits agent work differently. FactoryDeck reads your workflow from configuration instead of guessing it:

- **Roles**: how to recognise a role (planner, builder, reviewer, shipper, or your own) from a sub-agent's description or type.
- **Work items**: how to find the issue or pull request a session works on (for example `#52` in a sub-agent description, or a branch name).
- **Outcomes**: which GitHub labels, checks or comments mean "merged", "needs rework" or a quality score.

Sessions that match no rule still count, under an "unassigned" role, so the totals are always complete.

## Development

Requires Node.js 24+, pnpm and Docker (or any PostgreSQL 16+ server).

```bash
cp .env.example .env    # then set POSTGRES_PASSWORD and DATABASE_URL
pnpm install
pnpm db:up              # PostgreSQL 18 in Docker, on 127.0.0.1:5434
pnpm db:migrate
pnpm ingest             # read new Claude Code session logs into the database
pnpm check
```

`pnpm ingest` reads `~/.claude/projects` by default; set `CLAUDE_PROJECTS_DIR` in `.env` to read another folder. A second run only reads what is new.

Run FactoryDeck on `http://127.0.0.1:4317` (set `FACTORYDECK_PORT` in `.env` to change the port):

```bash
pnpm build              # builds the UI into dist/ui
pnpm start              # serves the UI and the JSON API, on 127.0.0.1 only
```

While working on it, `pnpm dev` runs the API and the Vite dev server together: open `http://127.0.0.1:5173`, which reloads on UI changes and proxies `/api` to the API.

To use your own PostgreSQL server instead of Docker, set `DATABASE_URL` and skip `pnpm db:up`.

Schema changes go in `src/db/schema.ts`, then `pnpm db:generate --name <change>` writes the migration to `drizzle/`.

Commit messages follow `type: :gitmoji: Subject`, for example `feat: :sparkles: Add the cost-per-issue view`.

## License

[MIT](LICENSE)
