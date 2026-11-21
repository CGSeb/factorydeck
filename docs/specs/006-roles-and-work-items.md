# 006 · Roles and work items

Status: ready
Depends on: 002, 003, 004
Checked: 2026-11-21

## User goal

A developer describes their agent workflow in one configuration file, and FactoryDeck shows which role each sub-agent plays and which issue it works on, and how many tokens and how much cost each role takes. With no file at all, it still shows useful roles from the sub-agent types.

## Acceptance criteria

- [ ] FactoryDeck reads its workflow configuration from `factorydeck.yml` at the repository root, or from the path in `FACTORYDECK_CONFIG` of the root `.env` (an empty value means the default; a path starting with `~` is expanded to the home folder). `factorydeck.yml` is ignored by git; a versioned `factorydeck.example.yml` documents every key with comments and holds rules for the `build-feature` workflow of factorydeck-skills (see Rules).
- [ ] A missing configuration file is not an error: the defaults of Rules apply.
- [ ] An invalid file (YAML that does not parse, an unknown key, a wrong type, a regular expression that does not compile, a work item pattern without exactly one capture group, a role named `main` or `unassigned`) ends start-up of `pnpm start` and `pnpm dev` with exit code 1 and the message `Invalid configuration in <path>:` followed by one line per error, naming its key path (such as `roles[2].description`). `pnpm ingest` does not read the configuration.
- [ ] The configuration is read once at start-up; a change applies at the next start, to all data already ingested, without re-ingesting.
- [ ] Every sub-agent gets a role and every thread (a session's main thread, each sub-agent) gets a work item, by the rules below.
- [ ] The session page of spec 004 shows `Work item` in its header (`#52`, or `—`), and its sub-agent table gains the columns `Role` and `Work item`, after `Type`.
- [ ] The session list of spec 004 gains a `Work item` column after `Branch`: the work item of the session's main thread, or `—`.
- [ ] The navigation bar has a `Roles` entry, after `Skills`, at `/roles` (a React Router route that survives a reload).
- [ ] `/roles` shows a table with one row per role: name, threads (sessions for `main`, sub-agents for the others), API calls, tokens and cost; sorted by cost descending. Rows `main` and `unassigned` are listed like the others.
- [ ] Under its heading, `/roles` says where the roles come from: `Rules from <path>` when the file exists, else `No configuration file at <path>: sub-agents are grouped by type.`, with the resolved path.
- [ ] The column totals of `/roles` equal the overview totals of spec 003 for the same period and project.
- [ ] The period selector of spec 003 and the project filter of spec 004 apply to `/roles`; both are kept in the URL.
- [ ] With no API call in the period, `/roles` shows `No activity in this period.` instead of the table.
- [ ] Figures on `/roles` refresh with each re-ingestion of spec 003, without a reload.
- [ ] `/roles` and the session list with its new column work from 1280 px wide down to 768 px, like spec 003.

## Rules

- **File shape** (version 1):

  ```yaml
  version: 1
  roles: # ordered; the first rule that matches wins
    - name: builder
      description: '^Build #\d+' # optional regular expression
      agent_type: 'general-purpose' # optional regular expression
  work_items: # ordered; the first rule that matches wins
    - from: description # description | branch | title
      pattern: '#(\d+)' # exactly one capture group, the issue number
  projects: # optional overrides, keyed by project root path
    ~/code/my-app:
      roles: [...]
      work_items: [...]
  ```

  `version` is required and must be `1`. A role rule needs at least one of `description` and `agent_type`; with both, both must match. Patterns are JavaScript regular expressions, matched case-insensitively, anywhere in the text unless anchored. A project's `roles` or `work_items`, when present, replace the global list for that project (they are not merged); a project key is compared with the project root that spec 002 stores, after `~` expansion and without a trailing `/`.

- **Defaults** (no file, or a file without the key): `roles` is empty; `work_items` is `[{ from: description, pattern: '#(\d+)' }, { from: title, pattern: '#(\d+)' }]`.
- **Role**: a session's main thread always has the role `main`. A sub-agent takes the `name` of the first role rule that matches its stored type and description (spec 002). With no matching rule, its role is its type as stored (`Explore`, `general-purpose`…); with an empty type, `unassigned`.
- **Work item**: an issue number, a positive whole number, shown `#<n>`. For a thread, the rules are tried in order; a rule applies to the text named by `from`: `description` is the sub-agent's description (the main thread has none, the rule is skipped), `branch` is the thread's own git branch (spec 002), `title` is the session's title. The first rule whose pattern matches and whose capture is a positive whole number gives the work item. A sub-agent with no match takes the work item of its session's main thread; a main thread with no match has none (`—`).
- Roles are grouped by name: several rules may share a name (several patterns for one role), and a rule named like a sub-agent type (such as `Explore`) shares that type's row.
- A project key must be an absolute path or start with `~`; anything else is a configuration error.
- **Threads** on `/roles`: the sessions (for `main`) or sub-agents with at least one API call in the period and project, like the `Sessions` tile of spec 003.
- An API call belongs to the role of its thread: main-thread calls to `main`, sub-agent calls to the sub-agent's role. Each call has exactly one role, so totals add up; nothing is dropped.
- The work item belongs to the project of the session; linking it to a GitHub issue is spec 007.
- **Example file**: `factorydeck.example.yml` holds, as working rules for `build-feature`: `builder` (`^(Build|Worker for) `), `reviewer` (`^Review `), `shipper` (`^(Ship|Merge|Push) `), `reworker` (`^(Rework|Rebase|Update) `), `spec-checker` (`check-spec`), each on `description`; and a commented-out branch rule `from: branch, pattern: '^[a-z]+/(\d+)-'` explaining that it fits branches named after issue numbers.
- Periods, cost, `—` and token formats follow spec 003; environment variables follow spec 001 (documented in `.env.example`).
- The configuration file never holds secrets and is only read, never written, by FactoryDeck.

## Expected proof

- Vitest tests of the configuration loader: missing file (defaults), valid file, project overrides replacing the global lists, `~` expansion, and each invalid case of the criteria with its message and key path.
- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of role and work item resolution over synthetic sessions: rule order, `description` and `agent_type` together, fallback to the type and to `unassigned`, sub-agent inheriting the session's work item, a `branch` rule, and `/roles` totals equal to the overview.
- Storybook stories of `/roles` (with roles, no activity) with a `play` function that changes the project filter, and of the session page and list with work items; they pass the axe check of `src/ui/stories.test.tsx`.
- On the real app: copy `factorydeck.example.yml` to `factorydeck.yml`, `pnpm start`, open `/roles?period=all` and a session page with sub-agents; a screenshot of both is attached to the pull request. Then start with an invalid file and paste the error output.

## Out of scope

- Outcomes (merged, needs rework, score) and any GitHub data: spec 007.
- The cost-per-feature view (cost per work item): spec 008.
- Editing the configuration from the interface, or reading `docs/agents/factory.yml` of a project.
- Reloading the configuration while the server runs.
- A detail page per role or per work item.
- Pull request numbers as work items.
