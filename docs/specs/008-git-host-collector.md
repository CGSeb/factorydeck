# 008 · Git host collector

Status: ready
Depends on: 003, 004, 006, 007
Checked: 2026-11-21

## User goal

A developer sees, on each session, the real issue its work item points to (title, state, labels) and the pull or merge requests that close it, with their state and checks, read from GitHub or GitLab as each project's factory configuration says, and kept up to date without leaving FactoryDeck.

## Acceptance criteria

- [ ] For each project with the factory installed (spec 007), FactoryDeck reads `repository.git_host` (`github` or `gitlab`) and `repository.git_host_commands` from its `docs/agents/factory.yml`, then, in the file `git_host_commands` names, the CLI from the line `- CLI: \`<command>\``and the repository from the line`- Repository: \`<owner>/<name>\``(GitHub) or`- Project: \`<group>/<project>\``(GitLab). Without a`- CLI:`line, the CLI is`gh`for GitHub and`glab` for GitLab.
- [ ] It collects every issue and every pull request (GitHub) or merge request (GitLab) of that repository: on the first run all of them, then only those updated since the start of the last successful run of that project.
- [ ] For an issue it stores: number, title, state (`open` or `closed`), labels with their colour as the git host defines it, web URL, creation and closing time. For a pull or merge request: number, title, state (`open`, `merged` or `closed`), draft or not, head branch, web URL, creation, merge and closing time, the issues it closes (as the git host reports them), and a checks summary (see Rules).
- [ ] Collection runs at server start, then every `FACTORYDECK_COLLECT_INTERVAL_MINUTES` of the root `.env` (default `5`, a whole number of at least 1); a run never starts while another is going. `pnpm collect` runs one collection from the command line and prints `Collected <p> projects: <i> issues and <r> pull or merge requests updated.` plus one line per failed project (see below); its exit code is 1 when a project failed, else 0.
- [ ] The navigation bar shows, on its right, `Issues updated <relative time>` (relative like spec 004, `Issues not collected yet` before the first run) and a `Refresh` button. `Refresh` starts a collection at once; while it runs, the button is disabled and reads `Refreshing…`; if a run is already going, it waits for that one instead of starting another. The figures and labels refresh without a reload when it ends.
- [ ] A project whose collection fails (configuration missing a key, `git_host_commands` file or its repository line missing, CLI not found, CLI not authenticated, network error, a CLI error) is shown in the warning banner of spec 007 with `Could not read <GitHub|GitLab> for <project name>: <reason>.`, where `<reason>` is the first line of the error; its data from earlier runs is kept and shown; the other projects are still collected. The line disappears at the next successful run of that project.
- [ ] The session page header of spec 006 shows the work item as `#52 <issue title>`, linked to the issue's web URL (opening in a new tab), with its state (`Open` or `Closed`, as a coloured label with its text) and its labels in alphabetical order, each a pill filled with its git host colour (see Rules); under it, the pull requests (GitHub, shown `#53`) or merge requests (GitLab, shown `!12`) that close the issue, each with its title, link, state (`Open`, `Draft`, `Merged`, `Closed`) and checks (`Passing`, `Failing`, `Pending`, `No checks`), newest first. With none: `No pull request closes this issue.` (or `No merge request closes this issue.` on GitLab).
- [ ] In the session list and the sub-agent table, a work item `#52` links to the issue's web URL and shows the issue title on hover.
- [ ] A work item with no matching issue in the collected data shows `#52 (not found)`, without a link; before the project's first successful collection it shows `#52` alone, as in spec 006.
- [ ] The layout still works from 1280 px wide down to 768 px, like spec 003.

## Rules

- **Repository**: one per project, read at each run from the files above, so a change in them applies at the next run. Paths in `docs/agents/factory.yml` are relative to the project root.
- **CLI**: run with the project root as working directory and the repository passed explicitly, never inferred. Each call of the CLI has 60 seconds (a first run of a large repository makes several paged calls, each with its own limit); a call that does not finish in time counts as a failure of that project for this run, and the other projects go on.
- **Label colours**: the pill's background is the label's colour from the git host; its text is black or white, whichever has the higher contrast with that background, so it reaches WCAG AA (4.5:1) whatever the colour. A label without a colour uses the neutral pill colour of the theme.
- **Checks summary** of a pull or merge request, for its head commit: `Failing` if any check failed, was cancelled or timed out; else `Pending` if any is queued or running; else `Passing` if there is at least one check; else `No checks`. On GitHub this is the status check rollup; on GitLab the head pipeline's status.
- **Closes**: the issues the git host reports as closed by the request (GitHub's closing issue references, GitLab's « closes issues » of the merge request). Nothing is guessed from branch names.
- **Work item to issue**: the work item number of spec 006 is looked up among the issues of the session's project; a GitHub pull request number is not an issue, so it shows `(not found)`.
- **Incremental**: « updated since » uses the git host's update time of each issue or request; the start time of a run is stored per project only when that project's run succeeds, so a failed run is retried in full from the previous successful start.
- Issues and requests of a project deleted with spec 007 are deleted with it.
- Comments, reviews, review rounds, outcomes (merged, needs rework, score) and costs per issue are not collected or shown here: specs 009 and 010.
- Environment variables follow spec 001 and are documented in `.env.example`; relative times and labels follow specs 003 and 004.
- Nothing is written to the git host: FactoryDeck only reads.

## Expected proof

- Vitest tests of reading the configuration (GitHub and GitLab files, a missing `- CLI:` line, each missing key or line with its message) and of the collection with a fake CLI script returning recorded synthetic JSON: first run, incremental run, a failed project kept while the others succeed, the checks summary for each case, closing references.
- Vitest tests, on a scratch PostgreSQL database (`src/test/postgres.ts`), of work item lookup (found, not found, not collected yet) and of the deletion of a project's issues with spec 007.
- Storybook stories of the session header (GitHub with pull requests, GitLab with merge requests, none closing, not found), of the navigation bar status (never collected, collected, refreshing), and of the banner with a collection error, with a `play` function that clicks `Refresh`; they pass the axe check of `src/ui/stories.test.tsx`.
- On the real app: `pnpm collect` on this repository prints the summary line; `pnpm start`, open a session whose sub-agents carry `#<n>` and see its issue and pull request; a screenshot is attached to the pull request.

## Out of scope

- Outcomes (merged, needs rework, serenity score), comments and review rounds: spec 009.
- The cost-per-feature view: spec 010.
- Git hosts other than GitHub and GitLab, and calling their APIs without their CLI.
- Writing anything to the git host (labels, comments, merges).
- Webhooks or push notifications from the git host.
