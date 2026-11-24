# Sessions

`/sessions` lists the sessions of every coding agent; `/sessions/<id>` shows one, with its sub-agents and skills. Sub-agents are not rows of the list.

## Session states

- **Working**: the last turn has not ended ([Data](data.md#claude-code)) and the last record is less than `FACTORYDECK_INACTIVE_AFTER_MINUTES` old (default 30). A long command that writes nothing stays `Working` until then.
- **Waiting for you**: the last turn has ended and the last record is less than that old.
- **Inactive**: the last record is older, whatever the turn.

## Session list

The header `Sessions` says `<n> sessions` (`1 session`) for the period, project and state. The period selects sessions by their last activity; a row's figures always cover the whole session, sub-agents included, so they match its page.

- A `State` filter: `All`, `Working`, `Waiting for you`, `Inactive`, each with its count and state dot; it is the `state` URL parameter (`All` removes it).
- Columns: `State`, `Title` (linked to the session; without a title, the first 8 characters of its id, or `Codex session <id>` for Codex), `Agent` (`Claude Code` or `Codex`, only when the period and project hold sessions of more than one agent), `Project` (only with `All projects`), `Work item` (`#<n>` linked to its issue page, `—` without), `Last activity`, `Duration` (first to last record), `Tokens`.
- Sorted by last activity, most recent first. 50 rows, then `Show more` adds 50, up to 500; the API refuses more than 500.
- With no match: `No sessions match these filters.`

## Session page

The back link `← Sessions` keeps the project and period. The title, then a line with its state, its agent tag, its project, every branch it was on (comma-separated, in the order each first appeared, `—` with none) and `Work item #<n>` linked to its issue page. An unknown id shows `Session not found.`

- `Sub-agents <k>`: description, role, work item, start, duration, tokens, sorted by start; `No sub-agents.` without.
- `Skills`: each skill launched in the session, linked to its skill page, with its launches and tokens; left out without a skill. Its rows, `No skill` included, add up to the session's tokens.
- The aside: `Tokens, sub-agents included` with the total and its split into `Cache read`, `Cache write`, `Input`, `Output`; when the session has a work item, its [outcome](outcomes.md) (stage, serenity, rounds); `Working directory`, `First activity`, `Last activity`; and `Frictions`, the session's frictions over its whole life, linking to `/frictions?session=<id>&period=all`, or `None`.
