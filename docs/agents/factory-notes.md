# Factory notes

What agents must know about this repository that `docs/agents/factory.yml` cannot say in one value. The factorydeck skills read each section below by its heading; keep the headings, and write « None. » under one with nothing to say.

## Checks

- `pnpm db:up` starts PostgreSQL 18 on `127.0.0.1:5434` and waits until it is healthy, and `pnpm db:migrate` brings its database up to date. Run both from the main checkout only, never from a worktree. A worktree links `.env` from the main checkout.
- Narrower checks while building: `pnpm vitest run <file>`, `pnpm typecheck`, `pnpm lint`. UI stories: `pnpm vitest run src/ui/stories.test.tsx`, and `pnpm build-storybook` (part of `pnpm check`).
- Schema changes go in `src/db/schema.ts`, then `pnpm db:generate --name <change>`; never edit a generated migration.

### Proving work in the real app

- Prove on synthetic data, never on the person's sessions: `pnpm build`, then `pnpm demo [--port <n>]` (default port 4318). It recreates the `factorydeck_demo_<port>` database, writes the synthetic sessions of `src/demo/sessions.ts` and serves them; parallel workers each pick their own port. Screenshots of it can go in a pull request. A case the demo lacks goes in `src/demo/sessions.ts`, with its assertion in `src/demo/sessions.test.ts`.
- Layout at a given width: Chrome runs on Windows, and `resize_window` does not change the viewport from WSL even when it reports success. Inject a same-origin `<iframe>` of the exact width with `javascript_tool`, wait for its load, read its `contentWindow.innerWidth` and `document.documentElement.scrollWidth` (no horizontal overflow when they match), then screenshot.
- A new page or panel: screenshot it at 1280 px and at 2560 px wide, the same way.
- Layout shift: with `javascript_tool`, click each period pill, then a top-bar link to and from the page, and after each click record on every animation frame for about 2 s the `getBoundingClientRect().top` of the `h1`, the pills and the first table or panel. Each value must stay the same from the click until the data has arrived; only content that really changes (more or fewer rows) may move what is below it.
- Start the server with a background command and stop it with the agent's own task stop; `pkill` is refused.

## Commits

Checked by the commit-msg hook (`scripts/check-commit-message.ts`): `type: :gitmoji: Subject`. Examples: `feat: :sparkles: …` for a feature, `fix: :bug: …`, `refactor: :recycle: …`, `test: :white_check_mark: …`, `docs: :memo: …`, `chore: :wrench: …`.

## Main branch protection

On, through the `main` ruleset on GitHub. `main` cannot be deleted or force-pushed, and changes reach it only through a pull request whose `Check` and `Audit` jobs of `.github/workflows/ci.yml` passed. No approving review is required, so the shipper can merge a pull request that the person's own account opened. A pull request whose required checks failed or have not finished cannot be merged: fix the cause, never work around the ruleset.

## Reviewer rules

- Nothing workflow-specific is hard-coded: no project, repository, path, role name, label, issue pattern or workflow step. It comes from user configuration, with defaults that work whatever coding agent the person uses.
- No layout shift: a filter, a period or a page change does not move the header, the pills or the content that stays while data loads (see « Layout shift » under Proving work in the real app). A `useRefreshing` scope that would show one item's data on another item's page is a bug.
- Open each real-app screenshot and judge the layout, not only overflow: alignment with the top bar and the content column, and how the empty space falls at the widest width.
- A text may name a coding agent to describe it or compare agents; an instruction to the user (install, setup, next step) works whatever agent they use.
- No real session data, costs or project names in code, tests, fixtures or docs; only small synthetic examples.
- Data that matches no configuration rule is still counted, as "unassigned", never dropped.
- Imports use the `.ts` extension, and only erasable TypeScript syntax is used (no enums, no namespaces).
- A story renders a small data set, a few dozen rows at most: each story renders and runs axe within the 5-second test timeout on a slower CI runner. A case that needs hundreds of items is proven by a unit test of the logic the component calls, not by a story. Exception: a story the spec asks for in so many words keeps the size the spec gives, as long as it stays well within that timeout; the builder states its measured time in the pull request body, and the reviewer does not raise its size as a finding.
