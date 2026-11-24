# Skills and roles

`/skills` shows which skills the agents launch and what they use; `/roles` shows how the tokens split between roles and models.

## Skill attribution

Each API call belongs to exactly one skill, or to `No skill`, so totals add up.

- A call of a thread belongs to the most recent skill launched in that thread when no user prompt and no other skill launch came between them; otherwise to `No skill`. A user prompt is only one the person typed ([Data](data.md#claude-code)): a background agent finishing does not end the current skill. The prompt that types a slash skill starts that skill.
- A sub-agent started while a skill is current belongs to it, all its calls included, unless a skill is launched inside the sub-agent: its own calls then follow the same rule in its thread, starting with the parent's skill as current.
- Skill launches are read from Claude Code logs only.

## Skills list

The header `Skills` says `<k> skills launched <n> times · <t> tokens in skill sessions` (singular forms for 1; the tokens of every row but `No skill`).

Columns: `Skill` (the name as stored, linked to its page), `Launches`, `Sessions`, `Tokens per launch`, `Tokens` (a bar against the largest row). Sorted by tokens descending: the list has no activity date. The `No skill` row is last, muted, not linked, with `—` for launches and tokens per launch.

## Skill page

`/skills/<name>` (the name URL-encoded): the back link `← Skills`, the skill name, then three figures (`Launches`, `Tokens`, `Per launch`) beside `Launches per day` (`Launches per hour` for `Today`), each bar labelled with its count. Under them, `Sessions that launched it`: session, project (only with `All projects`), launches and tokens of the skill in it, sorted by tokens descending. With none: `No session launched this skill in this period.`

## Roles page

The header `Roles` says where the roles come from ([Roles and work items](roles-and-work-items.md#roles)).

- **By role**: a bar of the period's tokens by role (role colours in the order of the configuration), then a table: `Role`, `Threads` (sessions for `main`, sub-agents for the others, with at least one call in the period), `API calls`, `Tokens per thread` (`—` with no thread), sorted by tokens descending, `unassigned` like the others, and a bold `Total` row.
- **By model**: a bar `Tokens by model` (most tokens first; a model with no id is `—`), then a table: `Model`, `API calls`, sorted by tokens descending.

The roles and models totals equal the overview total for the same period and project. A session split by [markers](roles-and-work-items.md#work-item-marker) counts as one thread in each role its calls fall in.
