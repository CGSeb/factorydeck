# 002 · Session ingestion

Status: done
Depends on: none
Checked: 2026-11-21

## User goal

A developer runs one command and every Claude Code session on their machine, sub-agents included, is stored in FactoryDeck's database with its project, models, token usage and skill launches, ready for the views to read. Running it again only reads what is new.

## Acceptance criteria

- [x] `pnpm ingest` reads every `*.jsonl` file under the sessions folder, including the sub-agent logs in `<session id>/subagents/agent-*.jsonl` and their `agent-*.meta.json`, and stores them in PostgreSQL.
- [x] The sessions folder defaults to `~/.claude/projects` and can be changed with the `CLAUDE_PROJECTS_DIR` variable of the root `.env`; an empty value falls back to the default, like every FactoryDeck variable. A folder that does not exist ends the command with exit code 1 and the message `Sessions folder not found: <path>`.
- [x] For each session it stores: the session id, the project (see Rules), the working directory, the git branch (`gitBranch` of the last record that carries a working directory; title and last-prompt records have none), every git branch it was on (the non-empty `gitBranch` values of those records, each once, in the order it first appeared), the title (latest `custom-title` record, else empty), the time of the first and last record, and whether its last assistant turn has ended (see Rules).
- [x] For each sub-agent it stores: its agent id, the session it belongs to, the tool call that started it (`toolUseId` of the meta file), its type, description and model as written in the meta file, and the time of its first and last record. A sub-agent without a meta file is stored with an empty type and description.
- [x] For each assistant record that carries `message.usage`, it stores one API call: session, sub-agent (if any), timestamp, model, input, cache write, cache read and output tokens. Records repeating the same `requestId` in the same file are stored once.
- [x] For each `Skill` tool call it stores one skill launch: session, sub-agent (if any), timestamp, the skill name exactly as written in the call (`input.skill`, for example `factorydeck-skills:write-spec`), and the record it was made from.
- [x] A skill typed as a slash command (a user prompt whose text holds `<command-name>/<name></command-name>`) is also stored as a skill launch, named without the `/`, when a following `isMeta` record of the same `promptId` carries the skill's instructions. A built-in command (`/clear`, `/model`…) has no such record and is stored as a user prompt only.
- [x] For each record typed by the user (a `user` record whose content is text, or images alone, not a tool result, without `isMeta: true`, and that is not a sidechain record) it stores a user prompt marker, except the records Claude Code writes itself: text starting with `<task-notification>`, `<local-command-stdout>`, `<local-command-stderr>`, `<local-command-caveat>`, `<bash-stdout>` or `<bash-stderr>`, `isCompactSummary` records and `[Request interrupted by user…]` markers. Each marker holds the session and the timestamp. Neither the prompt text nor its images are stored.
- [x] Assistant records of the model `<synthetic>` (errors written by Claude Code itself) are not stored as API calls.
- [x] A second run with no file changed reads no bytes and prints `Nothing new.`
- [x] A file that grew since the last run is read from its stored offset only; a file that shrank or was replaced (size smaller than the stored offset) is read again from the start and its earlier rows are replaced, without duplicates.
- [x] A line that is not valid JSON, a record of an unknown type, or a `user` or `assistant` record without a valid timestamp, is skipped and counted; a last line without a trailing newline is left for the next run (the offset stops before it).
- [x] At the end it prints one summary line: `Ingested <n> files: <s> sessions, <a> sub-agents, <c> API calls, <k> skill launches, <x> lines skipped.`
- [x] Running two `pnpm ingest` at the same time does not duplicate rows: the second one waits for the first or exits with `Ingestion already running.` and exit code 0.
- [x] Ingestion is exposed as a function that the web server of spec 003 can call, returning the same counts as the summary line.

## Rules

- **Project**: the main git repository of the session's working directory. When the folder still exists, it is resolved with git (`git rev-parse --path-format=absolute --git-common-dir`, parent folder), so a worktree counts for its main repository. When the folder no longer exists, a session whose working directory is inside the root of a project already known belongs to that project. Otherwise the working directory itself is the project. The project name shown later is the last segment of its root path.
- When the main log of a session has no working directory (or is missing), the session takes its working directory, project and git branch from one sub-agent: the one whose first record is the earliest among the sub-agents that have a working directory (ties go to the smallest agent id). The working directory is that sub-agent's first one; the git branch is the `gitBranch` of its last record that carries a working directory, and it is the only branch the session was on (none when it is empty). A working directory found later in the main log replaces both, and re-reading either log keeps the right ones.
- Sessions stored before the list of branches existed get it at the first run after the upgrade, which reads every main session log again from the start once, without storing any row twice.
- A session with no working directory in any record goes to the project `unassigned`; it is still stored with all its calls.
- **Turn ended**: the last assistant record of the main thread has `stop_reason` `end_turn`, `stop_sequence`, `max_tokens` or `refusal`, and no prompt that reaches the model follows it: a typed user prompt (not a slash command) or a slash skill (its instructions record). Built-in commands (`/model`, `/clear`…) and the records Claude Code writes itself (command output, caveats, task notifications, meta messages, tool results) do not reopen the turn; or an interruption (`[Request interrupted by user…]`) follows the last assistant record of the main thread. An assistant record after an interruption clears it: the turn then follows that record's `stop_reason` again. Any other `stop_reason` (`tool_use`, `pause_turn`, missing) means the turn is still going.
- **User prompts** are only prompts the user typed: spec 005 ends a skill's attribution at the next user prompt, so a record Claude Code writes itself (a task notification, a command's output, a compact summary, an interruption marker) must not end it.
- A missing git branch is stored empty; the views show `—`.
- Sub-agent API calls belong to the sub-agent and to its parent session; nothing is dropped because it matches no rule.
- Token counts are stored as written in the log; cost is not stored but computed when shown, with `src/pricing.ts`.
- All data comes from the logs only; nothing is sent over the network.

## Expected proof

- Vitest tests over small synthetic fixture folders (a session, a sub-agent with its meta file, a worktree session, a session whose folder is gone, a truncated last line, a malformed line, a duplicated `requestId`, a file replaced by a shorter one), checking the stored rows against a test database.
- On the real app: `pnpm db:up && pnpm db:migrate && pnpm ingest` prints the summary line; running `pnpm ingest` again prints `Nothing new.`

## Out of scope

- Any web page or view (specs 001 and 003 to 005).
- Collecting GitHub issues, pull requests or labels.
- Roles, work items and outcomes from configuration.
- Storing prompt text, tool inputs or tool outputs beyond the skill name.
- Watching files for changes; periodic re-ingestion is in spec 003.
- Logs of other agents than Claude Code.
