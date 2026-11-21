# 005 · Skill usage

Status: ready
Depends on: 002, 003, 004
Checked: 2026-11-21

## User goal

A developer sees how many tokens and how much cost each skill takes, overall and inside one session, so they can tell which skills are expensive and worth improving.

## Acceptance criteria

- [ ] The navigation bar has a `Skills` entry, at `/skills`.
- [ ] A table lists each skill with: name (as stored, such as `factorydeck-skills:write-spec`), launches, sessions that launched it, tokens, cost, and average cost per launch; sorted by cost descending.
- [ ] A row `No skill` holds every call attributed to no skill, so the column totals equal the overview totals of spec 003 for the same period and project.
- [ ] The period selector of spec 003 and a project filter (as in spec 004) apply; they are kept in the URL.
- [ ] Clicking a skill opens `/skills/<name>` (the name URL-encoded, a React Router route that survives a reload) with its launches over time (one bar per day, launches count) and the list of sessions that launched it, each with the tokens and cost of the skill in that session, linking to the session page of spec 004.
- [ ] The session page of spec 004 gains a `Skills` table: each skill launched in the session with launches, tokens and cost, plus the `No skill` row; its totals equal the session totals.
- [ ] With no skill launched in the period, the page shows `No skills launched in this period.` and still shows the `No skill` row's figures.

## Rules

- **Attribution**: an API call of the main thread belongs to the most recent skill launched in that thread, if no user prompt (spec 002) and no other skill launch came between that launch and the call. Otherwise it belongs to `No skill`.
- A user prompt is what spec 002 stores: a prompt the user typed (text or images alone). Records Claude Code writes itself (task notifications, command output, compact summaries, interruption markers) are not prompts, so a background agent finishing does not end the current skill.
- A sub-agent started (by its tool call) while a skill is current in the main thread belongs to that skill, all its calls included, unless a skill is launched inside the sub-agent: then the sub-agent's own calls follow the same attribution rule inside the sub-agent's thread, starting from its first call with the parent's skill as current.
- Each call is attributed to exactly one skill or to `No skill`, so totals add up.
- Skill launches are those of spec 002: `Skill` tool calls and skills typed as slash commands. The user prompt that types a slash skill starts that skill; it does not end it.
- Average cost per launch is the skill's cost divided by its launches; it excludes calls with unknown prices, like the `Cost` tile of spec 003.
- Cost and `—` for unknown prices follow spec 003.
- The launches chart is drawn with Recharts, like the chart of spec 003.

## Expected proof

- Storybook stories of the skills table (with skills, none launched in the period) and of a skill page, with a `play` function that changes the project filter; they pass the axe check of `src/ui/stories.test.tsx`.
- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of the attribution over synthetic threads: a task notification inside a skill; skill then calls then user prompt; two skills in a row; a sub-agent started inside a skill; a skill launched inside a sub-agent; calls before any skill; totals equal the overview.
- On the real app: `pnpm start`, open `/skills?period=all` and one skill page; a screenshot is attached to the pull request.

## Out of scope

- Editing or fixing skills from FactoryDeck.
- Retrospectives and recurring user actions (a later spec).
- Built-in slash commands that are not skills, and MCP tools.
- Per-skill quality or outcome figures.
