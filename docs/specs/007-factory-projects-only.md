# 007 · Factory projects only

Status: ready
Depends on: 002, 003, 004, 005, 006
Checked: 2026-11-21

## User goal

A developer sees in FactoryDeck only the projects where the factory is installed, without the noise of their other Claude Code sessions. When no project has it yet, every page explains how to install it in a project.

## Acceptance criteria

- [ ] A project has the factory installed when the file `docs/agents/factory.yml` exists under its root (the project root of spec 002: the main repository, so a worktree session counts for its main checkout).
- [ ] The ingestion of spec 002 stores no session, sub-agent, API call, skill launch or user prompt of a project without the factory installed. Sessions of the project `unassigned`, and of a working directory that no longer exists and belongs to no known project, are not stored either.
- [ ] A session log skipped this way is ingested in full, from its first line, at the first run after its project gains `docs/agents/factory.yml`; nothing is lost from before the installation.
- [ ] A skipped log is not read again while its project still has no factory and the file has not grown.
- [ ] The summary line of spec 002 ends with `, <s> sessions skipped (no factory).`; `Nothing new.` is printed only when nothing was read and nothing was skipped.
- [ ] A project already ingested whose `docs/agents/factory.yml` is no longer found (file removed, or project folder gone) keeps all its stored data in every view; its new sessions are not ingested.
- [ ] For each such project, every page shows a warning banner above its content: `Factory configuration not found for <project name>: <root>/docs/agents/factory.yml. Its data is kept, but new sessions are no longer read.`, one line per project, in project name order.
- [ ] When the database holds no session, every page (`Overview`, `Sessions`, `Skills`, `Roles`, and a session or skill page) shows the welcome panel instead of its content; it replaces the `No sessions yet.` message of spec 003.
- [ ] The welcome panel reads: heading `Install the factory in a project`, then `FactoryDeck shows the projects that use the factorydeck-skills workflow. None of yours does yet.`, then three numbered steps: `Install the plugin in Claude Code: /plugin marketplace add CGSeb/factorydeck-skills, then /plugin install factorydeck-skills@factorydeck.`, `In your project, run /setup-factory. It writes docs/agents/factory.yml.`, `Work in that project with Claude Code. FactoryDeck finds it at its next ingestion, earlier sessions included.` The commands are shown as code and can be selected and copied.
- [ ] The welcome panel disappears without a reload at the first ingestion that stores a session.
- [ ] The project filters of specs 004 to 006 list only projects with stored sessions, so they never offer a project without the factory that was never ingested.

## Rules

- **Factory installed** is checked at every ingestion run, by the presence of the file (its content is not read or validated). A project folder that cannot be read counts as no factory.
- A project's root comes from spec 002's rules; the check happens before any row of the log is stored.
- Data already in the database before this spec, from projects without the factory at the first run after the upgrade, is removed at that run, together with the read offsets of their logs, so the views match what a fresh ingestion would store and those logs are read again if the factory is installed later; projects that have the factory keep their data. This clean-up happens once, not at later runs (later removals of a factory keep the data, see the criteria).
- The README's « How it works » says that FactoryDeck only reads projects where the factory is installed, and links the factorydeck-skills install steps.
- The warning banner is computed from the projects stored in the database, checked when the page's data refreshes (each re-ingestion of spec 003).
- Totals stay consistent: every view counts exactly the stored data, so the overview, sessions, skills and roles totals still agree with each other.
- The `unassigned` project of specs 002 to 006 no longer receives new sessions; the views keep handling it for data already stored.

## Expected proof

- Vitest tests of the ingestion on synthetic fixture folders: a project with `docs/agents/factory.yml` (stored), one without (skipped and counted), a worktree of a factory project (stored under its main repository), a session without working directory (skipped), a project that gains the file between two runs (all its sessions stored from the first line), a project whose file is removed after ingestion (data kept, new sessions skipped).
- Storybook stories of the welcome panel and of a page with the warning banner (one and two projects); they pass the axe check of `src/ui/stories.test.tsx`.
- On the real app: `pnpm start` with a sessions folder whose projects have no factory shows the welcome panel; after adding `docs/agents/factory.yml` to one project, the next ingestion shows its sessions. Screenshots of both are attached to the pull request.

## Out of scope

- Reading or validating the content of `docs/agents/factory.yml`.
- A setting to show projects without the factory.
- Installing the plugin or running `/setup-factory` from FactoryDeck.
- Deleting the data of a project whose factory was removed.
