# Roles and work items

Every thread (a session's main thread, each sub-agent) gets a **role** and a **work item** (the issue it works on). Every API call then belongs to exactly one role and to at most one issue, so the totals of every page add up and nothing is dropped.

Role rules belong to each project and live in the database ([below](#role-rules)); a session of no project uses the default role rules. Work item rules come from a configuration file; without one, the defaults fit the `build-feature` and `fix-bug` workflows of factorydeck-skills.

## The configuration file

`factorydeck.yml` at the repository root (ignored by git), or the path in `FACTORYDECK_CONFIG` (relative to the repository root; `~` is the home folder). [`factorydeck.example.yml`](../../factorydeck.example.yml) documents every key and holds the defaults.

- It is read once at start-up and applies to all data already ingested, without re-ingesting. It is never written by FactoryDeck and never holds secrets. `pnpm ingest` does not read it.
- A missing file is not an error: the defaults apply. A missing key takes its default; an empty list is a value (`work_items: []` means no work item rule).
- The `roles` keys, global and per project, are ignored, whatever they hold: role rules come only from the database.
- An invalid file ends `pnpm start` and `pnpm dev` with exit code 1 and `Invalid configuration in <path>:`, then one line per error naming its key path (`work_items[2].pattern`). Invalid: YAML that does not parse, an unknown key, a wrong type, a pattern that does not compile, a work item pattern without exactly one capture group, a project key that is not absolute or `~`-based (`~bob/x` is invalid), two project keys equal after `~` expansion and without a trailing `/`.

```yaml
version: 1
work_items: # the first rule that matches wins
  - from: marker # marker | description | branch | title
    pattern: '^Work item: #(\d+)(?: \((?<role>[a-z][a-z0-9-]*)\))?$'
projects: # optional, keyed by project root
  ~/code/my-app:
    work_items: [...] # replaces the global list for that project
```

Patterns are JavaScript regular expressions, case-insensitive, matched anywhere unless anchored. A project's `work_items` replace the global list for that project; they are not merged.

## Roles

- A session's main thread has the role `main`, except for calls a [marker](#work-item-marker) gives a role.
- A sub-agent takes the name of the first role rule matching its type and description. With no match, its role is its type (`Explore`, `general-purpose`); with an empty type, `unassigned`.
- Several rules may share a name, and a rule named like a lower-case sub-agent type (such as `general-purpose`) shares that type's row.

### Role rules

Each project holds its own ordered list of role rules, in the table `project_rule` (`kind` `role`, by `position` from 0, with `name`, `description` and `agent_type`; the table also holds the work item rules of a later version). A rule has a name and one or two patterns: `description`, matched against the description the sub-agent was started with, and `agent_type`, matched against its type. Patterns are JavaScript regular expressions, case-insensitive, matched anywhere unless anchored; with both, both must match. The first matching rule wins.

- A project added gets the default role rules below, in their order; the projects that existed before role rules were stored got them too. A project with no role rule has none: its sub-agents take their type as role, never the defaults.
- The rules are read from the database at each request, for the project each session belongs to ([data](data.md)): a saved change applies at once to every page and to every stored thread, without re-ingesting. When two managers save at once, the last save wins.
- Patterns are stored exactly as typed (the defaults end with a space), without slashes or flags; an empty pattern is stored as absent.

`GET /api/admin/projects/<id>/rules/role` answers `200` with `{ "status": "ok", "refreshSeconds": <n>, "rules": [{ "name", "description", "agentType" }] }` in order, an absent pattern as `null`; `503` with `{ "status": "unreachable", "refreshSeconds": <n> }` while the database is unreachable.

`PUT /api/admin/projects/<id>/rules/role` with `{ "rules": [{ "name", "description", "agentType" }] }` replaces the project's role rules and answers `200` with `{ "rules": [...] }` in the same shape. A missing, `null` or empty pattern is absent. Names are trimmed and keep their letter case. Lengths count UTF-16 code units.

Both routes check, in order, the checks shared by every route under `/api/admin/` ([projects](projects.md#admin-routes)), then `404` with `{ "error": "Not found" }` when `<id>` is not a positive integer or no project has it (also one removed meanwhile), then the body. A refused body saves nothing and answers `400` with `{ "error", "rule", "field" }`: `rule` counts from 0, and the first failing rule in list order wins, then its fields in the order `name`, `description`, `agentType`.

| `field`                      | `error`                                                                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rules` (no `rule`)          | `Give a list of rules` when `rules` is missing or not a list (also a body that is not a JSON object); `At most 50 rules`.                                                                                        |
| `name`                       | `Name is required` (missing, not text or blank), `At most 40 characters`, `main and unassigned are reserved`, then `Use lower-case letters, digits and -, starting with a letter` (outside `^[a-z][a-z0-9-]*$`). |
| `description` or `agentType` | `At most 500 characters`, then `Not a valid regular expression: <reason>` (also a pattern that is not text).                                                                                                     |
| `description`                | `Give a description or an agent type pattern`: the rule has neither pattern.                                                                                                                                     |

#### Role rules section

A manager edits a project's role rules in the `Role rules` section of its [settings page](projects.md#project-settings), after `General`. It reads and saves through the routes above.

- **Rows**: one row per rule, in order, with `Name`, `Description pattern` and `Agent type pattern` (the patterns in a monospace font; an absent pattern shows empty), then `Move up` (↑), `Move down` (↓) and `Delete`. `Move up` is disabled on the first row and `Move down` on the last. A moved row keeps the focus on the same button, or on the other move button once it reaches an edge; `Delete` moves the focus to the next row's `Delete` (the previous row's for the last row, `Add rule` when no row is left).
- **No rule**: `No role rule: sub-agents take their type as role.` in place of the rows.
- Under the rows, `Add rule` appends an empty row and focuses its `Name`; `Reset to defaults` fills the section with the [default role rules](#role-rules), without confirmation. Nothing is saved before `Save rules`.
- **Save rules** sends the whole list, an empty pattern as absent and every value as typed. It is disabled while the rows equal the rules last read (an edit undone counts as no change). While the request runs it reads `Saving…` and is disabled; the fields stay enabled. Once saved, the section shows the rules the API answered (names trimmed) and `Saved` shows beside the button for 3 seconds, or until the next edit.
- **Refusals** keep the edits. A `400` shows its message under the field it names (`name`, `description` or `agentType`) of the rule at its `rule` index, and the focus moves to that field; a `400` on `rules` shows under the section. If the project was removed meanwhile, `<name> is no longer in FactoryDeck.` shows under the section; a `503` shows `Database unreachable. Start it with pnpm db:up.` there, and any other failure the API's message or `Could not reach the server`.
- **Loading**: `Loading…` until the rules are read; `Database unreachable. Start it with pnpm db:up.` while the database is unreachable.
- **Refresh**: the section reloads the rules every `refreshSeconds`. Without unsaved changes it shows the new rules; with unsaved changes it keeps them.
- **Leaving with unsaved changes**: an in-app link to another page asks `Leave without saving the rules?` in a dialog, with `Stay` (focused; also `Escape` or a click outside) and `Leave`. Closing or reloading the tab shows the browser's own prompt.

**Default role rules**, each on the sub-agent's description; they match the descriptions `build-feature` and `fix-bug` give their agents:

| Role           | Pattern                      |
| -------------- | ---------------------------- |
| `builder`      | `^(Build\|Worker for) `      |
| `reviewer`     | `^Review `                   |
| `shipper`      | `^(Ship\|Merge\|Push) `      |
| `reworker`     | `^(Rework\|Rebase\|Update) ` |
| `spec-checker` | `check-spec`                 |
| `debugger`     | `^Debug `                    |
| `bug-checker`  | `check-bug`                  |

The Roles page says where its roles come from: `Role rules of each project`.

## Work items

A work item is an issue number, a positive whole number, shown `#<n>`. It belongs to the session's project: the same number in two projects is two issues.

For each thread, the rules are tried in order; the first whose pattern matches its text and captures a positive whole number gives the work item:

- `marker`: the closing lines of the main thread (below);
- `description`: the sub-agent's description (skipped for a main thread);
- `branch`: the thread's own git branch;
- `title`: the session's title.

A sub-agent with no match takes the work item of its main thread at the time of its first record. A main thread with no match has none (`—`).

**Defaults**: `marker`, then `description` with `#(\d+)`, then `title` with `#(\d+)`. A branch rule such as `^[a-z]+/(\d+)-` (for `feat/52-export`) is offered, commented out, in the example file.

### Work item marker

An agent ends its work with a closing line such as `Work item: #88 (spec-writer)`, and its session's calls go to issue #88 under the role `spec-writer`, without renaming the session. The `write-spec` and `check-spec` skills of factorydeck-skills write it.

- A marker is a closing line (the last line of an assistant reply in the main thread) that a `marker` rule matches. Its pattern has one unnamed capture group, the issue, and may have a named group `role`; anything else is a configuration error.
- When a session has markers, its main-thread calls are split at them, whatever the rule's position: a call goes to the issue of the first marker at or after its time; calls after the last marker go to the last one. The other rules then give the main thread no work item. Two markers at the same time: the later one in the file wins.
- Calls split to a marker with a role take that role; without a role, or with `main` or `unassigned`, they stay `main`. A session then counts as one thread in each role its calls fall in.
- A sub-agent in a session with markers skips the `title` rule, and with no match of its own takes the issue in force at its first record.
- The session's `Work item` shown in lists is the last marker's issue.
- A file whose `work_items` leaves the `marker` rule out reads no marker.

## Orchestration share

In each session, the calls of a main thread with no work item are shared among the issues of its sub-agents, in proportion to their tokens on each issue in the same period (all four kinds). Tokens and cost are shared with the same weights. When the sub-agents have no issue in the period, those calls stay in `No work item`. A main thread with a work item keeps its calls (no share).

An issue's tokens and cost include its share; shared counts are summed before rounding and rounded to whole numbers for display only (the rounding difference goes to the largest of the four kinds). The share is not a thread: it shows as the `Orchestration` row or step. It carries no friction and no time of its own.
