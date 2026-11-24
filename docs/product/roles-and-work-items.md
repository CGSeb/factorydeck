# Roles and work items

Every thread (a session's main thread, each sub-agent) gets a **role** and a **work item** (the issue it works on). Every API call then belongs to exactly one role and to at most one issue, so the totals of every page add up and nothing is dropped.

The rules come from a configuration file; without one, the defaults fit the `build-feature` workflow of factorydeck-skills.

## The configuration file

`factorydeck.yml` at the repository root (ignored by git), or the path in `FACTORYDECK_CONFIG` (relative to the repository root; `~` is the home folder). [`factorydeck.example.yml`](../../factorydeck.example.yml) documents every key and holds the defaults.

- It is read once at start-up and applies to all data already ingested, without re-ingesting. It is never written by FactoryDeck and never holds secrets. `pnpm ingest` does not read it.
- A missing file is not an error: the defaults apply. A missing key takes its default; an empty list is a value (`roles: []` means no role rule).
- An invalid file ends `pnpm start` and `pnpm dev` with exit code 1 and `Invalid configuration in <path>:`, then one line per error naming its key path (`roles[2].description`). Invalid: YAML that does not parse, an unknown key, a wrong type, `roles:` with no value, a pattern that does not compile, a work item pattern without exactly one capture group, a role named `main` or `unassigned`, a project key that is not absolute or `~`-based (`~bob/x` is invalid), two project keys equal after `~` expansion and without a trailing `/`.

```yaml
version: 1
roles: # the first rule that matches wins
  - name: builder
    description: '^(Build|Worker for) ' # optional pattern
    agent_type: 'general-purpose' # optional pattern; with both, both must match
work_items: # the first rule that matches wins
  - from: marker # marker | description | branch | title
    pattern: '^Work item: #(\d+)(?: \((?<role>[a-z][a-z0-9-]*)\))?$'
projects: # optional, keyed by project root
  ~/code/my-app:
    roles: [...] # replaces the global list for that project
    work_items: [...]
```

Patterns are JavaScript regular expressions, case-insensitive, matched anywhere unless anchored. A project's `roles` or `work_items` replace the global list for that project; they are not merged.

## Roles

- A session's main thread has the role `main`, except for calls a [marker](#work-item-marker) gives a role.
- A sub-agent takes the name of the first role rule matching its type and description. With no match, its role is its type (`Explore`, `general-purpose`); with an empty type, `unassigned`.
- Several rules may share a name, and a rule named like a sub-agent type shares that type's row.

**Default role rules**, each on the sub-agent's description; they match the descriptions `build-feature` gives its agents:

| Role           | Pattern                      |
| -------------- | ---------------------------- |
| `builder`      | `^(Build\|Worker for) `      |
| `reviewer`     | `^Review `                   |
| `shipper`      | `^(Ship\|Merge\|Push) `      |
| `reworker`     | `^(Rework\|Rebase\|Update) ` |
| `spec-checker` | `check-spec`                 |

The Roles page says where its roles come from: `Rules from <path>` when the file exists, else `No configuration file at <path>: default roles of the build-feature workflow.`

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
