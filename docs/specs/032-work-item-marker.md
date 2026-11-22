# 032 · Work item marker

Status: ready
Depends on: 010
Checked: 2026-11-22

## User goal

A developer who writes a spec with an agent (Claude Code, Codex or another) sees that work counted on the spec's issue and under the role that did it, without renaming the session by hand: the agent writes a closing line such as `Work item: #88 (spec-writer)`, and FactoryDeck gives the session's calls to that issue and that role.

## Acceptance criteria

- [ ] `pnpm ingest` stores, for each assistant record of a session's main log that holds text, the last non-empty line of that text (trimmed, at most 200 characters; a longer line is not stored) with the record's timestamp. Sub-agent logs, tool calls and tool results are not read for this. Re-reading a file follows the rules of spec 002: nothing is stored twice, and a file replaced by a shorter one drops the lines it lost.
- [ ] The `work_items` rules of spec 006 accept a fourth source, `from: marker`: the stored closing lines of the main thread. A closing line is a marker when the rule's pattern matches it and its capture is a positive whole number. A `marker` pattern may also hold a named group `role`; the default rules become `[{ from: marker, pattern: '^Work item: #(\d+)(?: \((?<role>[a-z][a-z0-9-]*)\))?$' }, { from: description, pattern: '#(\d+)' }, { from: title, pattern: '#(\d+)' }]`, so `Work item: #88` and `Work item: #88 (spec-writer)` are both markers.
- [ ] When a session has at least one marker, its main-thread calls are split at the markers, whatever the position of the `marker` rules in the list: a call goes to the issue of the first marker at or after its timestamp; calls after the last marker go to the last marker's issue. The other rules then give no work item to the main thread. A session with no marker keeps the behaviour of spec 006.
- [ ] Main-thread calls split to a marker whose `role` group matched take that role (`spec-writer`), on `/roles`, in the `Split by role` of Features and on the issue page; a marker without a role, or whose role is `main` or `unassigned`, leaves its calls to `main`. Sub-agents keep their roles (spec 006). On `/roles`, a session counts as one thread in each role its main-thread calls fall in; each call still has exactly one role, so totals add up.
- [ ] A sub-agent tries its own rules (`description`, `branch`, `title`; `marker` is skipped for it); with no match, it takes the main thread's work item at the time of its first record, as split above.
- [ ] The `Work item` of the session list and session page (spec 006) shows the last marker's issue when the session has markers.
- [ ] Features, the issue page and the overview count the split calls on their issues (spec 010): a main-thread call that has a work item through a marker keeps it and takes no part in the orchestration share; totals still equal the overview's.
- [ ] `factorydeck.example.yml` lists the `marker` rule first, with a comment saying it reads the last line of the agent's replies and that the `write-spec` skill of factorydeck-skills writes `Work item: #<n> (spec-writer)` there, and that the text in parentheses becomes the role of the calls.
- [ ] An invalid `marker` rule (a pattern without exactly one unnamed capture group, a named group other than `role`, one that does not compile) is a configuration error, reported as spec 006 says.

## Rules

- Markers, like other work items, belong to the session's project (spec 006); a marker applies to every period: the split depends on timestamps only.
- Two markers with the same timestamp: the later one in the file wins.
- The marker convention is a default, not a hard-coded rule: a file whose `work_items` omits the `marker` rule reads no marker (spec 006: a file's list replaces the defaults).
- Only logs FactoryDeck already ingests are read (Claude Code, spec 002); other agents' logs are a later spec, and their markers will count the same way once read.

## Expected proof

- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), over synthetic sessions: a closing line stored and re-read without duplicates, a line over 200 characters skipped, one marker, a marker with a role and one without, two markers splitting calls (before the first, between, after the last), a marker beating a `title` rule, a sub-agent inheriting the marker in force at its first record, a session without marker unchanged, a file with no `marker` rule, Features totals equal to the overview.
- On the real app: a session whose last reply ends with `Work item: #<n> (spec-writer)` shows that issue in `/sessions`, its tokens in `/features` and a `spec-writer` row on `/roles`; screenshots attached to the pull request.

## Out of scope

- Reading Codex or other agents' logs.
- Markers in sub-agent logs, in tool calls or anywhere else than the last line of a main-thread reply.
- Editing a session's work item from FactoryDeck.
