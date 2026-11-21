# Factory notes

What agents must know about this repository that `docs/agents/factory.yml` cannot say in one value. The factorydeck skills read each section below by its heading; keep the headings, and write « None. » under one with nothing to say.

## Checks

- `pnpm db:up` starts PostgreSQL 18 on `127.0.0.1:5434` and waits until it is healthy, and `pnpm db:migrate` brings its database up to date. Run both from the main checkout only, never from a worktree. A worktree links `.env` from the main checkout.
- Narrower checks while building: `pnpm vitest run <file>`, `pnpm typecheck`, `pnpm lint`. UI stories: `pnpm vitest run src/ui/stories.test.tsx`, and `pnpm build-storybook` (part of `pnpm check`).
- Schema changes go in `src/db/schema.ts`, then `pnpm db:generate --name <change>`; never edit a generated migration.

### Proving work in the real app

- Prove on synthetic data, never on the person's sessions: `pnpm build`, then `pnpm demo [--port <n>]` (default port 4318). It recreates the `factorydeck_demo_<port>` database, writes the synthetic sessions of `src/demo/sessions.ts` and serves them; parallel workers each pick their own port. Screenshots of it can go in a pull request. A case the demo lacks goes in `src/demo/sessions.ts`, with its assertion in `src/demo/sessions.test.ts`.
- Layout at a given width: Chrome runs on Windows, and `resize_window` does not change the viewport from WSL even when it reports success. Inject a same-origin `<iframe>` of the exact width with `javascript_tool`, wait for its load, read its `contentWindow.innerWidth` and `document.documentElement.scrollWidth` (no horizontal overflow when they match), then screenshot.
- Start the server with a background command and stop it with the agent's own task stop; `pkill` is refused.

## Commits

Checked by the commit-msg hook (`scripts/check-commit-message.ts`): `type: :gitmoji: Subject`. Examples: `feat: :sparkles: …` for a feature, `fix: :bug: …`, `refactor: :recycle: …`, `test: :white_check_mark: …`, `docs: :memo: …`, `chore: :wrench: …`.

## Main branch protection

Off while the repository is private (GitHub needs a paid plan). Turn it on, requiring the check job of `.github/workflows/ci.yml`, when the repository goes public. Until then the merge gate is the build-feature skill's prose.

## Reviewer rules

- Nothing workflow-specific is hard-coded: no project, repository, path, role name, label, issue pattern or workflow step. It comes from user configuration, with defaults that work on a plain Claude Code setup.
- No real session data, costs or project names in code, tests, fixtures or docs; only small synthetic examples.
- Data that matches no configuration rule is still counted, as "unassigned", never dropped.
- Imports use the `.ts` extension, and only erasable TypeScript syntax is used (no enums, no namespaces).
