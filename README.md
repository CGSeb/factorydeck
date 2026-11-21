# FactoryDeck

A local-first, open-source dashboard for an AI agent software factory.

Token dashboards for Claude Code stop at sessions. FactoryDeck links what your agents spend to the work they deliver: cost per issue and per role (spec check, build, review, ship), review rounds, merge outcomes and the frictions worth fixing in your next retro.

> Status: early development. Nothing to install yet.

## How it works

- **Ingest** Claude Code session logs (`~/.claude/projects/**/*.jsonl`, including sub-agents) into a local SQLite database, incrementally.
- **Collect** issues, pull requests and labels from GitHub with `gh`.
- **Show** three views: cost per feature, overview by day, project and model, and frictions (tool errors, refusals, failed checks, context peaks).

Everything stays on your machine.

## Development

Requires Node.js 24+ and pnpm.

```bash
pnpm install
pnpm check
```

Commit messages follow `type: :gitmoji: Subject`, for example `feat: :sparkles: Add the cost-per-issue view`.

## License

[MIT](LICENSE)
