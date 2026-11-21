# FactoryDeck

Local-first dashboard for an AI agent software factory. See `README.md`.

## Universal by design

FactoryDeck is a public tool for anyone's projects and sessions.

- Never hard-code a project, repository, path, role name, label, issue pattern or workflow step. Anything workflow-specific comes from user configuration, with sensible defaults that work on a plain Claude Code setup.
- Never ship real session data, costs or project names in code, tests, fixtures or docs: use small synthetic examples.
- Data that does not match the configuration is still counted (as "unassigned"), never dropped.

## Conventions

- Stack: TypeScript run directly by Node 24+ (type stripping), pnpm, zod, vitest, oxlint (type-aware), prettier. Planned: SQLite through `node:sqlite`, Vite + React.
- Code, comments, commits and docs are in English.
- Imports use the `.ts` extension; only erasable TypeScript syntax (no enums, no namespaces).
- Run `pnpm check` before declaring work done: format, lint, typecheck and tests must all pass.
- Commit messages: `type: :gitmoji: Subject` (checked by a `commit-msg` hook).
