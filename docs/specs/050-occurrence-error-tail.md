# 050 · Show the error of each friction occurrence

Status: ready
Depends on: 048
Checked: 2026-11-24

## User goal

A developer opens a `Command failed` row and sees at a glance why each command failed: its exit code and the end of its output, where the error is, in red. When that is not enough, they open the full output of that occurrence without leaving the page.

## Acceptance criteria

- [ ] For a tool error whose tool is a shell tool (spec 040, spec 043), the occurrence shows, under its call input:
  - a line `Exit code <n>` in `--fd-ink-2` when the friction has an exit code, nothing otherwise;
  - the **error excerpt**: the last 5 non-empty lines of the output (rules), in `--fd-danger`, in `--fd-font-mono`, wrapping, with no horizontal scroll;
  - `No output.` in `--fd-ink-2` in place of the excerpt when the output has no non-empty line once cleaned (rules).
- [ ] For a tool error of any other tool, the error excerpt is the first 3 non-empty lines of the result, as spec 048 says, now in `--fd-danger`. A stop block's hook message is unchanged (spec 048), in `--fd-ink-2`.
- [ ] A tail excerpt longer than 300 characters keeps its last 300 and starts with `…`; a head excerpt keeps its first 300 and ends with `…` (spec 048).
- [ ] When the cleaned output (or hook message) holds more than its excerpt shows, a button `Show full output` sits under the excerpt (`aria-expanded`, accessible name `Show full output of the occurrence at <date and time>`). Opening it shows, under the button, the whole cleaned text in `--fd-font-mono`, wrapping, in a box at most 20 lines high that scrolls vertically, never horizontally; the button then reads `Hide full output`. Several occurrences can be open at once; closing the row closes them.
- [ ] While the full output loads, the box reads `Loading…`; if the API does not answer, the unreachable message of `StatusLine` (spec 024); when the log or the record is gone, `The session log is no longer on this computer.` (spec 048).
- [ ] A full output longer than 400 lines or 20,000 characters keeps its end and starts with the line `… <n> earlier lines not shown.` (`1 earlier line not shown.` for one).
- [ ] `GET /api/frictions/occurrences` (spec 048) adds to each occurrence its friction `id`, its `exitCode` (number or `null`) and whether it has more text than its excerpt (`hasMore`). `GET /api/frictions/<id>/output` returns the full cleaned text of that friction, read from the log at each request; an `id` that is not a positive integer answers 400, an unknown `id` or the `id` of a friction that is neither a tool error nor a stop block (a compaction) 404, a gone log or record 200 with the log marked gone.
- [ ] The texts are still never written to the database, a cache, a file or the server's own output (spec 048).
- [ ] From 360 px wide, an open full output never makes the page scroll horizontally.

## Rules

- **Why the end**: coding agents write a shell call's standard output and then its error output in one text, and a chained command (`a; b && c`) exits with the code of the command that stopped it, usually the last one. The error is therefore at the end of the text, not at its start.
- **Shell tools**: the tools spec 040 (Claude Code) and spec 043 (Codex) count as shell tools; the friction's `tool` column tells which. **Exit code**: the friction's stored `exit_code` (spec 040); it is not parsed again from the text.
- **Cleaning** (before the excerpt and the full output): the cleaning of spec 048 (colour codes, `<tool_use_error>` tag, the `Exit code <n>` line, the Codex output header, home folder as `~`), plus Claude Code's `Shell cwd was reset to <path>` line when it is the last non-empty line. Blank lines are kept in the full output and dropped from the excerpt.
- **Tail excerpt**: the last 5 non-empty lines of the cleaned text, joined by line breaks, then cut to its last 300 characters, never splitting a surrogate pair.
- **hasMore**: true when the cleaned text, blank lines dropped, differs from the excerpt (more lines, or the excerpt was cut).
- **Full output API**: the `id` locates the friction in the database, whose source file, record and position locate the text exactly as spec 048 does; no file path is ever taken from the request. The page's filters do not apply to it.
- The excerpt colour is the design token `--fd-danger`, which has its light and dark values; no new token.

## Expected proof

- Vitest tests over synthetic Claude Code and Codex logs: a chained command whose earlier commands print lines and whose last command prints the error, more than 5 lines, more than 300 characters, an empty output, a trailing `Shell cwd was reset` line, a non-shell tool error (head kept), a stop hook message, a full output over 400 lines and over 20,000 characters, `hasMore` true and false, the output endpoint with a bad, unknown and gone `id`; and a test that no text reaches the database.
- Storybook stories of `FrictionOccurrences`: a shell error with its exit code and tail, `No output.`, a non-shell error, a full output open, loading, unreachable, gone, at 360 px and 1024 px, light and dark; a `play` that opens and closes a full output with the keyboard and checks `aria-expanded`. They pass the axe check of `src/ui/stories.test.tsx`; the `--fd-danger` contrast is checked in Storybook in both themes.
- On the real app, with `pnpm demo`: a screenshot of `/frictions` with a `Failed commands` row open and one full output open, at 1024 px, attached to the pull request.

## Out of scope

- Guessing which lines are errors from their words (`error`, `fatal`…), or highlighting single lines.
- Splitting standard output from error output, which the logs do not keep apart.
- Showing which part of a chained command failed.
- Storing any command or output text, or ranking frictions by error message.
