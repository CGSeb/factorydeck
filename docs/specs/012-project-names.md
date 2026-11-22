# 012 · Project names

Status: ready
Depends on: 010
Checked: 2026-11-22

## User goal

A developer sees each of their projects under a readable name they choose, such as `FactoryDeck`, instead of its root path, on every page of FactoryDeck. They set it once in the project's `docs/agents/factory.yml`.

## Acceptance criteria

- [ ] A project's `docs/agents/factory.yml` can hold an optional section `project` with a key `name`:

  ```yaml
  project:
    name: FactoryDeck
  ```

- [ ] A project's **display name** is its `project.name`, as last read by the ingestion (Rules); a project with no name read yet shows its folder name (the last segment of its root path, such as `factorydeck` for `/home/me/factorydeck`). `unassigned` stays `unassigned`.
- [ ] The display name replaces the root path wherever a project is shown: the `By project` table of the overview (spec 003), the project column of the session list and the `Project` field of the session page (spec 004), the options of the project filters (specs 004 to 006 and 010), the project column of `/features` and the project line of an issue page (spec 010), and the warning banner and delete dialog of spec 007 (`<project name>` in their wording).
- [ ] Wherever a display name is shown, its root path is its tooltip (`title`), except in the options of the project filters, where a duplicated name carries it as text instead (next criterion). The `Working directory` field of the session page and the `<root>/docs/agents/factory.yml` path of the spec 007 banner keep showing paths.
- [ ] When two or more projects with stored sessions have the same display name (compared case-insensitively), each of them is shown as `<name> (<root>)`, in the filter options and everywhere else a project is shown; a unique name is shown alone.
- [ ] The options of the project filters stay `All projects` first, then the projects sorted by display name, case-insensitively (then by root); the value of each option and of the `project` URL parameter stays the project root, so every link and URL of specs 004 to 010 keeps working.
- [ ] The `By project` table of the overview keeps its sort by cost descending; a tie is broken by display name.
- [ ] Renaming a project in its `docs/agents/factory.yml` changes its display name on every page at the next ingestion run, without a reload (the refresh of spec 003) and without re-ingesting any session.
- [ ] A `project.name` that is missing, empty or only spaces, not a string (a number, a list, a map), under a `project` that is not a map, or in a file that is not valid YAML (a duplicated key included), counts as no name: the project keeps the last name read, or its folder name if none was ever read.
- [ ] A name is cleaned before it is stored: line breaks, tabs and runs of spaces become one space, and leading and trailing spaces are removed. A cleaned name longer than 60 characters is shown as its first 60 characters followed by `…`, everywhere, with the full name and the root path in its tooltip.
- [ ] `unassigned` has no tooltip.
- [ ] A project whose `docs/agents/factory.yml` is no longer found (spec 007) keeps the last name read.
- [ ] This repository's `docs/agents/factory.yml` has `project: name: FactoryDeck`; the demo projects of `pnpm demo` have names in their `docs/agents/factory.yml`, and one of them has none, so it shows its folder name.

## Rules

- **Reading the name**: at every ingestion run (spec 002, including the runs of spec 003's refresh loop), for every stored project whose `docs/agents/factory.yml` is found, FactoryDeck reads `project.name` and stores it when it is a name (criteria). A run reads the name even when the project has no new session. Nothing else of the file changes how the name is read.
- The first ingestion run after the upgrade reads the names of every stored project, so existing data shows names without re-ingesting.
- Deleting a project (spec 007) also deletes its stored name.
- The display name is only a label: filters, URLs, the API's `project` parameters, totals and every grouping still use the project root. Two projects with the same name are never merged.
- Projects with stored sessions are the ones the filters list (spec 007); duplicated names are detected among them.
- FactoryDeck never writes `docs/agents/factory.yml`.
- The README's « How it works » says that a project shows under its `project.name` from `docs/agents/factory.yml`, or its folder name.

## Expected proof

- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of the ingestion with synthetic project folders: a name read and stored, a project with no name (folder name), a rename picked up at the next run with no new session, each invalid value of the criteria (keeps the previous name), a project whose file is removed (keeps its last name), the first run after the upgrade naming already-stored projects, and a deleted project losing its name.
- Vitest tests of the API: the overview, session list and page, skills, roles, features and issue page responses carry each project's display name next to its root; two projects with the same name come back as `<name> (<root>)`.
- Storybook stories of the overview's `By project` table, the session list and page, `/features` with `All projects`, an issue page, a project filter with two projects of the same name, and the spec 007 banner and dialog, all with display names; they pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: the overview, `/sessions` and `/features` show the demo projects' names and the folder name of the one without a name; a screenshot is attached to the pull request.

## Out of scope

- A project select in the top bar, and removing the filters from the pages (spec 013).
- Changing the schema of `docs/agents/factory.yml` and `/setup-factory` in factorydeck-skills: that change is made in that repository.
- Editing a project's name from FactoryDeck.
- Names for projects without the factory, or a name taken from `package.json`, the git remote or anything other than `docs/agents/factory.yml`.
- Using the name in URLs instead of the project root.
