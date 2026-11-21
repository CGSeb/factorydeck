# FactoryDeck

Local-first dashboard for an AI agent software factory. See `README.md`.

## Universal by design

FactoryDeck is a public tool for anyone's projects and sessions.

- Never hard-code a project, repository, path, role name, label, issue pattern or workflow step. Anything workflow-specific comes from user configuration, with sensible defaults that work on a plain Claude Code setup.
- Never ship real session data, costs or project names in code, tests, fixtures or docs: use small synthetic examples.
- Data that does not match the configuration is still counted (as "unassigned"), never dropped.

## Conventions

- Stack: TypeScript run directly by Node 24+ (type stripping), pnpm, zod, vitest, oxlint (type-aware), prettier. PostgreSQL 18 in Docker Compose (`pnpm db:up`), Drizzle ORM and drizzle-kit migrations in `drizzle/`, configuration from the root `.env` (`src/config/env.ts`). UI in React, bundled by Vite; React Router for client routes, Recharts for charts.
- Code, comments, commits and docs are in English.
- Imports use the `.ts` extension; only erasable TypeScript syntax (no enums, no namespaces).
- Every component of `src/ui` has Storybook stories (`<Component>.stories.tsx`), one per state the specs name. Interactions go in `play` functions. `src/ui/stories.test.tsx` renders every story with happy-dom, runs its `play`, and fails on any axe-core violation. Colour contrast is not checked there (happy-dom computes no colours): check it in Storybook. `pnpm storybook` opens the catalogue on `127.0.0.1:6006`.
- Run `pnpm check` before declaring work done: format, lint, typecheck and tests must all pass.
- Commit messages: `type: :gitmoji: Subject` (checked by a `commit-msg` hook).
- Never edit a generated migration: change `src/db/schema.ts` and run `pnpm db:generate --name <change>`.

## Agent workflow

Specs, labels, checks, models and merge policy for agents: `docs/agents/factory.yml`; notes on checks, proofs and commits, and the rules for the reviewer: `docs/agents/factory-notes.md`. Git host commands: `docs/agents/git-host.md`.
