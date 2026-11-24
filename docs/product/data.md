# Data and collection

FactoryDeck builds everything it shows from two sources on the person's machine: the session logs of their coding agents, and their git host read through its CLI. It only reads: it never writes to the logs, to `docs/agents/factory.yml` or to the git host, and nothing is sent anywhere else.

## Factory projects only

A project has the factory installed when `docs/agents/factory.yml` exists at its root. Only the presence of the file counts; FactoryDeck reads three things from it (the project name, the git host and the outcome settings) and validates nothing else. A folder that cannot be read counts as no factory.

- **Project of a session**: the main git repository of its working directory, resolved with git (`git rev-parse --path-format=absolute --git-common-dir`, its parent), so a worktree counts for its main checkout. When the folder no longer exists, a session inside the root of a known project belongs to it; otherwise the working directory itself is the project.
- When a session's main log has no working directory, it takes the one of its earliest sub-agent that has one (ties: smallest agent id), with that sub-agent's branch; a working directory found later in the main log replaces it.
- Sessions of a project without the factory, of no working directory, or of a folder gone and inside no known project, are **not stored**. Their logs are skipped, and not read again while the file has not grown and the project still has no factory.
- When a project gains `docs/agents/factory.yml`, its skipped logs are read in full at the next ingestion: nothing from before the installation is lost.
- When a project already ingested loses the file (removed, or folder gone), its data stays in every view and its new sessions are no longer read. Every page then shows a [warning banner](navigation.md#banners) with a `Delete project` button.

### Deleting a project

Only a project whose factory configuration is no longer found can be deleted, from its banner line. The confirmation dialog `Delete <project name>?` says how many sessions go (counted when the dialog opens) and that the logs on disk are not touched. `Cancel` has the focus; `Escape`, `Cancel` or a click outside closes it.

Confirming deletes, in one transaction and under the ingestion lock, every stored row of the project (sessions, sub-agents, API calls, skill launches, prompts, frictions, closing lines, issues, pull requests, reports, label history, its name) and the read offsets of its logs. If the factory is installed again later, its logs are read again from their first line.

- While it runs, the button reads `Deleting…`. On success the banner line goes and every page refreshes; with no session left, the welcome screen shows.
- On failure, nothing is deleted and the dialog shows `Could not delete <project name>. Try again.`
- If the file is found again at the time of the request, the API answers 409 and the dialog shows `<project name> has its factory configuration again, so it was not deleted.` An unknown project answers 404: `<project name> is no longer in FactoryDeck.`

### Project names

A project shows under the `project.name` of its `docs/agents/factory.yml`, else under its folder name (the last segment of its root). The name is read at every ingestion run, even with no new session, so a rename shows within seconds without re-ingesting.

- A name that is missing, empty, not a string, under a `project` that is not a map, or in a file that is not valid YAML (a duplicated key included) counts as no name: the project keeps the last name read, or its folder name.
- A name is cleaned: line breaks, tabs and runs of spaces become one space; leading and trailing spaces go. Past 60 characters it shows its first 60 and `…`, with the full name and the root in its tooltip.
- Two projects with the same name (case-insensitive) both show as `<name> (<root>)`.
- The root path is the tooltip of a name everywhere. `unassigned`, the project of sessions stored before the factory-only rule, keeps its name and has no tooltip.
- The name is only a label: filters, URLs and groupings use the project root, and two projects with the same name are never merged.

## Session logs

`pnpm ingest` reads the logs into PostgreSQL; the server runs it at start-up and then every `FACTORYDECK_INGEST_INTERVAL_SECONDS` (default 10). One reader per coding agent writes the same rows, and every page counts every agent's sessions together. Each session records its agent: `claude-code` or `codex`.

### Claude Code

Every `*.jsonl` under `CLAUDE_PROJECTS_DIR` (default `~/.claude/projects`), sub-agent logs (`<session id>/subagents/agent-*.jsonl` with their `agent-*.meta.json`) included. A folder that does not exist ends the command with exit code 1 and `Sessions folder not found: <path>`.

- **Session**: id, project, working directory, its last git branch (the `gitBranch` of the last record that carries a working directory), every branch it was on (in the order each first appeared), its title (latest `custom-title` record, else empty), its first and last record times, and whether its last turn has ended.
- **Sub-agent**: agent id, session, the tool call that started it, its type, description and model from the meta file (empty without one), first and last record times.
- **API call**: one per assistant record with `message.usage`: thread, time, model and the four token kinds. A `requestId` repeated in a file counts once; records of the model `<synthetic>` (errors Claude Code writes itself) are not calls.
- **Skill launch**: each `Skill` tool call, named as written (`factorydeck-skills:write-spec`), and each skill typed as a slash command, named without its `/`, when an `isMeta` record of the same prompt carries its instructions. Built-in commands (`/clear`, `/model`) are not skills.
- **User prompt**: a time marker for each record the person typed (text, or images alone), never its text. Records Claude Code writes itself are not prompts: task notifications, command output and caveats, compact summaries, interruption markers.
- **Closing line**: the last non-empty line of each assistant text of the main log, trimmed, at most 200 characters (a longer line is not stored), with its time. It carries the [work item marker](roles-and-work-items.md#work-item-marker).
- **Turn ended**: the last assistant record of the main thread has `stop_reason` `end_turn`, `stop_sequence`, `max_tokens` or `refusal`, and no prompt that reaches the model follows it (a typed prompt or a slash skill; built-in commands and records Claude Code writes itself do not reopen the turn); or an interruption follows it. An assistant record after an interruption clears it. Any other `stop_reason` means the turn is still going.

### Codex

Every `rollout-*.jsonl`, at any depth, under `CODEX_SESSIONS_DIR` (default `~/.codex/sessions`). A missing folder is skipped without a message.

- **Session**: `session_meta.id`, `cwd` and `git.branch`, an empty title (shown `Codex session <first 8 characters of its id>`), first and last record times, and a turn ended when a `task_complete` follows the last `task_started`.
- **Sub-agent**: a rollout whose `session_meta` has `source.subagent.thread_spawn.parent_thread_id`. It belongs to the root session (`session_meta.session_id`, else the parent thread), whatever its depth. Its type is `agent_role` and its description `agent_path`, so the role rules match it like a Claude Code sub-agent. Records copied from its parent (before `subagent_history_start_ordinal`) are not read for prompts, closing lines, frictions or times, and its model is the first one its own records name.
- **API call** per model response, from its `token_usage_record` (or each `token_count`'s `last_token_usage`, skipping a total equal to the previous one): cache read = `cached_input_tokens`, cache write = `cache_write_input_tokens` (0 when missing), input = `input_tokens` minus both (at least 0), output = `output_tokens` (reasoning already included). A `response_id` counts once per root session. The model is that of the latest `turn_context` or `thread_settings_applied`.
- **User prompt**: each `user_message` event or completed `UserMessage` item. **Closing line**: the last non-empty line of each `task_complete`'s `last_agent_message`.
- Skill launches are not read from Codex logs.
- **WSL**: when FactoryDeck runs under WSL (`/proc/version` names Microsoft or WSL), a Windows working directory `X:\a\b` is read as `/mnt/x/a/b`, so a Codex session run on Windows joins the project of the same folder.

### Re-reading

- A second run with nothing changed reads no byte and prints `Nothing new.`
- A grown file is read from its stored offset; a shorter or replaced file is read again from the start and its rows are replaced, without duplicates.
- An invalid JSON line, an unknown record type, or a record without a valid time is skipped and counted; a last line without a newline waits for the next run.
- Two runs never overlap: the second one waits or exits with `Ingestion already running.` (exit code 0).
- The summary line: `Ingested <n> files: <s> sessions, <a> sub-agents, <c> API calls, <k> skill launches, <f> frictions, <x> lines skipped, <s> sessions skipped (no factory).`
- A change that needs older logs read again (a new kind of row) reads every file once more for that row only, then records that it is done.

## Git host

For each factory project, FactoryDeck reads `repository.git_host` (`github` or `gitlab`) and `repository.git_host_commands` from its `docs/agents/factory.yml`, then in that file the CLI (`- CLI: \`<command>\``, default `gh`or`glab`) and the repository (`- Repository: \`<owner>/<name>\``or`- Project: \`<group>/<project>\``). It also reads `issues.labels`and`build.auto_merge` for the [outcomes](outcomes.md). These are read at every run, so a change applies at the next one.

Collection runs at server start, then every `FACTORYDECK_COLLECT_INTERVAL_MINUTES` (default 5); `pnpm collect` runs one and prints `Collected <p> projects: <i> issues and <r> pull or merge requests updated.` (exit code 1 when a project failed). The first run of a project reads everything; later runs only what was updated since the start of the last successful run. A change in what is collected reads each project again in full once, keeping its data on screen meanwhile.

- **Issue**: number, title, state, labels with their colour, URL, creation and close times, whether it was reopened (timeline events on GitHub, state events on GitLab), and the times its needs-spec label was added and removed.
- **Pull or merge request**: number, title, state (`open`, `merged`, `closed`), draft, head branch, URL, creation, merge and close times, the issues the git host says it closes (nothing is guessed from branch names), a checks summary of its head commit, and every serenity report among its comments. No other comment text is stored; GitLab system notes are ignored.
- **Checks**: `Failing` if any check failed, was cancelled or timed out; else `Pending` if any is queued or running; else `Passing` with at least one check; else `No checks` (GitHub's status check rollup, GitLab's head pipeline).
- The CLI runs from the project root with the repository passed explicitly. Each call has 60 seconds; a call that times out fails that project for this run.
- A project whose collection fails (a missing key or line, CLI missing or not logged in, network, CLI error) shows in the [warning banner](navigation.md#banners) as `Could not read <GitHub|GitLab> for <project name>: <first line of the error>.` Its earlier data stays; the other projects are still collected; the line goes at its next successful run.

## What is stored

Figures and labels, not conversations: token counts, models and times, session titles, sub-agent descriptions, branches, skill and slash command names, closing lines, and for each friction its kind, tool, category, program, exit code, a hash of its command and the command of a refusing hook. No prompt, tool output, command text, error message or file content is stored.

Opening the occurrences of a friction row reads their commands and errors from the logs on this computer for that request only; they are never written to the database, a cache, a file or the server's output ([Frictions](frictions.md#occurrences)).

Costs are not stored: they are computed when shown, with the API list prices of `src/pricing.ts`.
