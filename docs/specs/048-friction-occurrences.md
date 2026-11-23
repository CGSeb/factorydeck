# 048 · Friction occurrences from the session logs

Status: done
Depends on: 047
Checked: 2026-11-23

## User goal

A developer who sees that `git` failed 13 times opens that row and reads the latest commands that failed and the start of their error messages, so they know what to fix in their tools, permissions or instructions. FactoryDeck still stores no command or error text: it reads them from the session logs on this computer when the row is opened.

## Acceptance criteria

- [x] Each row of `By category`, `By tool`, `Failed commands`, `Repeated failures` and `Stop blocked` (spec 041) starts with a disclosure button (a chevron, `aria-expanded`, accessible name `Show occurrences of <row label>`, such as `Show occurrences of git`). Opening it inserts, right under the row and across every column, `Latest occurrences`: the 5 latest frictions of that row (or fewer) under the page's filters (period, project, kind, role, session, issue), latest first. Opening it again closes it. Several rows can be open at once; changing a filter closes them all.
- [x] Each occurrence shows on one line its local date and time (`22 Nov, 17:33`), its role (`RoleTag`, spec 016), its issue (`#<n>` linked to its issue page with the current period, or `—`) and its session (title, or its id's first 8 characters, linked to its session page, spec 027); under it, in `--fd-font-mono`, wrapping, with no horizontal scroll:
  - for a tool error: the call's input (rules), then the error excerpt (rules), in `--fd-ink-2`;
  - for a stop block: the hook's message (rules).
- [x] While the occurrences load, the inserted row reads `Loading…`; if the API does not answer, the unreachable message of `StatusLine` (spec 024). An occurrence whose log file is gone, or whose record or call is no longer found in it, shows its line and, in place of the texts, `The session log is no longer on this computer.`
- [x] `GET /api/frictions/occurrences` takes the parameters of `/api/frictions` (spec 047), plus the table and the row, and returns at most 5 occurrences with their time, role, issue, session and texts (or that the log is gone). Parameters are read and refused like `/api/frictions`; an unknown table or row answers 400.
- [x] The texts are read from the log at each request and are never written to the database, a cache, a file or the server's own output. The README's section on what FactoryDeck stores says so.
- [x] From 360 px wide, an open row never makes the page scroll horizontally.

## Rules

- **Reading the log**: the friction's source file and record (spec 040) locate it. Each coding agent's reader finds the failed call and its result as spec 040 (Claude Code) and spec 043 (Codex) identify them. Files are read line by line, stopping at the record, with no size or time limit. For a Codex call reported by several records, the first failing record of that call in the file gives the error text.
- **Call input**: for a shell tool, its command; for any other tool, its input as compact JSON. **Error excerpt**: the result's text (string content, or the text blocks joined), with terminal colour codes removed, the Claude Code `<tool_use_error>` wrapper tag removed (only its inner text shows), the `Exit code <n>` line left out (for Codex, the output header it writes before the output: `Chunk ID`, `Wall time`, `Process exited with code <n>`, `Original token count`, `Output:`), then its first 3 non-empty lines. **Hook message**: the reason text the log gives for the refusing hook, first 3 non-empty lines.
- Each text has the person's home folder written `~` and is cut at 300 characters, ending with `…` when cut.
- The 5 latest are chosen by friction time, then stored order (latest stored first), among the frictions the row counts under spec 041; a `Repeated failures` row is its thread and command.
- **Rows of the API**: only a value that cannot name a row of the table answers 400 (a missing `row`, a category outside the five, a `Repeated failures` row not written `<session>/<sub-agent>/<command hash>`); a well-formed row with no friction under the filters answers 200 with an empty list.
- **Open row**: the chevron and the row label form one button; `Latest occurrences` is an `h3`. A row with no program or no hook command is named `Show occurrences of no program` / `Show occurrences of no hook command`. When the row's frictions are gone it reads `No occurrence in this period.`; an empty error excerpt shows the input alone. Role colours inside an open row come from its own occurrences (a page-wide colour per role is a follow-up).

## Expected proof

- Vitest tests over synthetic Claude Code and Codex log files: a shell command, an MCP tool input, an error with colour codes and an `Exit code` line, more than 3 lines, more than 300 characters, the home folder, a stop hook's message, a missing file, a missing record, the 5 latest under each filter, an unknown table or row; and a test that no text reaches the database.
- Storybook stories: a table with a row open, an occurrence whose log is gone, loading, unreachable, at 360 px and 1024 px, light and dark; a `play` that opens and closes a row with the keyboard and checks `aria-expanded`. They pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of `/frictions` with a `Failed commands` row open, at 1024 px, attached to the pull request.

## Out of scope

- Storing command or error text, or ranking frictions by error message.
- Occurrences in `By role`, `Issues with the most frictions` or `Context peaks`.
- Logs of another computer.
