# 040 · Friction ingestion

Status: done
Depends on: 007
Checked: 2026-11-22

## User goal

A developer will see where their agents stumble: tools that fail or are refused, checks that stop an agent from finishing, contexts that fill up and get compacted. This spec records those frictions from the session logs, in terms that do not depend on one coding agent, and never keeps the text of an error or a command; spec 041 shows them.

## Acceptance criteria

- [x] `pnpm ingest` stores one friction per event below, with: its session, its sub-agent (if any), its time, the coding agent that wrote the log (`claude-code` for the logs read today), its kind and the fields of that kind. Kinds and categories are the same for every coding agent; each agent's log format has its own reader, and this spec ships the Claude Code reader only.
- [x] **Tool error** (kind `tool-error`): a tool call whose result reports an error. Fields: the tool's name as the log writes it (`Bash`, `Edit`, `mcp__server__tool`), a category (rules), and for a shell command (`Bash` in Claude Code) its program, its exit code when the result gives one, and a hash of the full command.
- [x] **Stop blocked** (kind `stop-blocked`): a check or hook that refused to let the agent end its turn. Fields: the hook's command as configured, with the person's home folder written `~`. One friction per refusing hook.
- [x] **Context compacted** (kind `compaction`): the agent's conversation was compacted. Fields: the trigger (`auto` or `manual`), and the tokens before and after when the log gives them, else none.
- [x] No error text, tool output, command text, file content or prompt is stored, only the fields above. The command hash is the SHA-256 of the command text with leading and trailing spaces removed, in hexadecimal.
- [x] Re-reading a file follows spec 002: a grown file adds only its new frictions, a replaced or shorter file replaces its earlier frictions, nothing is stored twice; frictions are deleted with their session, and with their project (spec 007).
- [x] The first ingestion after this spec reads every file already ingested once more from its start for frictions only (no other row changes, no duplicate), then records that it is done, so later runs stay incremental.
- [x] The summary line of spec 002 gains `<f> frictions` after the skill launches: `Ingested 3 files: 2 sessions, 1 sub-agents, 40 API calls, 2 skill launches, 5 frictions, 0 lines skipped, 0 sessions skipped (no factory).`
- [x] The demo sessions (`src/demo/sessions.ts`) hold synthetic frictions of every kind and category, in a main thread and in sub-agents, including the same failing command three times in a row in one thread.

## Rules

- **Claude Code reader**:
  - A tool error is a `tool_result` block with `is_error: true` in a `user` record; its tool is the name of the `tool_use` block with the same id in the same file. A result whose call is not found has the tool `unknown`.
  - Its **category**, the first that applies, from the result's text (string content, or the text blocks joined), its markers and `Exit code` matched after trimming leading whitespace:
    1. `permission-denied`: the text starts with `Permission for this action was denied`, `Permission for this command was denied`, `Permission to use ` (and holds `has been denied`), or `The user doesn't want to proceed with this tool use`, or holds `was blocked by a deny rule`;
    2. `hook-blocked`: the text starts with `<event>:<tool> hook error`, where `<event>` is a hook event name such as `PreToolUse` or `PostToolUse`;
    3. `tool-misuse`: the text starts with `<tool_use_error>` (a file edited before it was read, a string to replace not found, a blocked pattern);
    4. `command-failed`: the tool is a shell command and the text starts with `Exit code <n>`; `<n>` is the exit code;
    5. `other`.
  - The **program** of a shell command is the first word of its first part that is not a `cd`, parts being split on `&&`, `||`, `;`, `|`, a newline, `(` and `)`, after leading `NAME=value` assignments and skipping the words `{`, `}` and `$`; a path keeps its last segment (`./scripts/x.sh` → `x.sh`). An empty command has no program.
  - A stop blocked is each entry of `hookErrors` of a `system` record with subtype `stop_hook_summary`; the hook's command is the text inside the leading `[…]` of the entry, ending at the first `]: `, else at the last `]`; else empty.
  - A compaction is a `system` record with subtype `compact_boundary`; trigger and tokens come from its `compactMetadata` (`trigger`, `preTokens`, `postTokens`). A compaction with no trigger stores a null trigger; any other trigger string is kept as written.
- A friction record with no valid timestamp is not stored and counts in the lines skipped.
- A run that only did the one-time read prints the summary line with its frictions (`Ingested 0 files: … <f> frictions …`), not `Nothing new.`.
- A friction belongs to the thread of its record (main thread or sub-agent, spec 006), so it takes that thread's role and work item wherever spec 041 needs them.
- These markers are those Claude Code writes today; a text that matches none is `other`, never dropped. Other coding agents get their reader with the ingestion of their sessions, in a later spec.
- Logs of projects without the factory are skipped as spec 007 says.

## Expected proof

- Vitest tests of the Claude Code reader on synthetic records: each category and its order (a denied text that also starts with `Exit code`), a tool result without its call, a shell program after `cd x &&`, `FOO=1`, a path and a pipe, an empty command, the hash of a command with surrounding spaces, a stop hook summary with two errors and with none, a compaction with and without metadata, and that no text of the record is kept.
- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of re-reading (a grown file, a replaced file), the one-time read of files already ingested (frictions added, other rows unchanged, a second run reads nothing), deletion with the session and the project, and the summary line.
- `pnpm demo`, then a query of the demo database listing the frictions by kind and category, its output attached to the pull request.

## Out of scope

- Showing frictions (spec 041).
- Reading the session logs of other coding agents (Codex, Gemini CLI, Copilot, Cursor): a later spec ingests their sessions and adds their friction reader.
- Failed CI checks of pull requests: the git host gives only the current summary of the head commit (spec 008), not its history.
- User interruptions, API errors and rate limits written by the agent, context size per call (already in the API calls of spec 002).
- Storing any error text, command text or excerpt.
