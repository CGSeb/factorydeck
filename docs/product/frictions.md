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
- `session=<id>`, or `issue=<n>` with `project=<slug>`, opened from the [session page](sessions.md#session-page) or the [issue page](features.md#summary): a chip `Session: <title>` or `Issue: #<n> <title>` with a remove button (`Remove filter`). Every figure then counts that session's or issue's frictions, calls and threads only; `session` wins over `issue`; `issue` without `project` or not a positive whole number is ignored. An unknown session or issue shows its chip with the raw value and `No activity in this period.`

All filters combine. Changing one closes every open row.

At the end of the header controls, on the right of the filters and the filter chip and at the height of their first row in every state, `Copy friction report` copies the [report](#report) of the selection to the clipboard. It is disabled while the page loads, including while it reloads after a filter or period change (the last figures stay on screen, and the button keeps its place and label), so a copy is always of the selection on screen; when the selection has no friction (`No activity in this period.` or `No friction in this period.`), and under `All projects`, where its tooltip, on hover and on keyboard focus, says `Select one project to copy a friction report.`; it stays focusable. While the report is fetched it reads `Copying…`, then `Copied` for 2 seconds, or `Could not copy` for 4 seconds when the request or the clipboard fails. Its width is the same in every label.

Beside it, `Copy and mark as reported` copies the same report and records it as handed to an agent (see [Reported frictions](#reported-frictions)). Its states, labels, disabled cases and tooltip are those of `Copy friction report`; when the clipboard fails after the report was recorded, it reads `Could not copy` and the report stays recorded. Under the two buttons, `Last report <relative time>` (`just now`, `5 min ago`, `3 h ago`, `2 d ago`) gives the latest report marked for the selected project; the line is empty when none was marked and under `All projects`, keeps its place, and keeps its last text while the page reloads. It updates at once after a mark.

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

A friction [sent by a CLI](cli.md#frictions) holds no text. The instance first looks for its record in a log on this computer; when it is not there and the friction's file key is one a CLI sent, the occurrence shows `Exit code <n>` when known, then `Details stay on the developer's machine.` in place of its command and message, and never `Show full output`. Otherwise, `The session log is no longer on this computer.`

## Report

A Markdown report of every friction of the selection, for one project, to paste into an agent for a retrospective. It holds data only, no instructions, and counts exactly what the page counts for the same parameters.

- `# Friction report`, then `<project name> · <period label> · <from> to <to> (<tz>)` (under `All time`, `<from>` is the day of the earliest API call or friction of the selection), then the active filters (`Kind: Tool errors · Role: worker · Session: <title> · Issue: #<n> <title>`, only those set), then `<n> frictions · <r> per 100 API calls · <c> API calls`. With no friction, `No friction in this period.` follows and the report ends.
- `## Groups`: one row per **group**, the frictions sharing a key: `tool-error/<category>/<tool>/<program or ->` for a tool error, `stop-blocked/<hook command>` for a stop block. The key holds only recorded fields, never the text of an error or a command, so it stays the same from one report to the next. Rows are sorted `New` groups first, then reported ones, each by frictions then key, with `#`, `Status` (the group's [tag](#reported-frictions)), `Kind`, `Category`, `Tool`, `Program`, `Hook` (cut at 80 characters with `…`), `Frictions`, `Threads`, `Last`; `—` where a column does not apply. Every group is listed, here or under `## Reported before, not seen since`; compactions never are.
- One section per group, `## <#>. <category or Stop blocked> · <tool or hook> · <program>`, with its tag as its first line, then its `Key`, frictions, threads, roles (`worker (8), reviewer (4)`, by frictions then name), issues (`#12 <title> (5)`, the same order, at most 10 then `, …`, `unassigned` for frictions without one), for a shell command its distinct exit codes and distinct commands, the threads where one command failed 3 times or more when there is one, and its first and last times. Times are in the report's time zone.
- Under each of the first 20 groups of that order, `### Occurrences`: up to 3, latest first (for a reported group, only those after the latest report that held it), each the latest of a distinct command (another tool: a distinct input, among its 30 latest frictions; a stop block: any), filled with the next latest ones. Each has a `#### <date time> · <role> · <issue or unassigned> · <session title> (<session id>)` line, then:
  - a shell error: its command in a `bash` fence (up to 2000 characters), `Exit code <n>` when known, the last 40 non-empty lines of its output in a `text` fence (up to 4000 characters, `…` at the start past that), or `No output.`;
  - another tool: its input as compact JSON in a `json` fence (up to 2000 characters; an input recorded as plain text is written as a JSON string) and the first 20 non-empty lines of its result in a `text` fence (up to 2000 characters);
  - a stop block: the hook's message, first 20 non-empty lines, in a `text` fence.

  Texts are cleaned as the [occurrences](#occurrences) are. A fence is one backtick longer than the longest run of backticks in its text, and at least three. When the log or the record is gone: `The session log is no longer on this computer.` For a friction sent by a CLI: `Details stay on the developer's machine.`, then `Exit code <n>` for a shell error when known. Groups and their keys are built from recorded fields, so frictions read on this computer and sent by a CLI share groups and tags.

- Past 20 groups: `<k> more groups are listed without occurrences.`
- `## Reported before, not seen since`: the reported groups with no friction since, which leave `## Groups` and have no section; one line each, ``- `<key>` · reported on <date time> · <frictions> before``, sorted by frictions then key. Left out when empty. When every group of the selection is there, the report has no `## Groups`.
- `## Context`: `Median context peak: <tokens> · <k> of <n> threads compacted`, as on the page; left out under a kind.

Texts are read from the session logs at each request and never written to the database, a cache, a file or the server's output.

### Reported frictions

`Copy and mark as reported` records a **report**: its time, the project, the period, the filters (kind, role, session, issue) and each group of the selection with its key and frictions. It never holds a text of an error, a command, an output or a hook message: only the keys, which hold only recorded fields, and the counts. Reports are kept with no limit, and deleting a session does not delete them; [removing a project](projects.md#removing-a-project) deletes its reports. A report is recorded even when the selection has no friction (it then holds no group).

Each later report of the same project tags each group, on its `## Groups` row and as the first line of its section:

- `New`: no earlier report of the project held its key;
- `Reported on <date time> · <n> since`: the latest earlier report of the project that held it (latest time, then latest recorded), and the group's frictions strictly after that report's time, within the current selection and period; with 2 earlier reports or more holding it, `Reported on <date time> (<k> times) · <n> since`.

Every earlier report of the project counts, whatever its filters and period. Tags are computed at each request; nothing else about a group is stored.

## API

- `GET /api/frictions` with `period`, `tz`, `project`, `kind`, `role`, `session`, `issue`: the header figures, the kind and role counts, the trend as `unit` and `buckets`, every table, the context peaks, and `lastReportAt`, the time of the latest report marked for `project` (`null` when none was, or without `project`).
- `GET /api/frictions/occurrences`: the same parameters plus the table and the row (`<session>/<sub-agent>/<command hash>` for a repeated failure); at most 5 occurrences, each with its `id`, `exitCode`, texts, `hasMore` and `details`: `local` (texts read from a log on this computer), `remote` (sent by a CLI: no texts, `hasMore` `false`) or `gone`. A row that cannot exist answers 400; a row with no friction, an empty list.
- `GET /api/frictions/report` with the parameters of `GET /api/frictions`: the [report](#report) as `text/markdown; charset=utf-8`. Without `project`, or with an empty one, it answers 400; with the database unreachable, as `GET /api/frictions` does. It writes nothing anywhere.
- `POST /api/frictions/reports` with the same parameters: records a [report](#reported-frictions) and answers the same Markdown as `GET /api/frictions/report`, with the tags of the reports recorded before it. Without `project`, or with an empty one, it answers 400 and records nothing; with the database unreachable, as `GET /api/frictions` does.
- `GET /api/frictions/<id>/output`: the full cleaned text of one tool error or stop block, `{ "status": "ok", "gone": true }` when its log is gone, or `{ "status": "ok", "gone": true, "remote": true }` for one sent by a CLI. A non-positive `id` answers 400, an unknown one or a compaction 404. No file path is ever taken from the request.
