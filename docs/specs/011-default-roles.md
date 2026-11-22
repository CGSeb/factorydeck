# 011 · Default roles

Status: done
Depends on: 006, 010
Checked: 2026-11-22

## User goal

A developer who installs the factorydeck-skills factory on a project sees, with no configuration file, which role each sub-agent of the `build-feature` workflow plays (builder, reviewer, shipper, reworker, spec-checker) and what each role costs. The configuration file of spec 006 is only needed to change those roles.

## Acceptance criteria

- [x] With no configuration file, the roles are the default role rules of Rules: a sub-agent started as `Worker for #31` has the role `builder`, `Review #31` `reviewer`, `Ship #31` `shipper`, `Rebase feat/31-x` `reworker`, `check-spec #31` `spec-checker`, on `/roles`, on the session page and wherever spec 006 shows a role.
- [x] A configuration file without a `roles` key uses the default role rules too. A file with `roles: []` has no role rule: every sub-agent takes its type as role (or `unassigned`), as spec 006 describes for no matching rule.
- [x] A file with a `roles` list uses that list alone, as in spec 006 (the defaults are not merged into it); a project's `roles` override under `projects` replaces the list for that project, as in spec 006.
- [x] Under its heading, `/roles` says `No configuration file at <path>: default roles of the build-feature workflow.` when the file does not exist, with the resolved path; `Rules from <path>` when it exists, as in spec 006, even when the file has no `roles` key.
- [x] A `roles` key with no value (`roles:` alone, YAML null) stays an invalid file, as in spec 006: start-up ends with `Invalid configuration in <path>:` and a line naming `roles`.
- [x] A sub-agent no default rule matches (such as an `Explore` sub-agent, or a description like `Fix the build`) still takes its type as role, or `unassigned` with an empty type.
- [x] The change applies to all data already ingested at the next start, without re-ingesting, as in spec 006.

## Rules

- **Default role rules** (in this order, each matched on the sub-agent's description, case-insensitively, as in spec 006):
  - `builder`: `^(Build|Worker for) `
  - `reviewer`: `^Review `
  - `shipper`: `^(Ship|Merge|Push) `
  - `reworker`: `^(Rework|Rebase|Update) `
  - `spec-checker`: `check-spec`

  They are the rules `factorydeck.example.yml` already holds (spec 006), and they match the descriptions `build-feature` of factorydeck-skills gives the agents it starts (`check-spec #<n>`, `Worker for #<n>`, `Review #<n>`, `Ship #<n>`).

- This replaces the rule of spec 006 « Defaults: `roles` is empty ». The default `work_items` rules of spec 006 do not change.
- A missing key takes its default; an empty list is a value, not a missing key. This is the same for `roles` and for `work_items`.
- `factorydeck.example.yml` keeps its `roles` list, with a comment saying these are the defaults and that removing the key keeps them, while `roles: []` groups sub-agents by type.
- The README section on roles and work items says that without a file the roles of the `build-feature` workflow apply, and that the file is only needed to change them.
- The configuration is still read once at start-up and never written by FactoryDeck (spec 006).

## Expected proof

- Vitest tests of the configuration loader: no file gives the default role rules in their order; a file without `roles` gives them too; `roles: []` gives none; a file with its own `roles` gives only those; a project override replaces them for that project.
- Vitest tests of role resolution with the defaults: each of the five descriptions of the first criterion gives its role; `Explore` with a description no rule matches keeps `Explore`; an empty type with no match gives `unassigned`.
- The Storybook story of `/roles` without a configuration file shows the new sentence; it passes the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo` (synthetic sessions): `/roles?period=all` lists `builder` and `reviewer` rows from the demo's `Worker for #13` and `Review #14` sub-agents (spec 010) and `Rules from <path>` for the demo's file; a screenshot is attached to the pull request. The demo's file no longer copies the global `roles` of `factorydeck.example.yml` (only `version: 1` and its project override), so those rows come from the defaults.

## Out of scope

- Reading roles from a project's `docs/agents/factory.yml`, or detecting which coding agent or workflow a project uses.
- Changing the default `work_items` rules, or reading work items from branches by default.
- Writing or generating `factorydeck.yml` from FactoryDeck or from `setup-factory`.
- Merging default rules into a file's own `roles` list.
