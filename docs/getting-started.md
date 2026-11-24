# Getting started

FactoryDeck reads the projects where the [factorydeck-skills](https://github.com/CGSeb/factorydeck-skills) factory is installed. Install the factory first: follow its [install steps](https://github.com/CGSeb/factorydeck-skills#install), then run `/setup-factory` in each project.

## Install

You need Node.js 24+, pnpm, and Docker (or any PostgreSQL 16+ server). To read issues and pull requests, install and sign in to [`gh`](https://cli.github.com/) or [`glab`](https://gitlab.com/gitlab-org/cli).

```bash
git clone https://github.com/CGSeb/factorydeck.git
cd factorydeck
cp .env.example .env    # then set POSTGRES_PASSWORD and DATABASE_URL
pnpm install
pnpm db:up              # PostgreSQL 18 in Docker, on 127.0.0.1:5434
pnpm db:migrate
pnpm build
pnpm start              # http://127.0.0.1:4317
```

While it runs, the server reads new session logs every few seconds and collects from the git host every few minutes. You can also run `pnpm ingest` and `pnpm collect` by hand.

**Just want to look around?** `pnpm build && pnpm demo` serves synthetic sessions and issues on `http://127.0.0.1:4318`, in a database of its own.

## Configuration

Everything goes in the root `.env`; [`.env.example`](../.env.example) documents each variable.

| Variable                               | Default              | What it does                                  |
| -------------------------------------- | -------------------- | --------------------------------------------- |
| `DATABASE_URL`                         |                      | The PostgreSQL database to use.               |
| `FACTORYDECK_PORT`                     | `4317`               | The port of the server, on `127.0.0.1` only.  |
| `CLAUDE_PROJECTS_DIR`                  | `~/.claude/projects` | Where to read Claude Code logs.               |
| `CODEX_SESSIONS_DIR`                   | `~/.codex/sessions`  | Where to read Codex logs; skipped if missing. |
| `FACTORYDECK_INGEST_INTERVAL_SECONDS`  | `10`                 | How often to read new session logs.           |
| `FACTORYDECK_COLLECT_INTERVAL_MINUTES` | `5`                  | How often to collect from the git host.       |
| `FACTORYDECK_INACTIVE_AFTER_MINUTES`   | `30`                 | When a quiet session shows as inactive.       |
| `FACTORYDECK_CONFIG`                   | `factorydeck.yml`    | The file of role and work item rules.         |

## Your workflow, your vocabulary

Every team splits agent work differently. FactoryDeck reads your workflow from configuration instead of guessing it:

- **Roles**: how to recognise a role (planner, builder, reviewer, shipper, or your own) from a sub-agent's description or type.
- **Work items**: how to find the issue or pull request a session works on, for example `#52` in a sub-agent description, or a branch name.
- **Outcomes**: which labels, checks or comments mean "merged", "needs rework" or a quality score.

Without a file, the roles of the `build-feature` and `fix-bug` workflows of factorydeck-skills apply (builder, reviewer, shipper, reworker, spec-checker, debugger, bug-checker), and work items are read from `#<number>` in sub-agent descriptions and session titles. To change them, copy [`factorydeck.example.yml`](../factorydeck.example.yml) to `factorydeck.yml`: it documents every key and holds the default rules. Then restart FactoryDeck.

To see how sessions, issues and outcomes are linked, read [How FactoryDeck works](how-it-works.md).
