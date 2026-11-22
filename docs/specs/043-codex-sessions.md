# 043 · Codex sessions

Status: done
Depends on: 032, 040
Checked: 2026-11-22

## User goal

A developer whose factory runs some of its work with Codex sees those sessions in FactoryDeck next to their Claude Code sessions, in the same projects, issues and roles, with the tokens they used and the frictions they met, and can tell on each session which coding agent ran it.

## Acceptance criteria

- [x] Ingestion reads session logs through one reader per coding agent. Each stored session records its agent: `claude-code` for the logs of spec 002, `codex` for those of this spec. Everything FactoryDeck computes from sessions (overview, features, roles, sessions, skills, stats, frictions) counts every agent's sessions together, with no other change of rule.
- [x] `pnpm ingest` also reads every `rollout-*.jsonl` file under the Codex sessions folder, at any depth (`<year>/<month>/<day>/`). The folder is `CODEX_SESSIONS_DIR` of the root `.env`, else `~/.codex/sessions`; an empty value falls back to the default, like every FactoryDeck variable. A Codex folder that does not exist is skipped without error or message, unlike the Claude Code folder of spec 002.
- [x] For each Codex file it stores one session: its id (`session_meta.id`), working directory (`session_meta.cwd`), git branch (`session_meta.git.branch`, else empty), every branch as spec 002 orders them, an empty title, the time of its first and last record, and whether its last turn has ended (a `task_complete` event after the last `task_started`).
- [x] A Codex sub-agent's rollout (rules) is stored as a sub-agent of its root session, with its type, description, model and first and last record time, so it shows in the session page's `Sub-agents` table and its role and work item follow spec 006 like a Claude Code sub-agent's.
- [x] For each model response it stores one API call: session, sub-agent (if any), time, model, and the four token kinds (rules). A response repeated in the same file, or already stored for the same root session from another file, is stored once.
- [x] For each prompt the person typed it stores a user prompt marker (time only, no text), and for each final reply of a turn its closing line as spec 032 does, so `Work item: #<n> (<role>)` markers written by a Codex session give its calls to that issue and role.
- [x] Codex frictions follow spec 040 with the agent `codex`: a shell command that ends with a non-zero exit code is a `tool-error` of category `command-failed` with its program, exit code and command hash; any other tool output the log marks as failed is a `tool-error` of category `other`; a compaction record is a `compaction` with trigger `auto` and no token counts. No text is stored.
- [x] Projects follow spec 007: the session belongs to the factory project whose root holds its working directory. When FactoryDeck runs under WSL, a Windows working directory (`D:\Dev\x`) is read as its WSL path (`/mnt/d/Dev/x`) first, so a Codex session run on Windows joins the same project as Claude Code sessions run in WSL in that folder. A session outside any factory project is skipped as spec 007 says.
- [x] Re-reading, offsets, skipped lines, deletion with the project and the lock follow spec 002 for Codex files too. The summary line of spec 002 counts the files and rows of every agent together.
- [x] The sessions list and the session page (spec 027) show the agent: a neutral tag `Claude Code` or `Codex` in the session page's line under its title, after the `SessionStateBadge`, and in a list column `Agent` after `Title`. The list's `Agent` column shows only when the period and project hold sessions of more than one agent.
- [x] A Codex session with no title shows `Codex session <first 8 characters of its id>` wherever a session title is shown.
- [x] The demo data (`pnpm demo`) holds two synthetic Codex sessions in a demo project, one with a `Work item` marker, a failed command and two sub-agents (`agent_role` `worker` and `explorer`), so the agent tag, the list column and Codex sub-agents show.

## Rules

- **Tokens of a Codex response**, from its `token_usage_record` `usage` (or, in a file with no such record, from each `event_msg` `token_count`'s `info.last_token_usage`): cache read = `cached_input_tokens`; cache write = `cache_write_input_tokens` (0 when missing); input = `input_tokens` minus those two, at least 0; output = `output_tokens` (it already holds the reasoning tokens, which are not added again). Records repeating the same `response_id` count once.
- **Model** of a call: the `model` of the latest `turn_context` (or `thread_settings_applied`) before it; empty when none.
- **User prompt**: an `event_msg` of type `user_message`, or an `item_completed` event whose item is a `UserMessage`, counted once per item id.
- **Closing line**: the last non-empty line of the turn's `task_complete` `last_agent_message`, with the rules of spec 032 (trimmed, at most 200 characters).
- **Shell command** in Codex: an `exec_command_end` event, or a function call named `shell` or `exec_command`; its command is the call's command joined with spaces; program and hash as spec 040.
- **Prices**: models outside the price table of `src/pricing.ts` have no price; their calls count in tokens and are left out of costs with the note of spec 003, as today.
- **WSL**: FactoryDeck runs under WSL when `/proc/version` names Microsoft or WSL. A path `X:\a\b` becomes `/mnt/x/a/b` (drive letter in lower case, `\` as `/`); other paths are kept.
- **Codex sub-agents**: a rollout whose `session_meta` has `source.subagent.thread_spawn.parent_thread_id` is a sub-agent, not a session. Its id is the rollout's `session_meta.id`; it belongs to the root session `session_meta.session_id`, else to `parent_thread_id` when `session_id` is missing or equal to its own id. A sub-agent spawned by a sub-agent belongs to the same root session, like Claude Code's. Its type is `thread_spawn.agent_role` and its description `thread_spawn.agent_path` (`/root/review_worker`), each empty when missing, so the role rules of spec 006 match them as they match Claude Code's. A sub-agent read before its root session's file creates that session without working directory, completed when the root file is read (as spec 002 does for Claude Code).
- **Inherited records**: a sub-agent's rollout can start with records copied from its parent. Its calls whose `response_id` is already stored for the same root session are skipped, and records before `subagent_history_start_ordinal` (when the `session_meta` gives it, counted in lines from the start of the file, the `session_meta` line being 0) are not read for prompts, closing lines or frictions.
- **`token_count` fallback**: a `token_count` whose `total_token_usage` equals the previous one in the file is skipped; otherwise its `last_token_usage` is the call.

## Expected proof

- Vitest tests of the Codex reader on synthetic files: session meta with and without git, tokens from `token_usage_record` and from `token_count` only, a repeated `response_id`, cached and cache-write tokens subtracted from input, the model from `turn_context`, user prompts in both forms, a closing line marker, a failed shell command and a failed other tool, a compaction, an unknown record type skipped, a last line without newline left for the next run; a sub-agent rollout (direct and nested, read before and after its root), its type and description, inherited records and a parent `response_id` not counted twice, an unchanged `token_count` total skipped.
- Vitest tests of the WSL path mapping (`D:\Dev\x`, `c:\`, a POSIX path, a UNC path kept) and of the folder fallback (empty value, missing folder).
- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of a Claude Code and a Codex session in the same project: overview, features and roles totals counting both, a Codex marker giving its calls to an issue and role, re-reading a grown Codex file.
- Storybook stories of the sessions list with both agents (column shown) and with one (column hidden), and of a Codex session page; they pass the axe check of `src/ui/stories.test.tsx`.
- On the real app, with `pnpm demo`: screenshots of the sessions list and of the Codex demo session at 1024 px and 1280 px, attached to the pull request.

## Out of scope

- Gemini CLI, Copilot and Cursor: one later spec each, once their logs can be read.
- The tree of Codex sub-agents (who spawned whom below the root session), the spawn task text (Codex stores it encrypted) and the `state_5.sqlite` database of Codex.
- Prices of OpenAI models.
- Skill launches in Codex sessions.
- A filter by agent on any page.
