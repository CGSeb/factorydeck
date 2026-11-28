# FactoryDeck product documentation

What FactoryDeck does, what each page shows and what each figure means. It describes the product as it is on the main branch: a change of behaviour updates its page here in the same pull request.

For installing and running FactoryDeck, see [Getting started](../getting-started.md); for the big picture, [How FactoryDeck works](../how-it-works.md).

## Pages

| Page                                            | What it covers                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Data and collection](data.md)                  | Session logs (Claude Code, Codex), factory projects, the git host, what is stored and when.  |
| [Roles and work items](roles-and-work-items.md) | How each thread gets a role and an issue, the configuration file and its defaults.           |
| [Outcomes](outcomes.md)                         | Stages, serenity reports, help from a person, stops and rework.                              |
| [Navigation and conventions](navigation.md)     | Sidebar, project select, periods, refresh, theme, banners, number formats, empty states.     |
| [Overview](overview.md)                         | The home page: factory health, issues waiting for a person, the board by stage.              |
| [Features and issues](features.md)              | The list of issues and the story of one issue.                                               |
| [Bugs](bugs.md)                                 | The bugs still open, being fixed and fixed in the period, with how each fix was reproduced.  |
| [Stats](stats.md)                               | Autonomy, quality, flow and cost figures, their trends and their definitions.                |
| [Frictions](frictions.md)                       | Tool errors and blocked stops, by category, tool, command, role and issue, with occurrences. |
| [Sessions](sessions.md)                         | Session states, the session list and the session page.                                       |
| [Skills and roles](skills-and-roles.md)         | Skill launches and attribution, tokens by role and by model.                                 |
| [Accounts](accounts.md)                         | Roles, the setup code of a new instance, the first manager and the session cookie.           |
| [Projects](projects.md)                         | The projects a manager adds by their git remote, and the admin routes.                       |
| [The CLI](cli.md)                               | Connecting the FactoryDeck CLI from the browser, its token, its routes and its connections.  |
| [Interface](interface.md)                       | Design tokens, components, charts, accessibility and layout rules every page follows.        |

## Glossary

- **Factory project**: a git repository with `docs/agents/factory.yml` at its root. FactoryDeck reads nothing else ([Data](data.md#factory-projects-only)).
- **Session**: one conversation of a coding agent, with its **main thread** and its **sub-agents**. Each of them is a **thread**.
- **API call**: one model response, with its input, cache write, cache read and output tokens.
- **Role**: what a thread does in the factory (`builder`, `reviewer`, `main`…), from the role rules ([Roles and work items](roles-and-work-items.md)).
- **Work item**: the issue a thread works on, shown `#<n>`.
- **Stage**: where an issue stands, from its labels and pull requests ([Outcomes](outcomes.md#stages)).
- **Serenity report**: the comment `build-feature` writes on a pull request with its merge score, threshold, review rounds and gates.
- **Merged issue**: an issue at stage `Merged`, `Merged after a person` or `Merged by a person`; **merged without a person** means stage `Merged` only.
- **Stop**: a moment the factory handed an issue to a person: a spec question, or a serenity report that refused the merge.
- **Orchestration share**: the tokens of a main thread with no work item, shared among the issues of its sub-agents.
- **Friction**: a tool error or a blocked stop recorded from the session logs ([Frictions](frictions.md)).
- **Period**: `Today`, `Last 7 days`, `Last 30 days` or `All time`, in the browser's time zone.

## History

Each page sums up the feature specs FactoryDeck was built from (specs 001 to 050). They were removed from the repository once this documentation replaced them; each closed issue links its spec as it was, at commit [`cdd2d93`](https://github.com/CGSeb/factorydeck/tree/cdd2d93a9b88749872c3cff559cb204ac59d87e7/docs/specs). New features are specified in their issue.
