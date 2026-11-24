# Frictions

`/frictions` shows where the agents stumbled in the period, so the person knows what to fix in their tools, permissions or instructions: tool errors and checks that stopped an agent from finishing, by category, tool, command, role and issue, with the latest occurrences read from the logs.

## What is recorded

`pnpm ingest` records each friction with its thread, time and coding agent, never the text of an error or a command. Kinds and categories are the same for every agent; each agent's log format has its own reader.

- **Tool error** (`tool-error`): a tool call whose result reports an error. Fields: the tool's name as the log writes it (`Bash`, `Edit`, `mcp__server__tool`; `unknown` when its call is not found), a category, and for a shell command its program, exit code and the SHA-256 of the trimmed command.
- **Stop blocked** (`stop-blocked`): a hook that refused to let the agent end its turn, one per refusing hook, with the hook's command (home folder written `~`).
- **Compaction** (`compaction`): the conversation was compacted, with its trigger (`auto`, `manual`) and the tokens before and after when the log gives them. Compactions are recorded but are not frictions: only [Context peaks](#context-peaks) reads them.

A friction belongs to its thread, and takes the role and work item its calls get there; in a main thread split by [markers](roles-and-work-items.md#work-item-marker), the marker in force at its time.

### Categories of a tool error

The first that applies, from the result's text:

1. `permission-denied` (`Permission denied`): the text starts with `Permission for this action was denied`, `Permission for this command was denied`, `Permission to use ` (with `has been denied`), or `The user doesn't want to proceed with this tool use`, or holds `was blocked by a deny rule`.
2. `hook-blocked` (`Blocked by a hook`): the text starts with `<event>:<tool> hook error` (`PreToolUse:Bash hook error`).
3. `tool-misuse` (`Tool misuse`): the text starts with `<tool_use_error>` (a file edited before it was read, a string to replace not found).
4. `command-failed` (`Command failed`): a shell command whose text starts with `Exit code <n>`.
5. `other` (`Other`): anything else, never dropped.

In Codex logs: a shell command with a non-zero exit code is `command-failed`; any other tool output the log marks as failed (an MCP call in error, a failed patch, a function output with `success: false`) is `other`; a compaction record is a compaction with trigger `auto`.

**Program** of a shell command: the first word of its first part that is not `cd`, parts being split on `&&`, `||`, `;`, `|`, newlines and parentheses, after leading `NAME=value` assignments and skipping `{`, `}` and `$`; a path keeps its last segment (`./scripts/x.sh` → `x.sh`, `C:\tools\pwsh.exe` → `pwsh.exe`).

## Page

The header `Frictions` says `<n> frictions · <r> per 100 API calls` (one decimal), or `No friction · <c> API calls`. The API calls are those of the overview for the same selection.

### Filters

- `Kind`: `All`, `Tool errors`, `Stop blocked`, each with its count. URL parameter `kind` (`tool-error`, `stop-blocked`); another value means `All`.
- `Role`: `All`, then one pill per role with a thread that has a call in the period, with its frictions, sorted by frictions then name, `unassigned` last. URL parameter `role`, matched exactly. With a role, every figure counts only that role's threads, calls and frictions, and `By role` is left out.
- `session=<id>`, or `issue=<n>` with `project=<root>`, opened from the [session page](sessions.md#session-page) or the [issue page](features.md#summary): a chip `Session: <title>` or `Issue: #<n> <title>` with a remove button (`Remove filter`). Every figure then counts that session's or issue's frictions, calls and threads only; `session` wins over `issue`; `issue` without `project` or not a positive whole number is ignored. An unknown session or issue shows its chip with the raw value and `No activity in this period.`

All filters combine. Changing one closes every open row.

### Blocks

One full-width column, in this order; a block left out leaves no gap:

- **Trend**: `Frictions per 100 API calls, by <unit>`, cut as on [Stats](stats.md#trend-cut), n = the bucket's API calls, tooltip `2.4 · 12 frictions`. Under `All time`, the first bucket holds the earliest API call of the selection.
- **By category** (with `All` or `Tool errors`): `Category`, `Errors`, `Share` (whole percent, `<1%` above 0), sorted by errors, ties in the category order above.
- **By tool**: `Tool`, `Errors`, `Main category`, `Threads`, sorted by errors then name.
- **Failed commands** (category `command-failed`): `Program` (`—` for none), `Failures`, `Exit codes` (distinct, ascending, at most 5 then `, …`), `Distinct commands`, sorted by failures then program.
- **Repeated failures**: one row per thread and command with 3 failures or more: `Program`, `Failures`, `Role`, `Issue`, `Session`, `Last`. With none: `No command failed 3 times in one thread.`
- **Stop blocked** (with `All` or `Stop blocked`): `Hook` (ellipsed, full text in its tooltip), `Blocks`, `Sessions`, `Last`.
- **By role**: `Role`, `Threads` (as `/roles` counts them), `Frictions`, `Per thread` (one decimal), `Main kind`; sorted by per thread, then frictions, then name.
- **Issues with the most frictions**: `Issue`, `Project` (only with `All projects`), `Stage`, `Frictions`, `Repeated failures`; sorted by frictions then number; left out under an issue filter.
- **Context peaks** (with `All` only).

Tables show 10 rows, then `Show more`. A table with no row is left out. With no API call in the period: `No activity in this period.`; with calls but no friction: `No friction in this period.` under the filters and the trend.

### Context peaks

The **context peak** of a thread is the largest input-side size (input, cache write and cache read tokens) of one of its calls in the period. `Median context peak` (n = threads with a call, lower is better) with `<k> of <n> threads compacted` beside it (threads with a compaction in the period), and a strip of the threads by peak, each linking to its session. The share of a model's context window is not known.

## Occurrences

Each row of `By category`, `By tool`, `Failed commands`, `Repeated failures` and `Stop blocked` opens (`Show occurrences of <row>`) to `Latest occurrences`: its 5 latest frictions under the page's filters, latest first. Several rows can be open.

Each occurrence shows its date and time, role, issue and session, then:

- for a **shell** error: its command, `Exit code <n>` when known, and the last 5 non-empty lines of its output in the danger tone, or `No output.` Coding agents write standard output then error output in one text, and a chained command exits with the code of the command that stopped it, so the error is at the end;
- for **another tool**: its input as compact JSON and the first 3 non-empty lines of its result;
- for a **stop block**: the hook's message, first 3 non-empty lines.

Texts are cleaned (colour codes, the `<tool_use_error>` tag, the `Exit code` line, Codex's output header, a last `Shell cwd was reset to <path>` line), with the home folder written `~`, and cut at 300 characters (`…` at the start of a tail, at the end of a head). When there is more, `Show full output` opens the whole cleaned text in a box at most 20 lines high; past 400 lines or 20,000 characters it keeps the end, after `… <n> earlier lines not shown.`

Texts are read from the session log at each request, line by line up to the record, and never written to the database, a cache, a file or the server's output. When the log or the record is gone: `The session log is no longer on this computer.`

## API

- `GET /api/frictions` with `period`, `tz`, `project`, `kind`, `role`, `session`, `issue`: the header figures, the kind and role counts, the trend as `unit` and `buckets`, every table and the context peaks.
- `GET /api/frictions/occurrences`: the same parameters plus the table and the row (`<session>/<sub-agent>/<command hash>` for a repeated failure); at most 5 occurrences, each with its `id`, `exitCode`, texts and `hasMore`. A row that cannot exist answers 400; a row with no friction, an empty list.
- `GET /api/frictions/<id>/output`: the full cleaned text of one tool error or stop block. A non-positive `id` answers 400, an unknown one or a compaction 404. No file path is ever taken from the request.
