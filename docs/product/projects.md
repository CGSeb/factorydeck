# Projects

A manager adds each project of the team by its git remote, so FactoryDeck knows which repositories it follows. Every session whose root has that remote belongs to the project, whatever folder it was cloned in ([Data](data.md#project-of-a-session)), and the project select lists the projects of this page under their names. Editing or removing a project comes in later stories.

## The Projects page

A manager sees a `Projects` link in the sidebar, right after `Team`; it opens `/projects`. It shows and hides with `Team`, from the same read of the account (see [The Team page](accounts.md#the-team-page)). A dev sees no such link, and `/projects` shows them `Only managers can manage projects.`

- **Header**: `Projects`, with the summary `<n> projects` (`1 project`). The page has no period pills; the project select stays in the sidebar and changes nothing here.
- **Table**: the columns `Name`, `Remote`, `Slug` and `Added`. Every project is listed, with no paging, sorted by name without letter case. The remote shows in its normalised form (`github.com/owner/repo`), and `Added` is the date the project was added (`3 Feb 2026`), with the exact date and time in a tooltip. Long names and remotes wrap; a table wider than the page scrolls inside its box.
- **No project**: in place of the table, `No project yet. Add the first one with its git remote.`
- **Add project**: a button in the header, shown once the list has loaded (not while it loads, on the refusal or while the database is unreachable), opens the [add dialog](#adding-a-project).

The page loads like the others: the header keeps the place of its summary while the list loads, under it `Loading…`, and it reloads every `refreshSeconds`.

| Answer of `GET /api/admin/projects`        | The page shows                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `200`                                      | The table, or the line for no project.                                                  |
| `403`                                      | `Only managers can manage projects.` in place of the table, the header with no summary. |
| `503`                                      | `Database unreachable. Start it with pnpm db:up.`                                       |
| `401`, a network error or any other answer | The last data (or `Loading…`), and it tries again every 10 s.                           |

## Adding a project

`Add project` opens a dialog with two fields: `Git remote` (placeholder `git@github.com:owner/repo.git`) and `Name`, then `Cancel` and `Add project`. The focus starts in `Git remote`; `Escape`, `Cancel` or a click outside closes the dialog without adding anything. While the request runs, the button reads `Adding…` and is disabled.

Once the API answers `201`, the dialog closes and the project shows in the table at once, in its place by name, and the summary counts it. A refusal keeps the dialog open: the message shows under its field (`Git remote` for a remote that does not parse or is already added, `Name` for a name refused) and the focus moves to that field. Any other failure shows its message under the fields: `Database unreachable. Start it with pnpm db:up.` on a `503`, the API's message when it gives one, `Could not reach the server` otherwise.

### Remotes

A remote is accepted in these forms, with or without a trailing `.git` or `/`, after trimming its spaces, up to 500 characters:

- `git@<host>:<path>`
- `ssh://[user@]<host>[:port]/<path>`
- `https://<host>/<path>` or `http://<host>/<path>`

Its normalised form is `<host>/<path>`: the host in lower case without user or port, the path in lower case without `.git` nor trailing `/`, with at least two segments (`owner/repo`, or `group/subgroup/repo` on GitLab). Two remotes with the same normalised form are the same project: `https://GitHub.com/Owner/Repo.git` after `git@github.com:owner/repo.git` is refused as already added. A local path, a `file://` URL, a `~` path, a path with an empty, `.` or `..` segment, a query or a fragment are refused as `Not a git remote`. FactoryDeck does not check that the remote exists on its host.

### Name and slug

- **Name**: trimmed, 1 to 80 characters, counted in UTF-16 code units (an emoji counts as two). Left empty, it is the repository's last path segment as written (`FactoryDeck` for `git@github.com:owner/FactoryDeck.git`), cut to 80 characters. Two projects may share a name.
- **Slug**: made once, when the project is added, from the path's last segment: lower case, every run of characters outside `a-z0-9` turned into one `-`, trimmed of `-`, at most 40 characters (`My.Repo` gives `my-repo`); a segment with no letter or digit gives `project`. When the slug is taken, `-2`, `-3`… is added (`my-repo-2`), and the slug is first cut so that it stays at most 40 characters with its suffix (a 40-character `aaa…a` becomes 38 `a` then `-2`), dropping a `-` left at the cut. It never changes afterwards.

## Admin routes

Every route under `/api/admin/` checks, in order: a session (`401`, or `503` while the database is unreachable), the role (`403` with `{ "error": "Managers only" }` for a dev, on any path under `/api/admin/`, unknown ones included), the body (`400`), then conflicts (`409`). A manager gets `404` with `{ "error": "Not found" }` on an unknown path. The role is read from the session's account at each request.

`GET /api/admin/projects` answers `200` with `{ "status": "ok", "refreshSeconds": <n>, "projects": [...] }`, in the order of the table. Each project has `id`, `name`, `slug`, `remote` (normalised) and `createdAt` (ISO 8601). While the database is unreachable, it answers `503` with `{ "status": "unreachable", "refreshSeconds": <n> }`.

`POST /api/admin/projects` with `{ "remote": "<remote>", "name": "<name>" }` adds a project and answers `201` with it, in the shape of one project of the list. `name` may be missing, `null` or empty. Unknown fields are ignored, and a body that is not a JSON object is read as empty.

| Answer | When                                                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `{ "error": "Not a git remote", "field": "remote" }`: `remote` missing, not text, or not a remote of the forms above.         |
| `400`  | `{ "error": "Name must be text", "field": "name" }`, or `{ "error": "Name must be at most 80 characters", "field": "name" }`. |
| `409`  | `{ "error": "This remote is already the project <name>" }`: a project has the same normalised remote.                         |
| `503`  | The database is unreachable; nothing is added.                                                                                |

## How a project is stored

The table `project` holds, for each project, its `id`, `name`, `slug` (unique), normalised `remote` (unique), `created_at` and `created_by`, the account of the manager who added it (emptied if that account is ever deleted).
