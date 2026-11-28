# Projects

A manager adds each project of the team by its git remote, so FactoryDeck knows which repositories it follows. Every session whose root has that remote belongs to the project, whatever folder it was cloned in ([Data](data.md#project-of-a-session)), and the project select lists the projects of this page under their names. A manager changes a project's name or remote on its [settings page](#project-settings), and can [remove a project](#removing-a-project) and its data.

## The Projects page

A manager sees a `Projects` link in the sidebar, right after `Team`; it opens `/projects`. It shows and hides with `Team`, from the same read of the account (see [The Team page](accounts.md#the-team-page)). A dev sees no such link, and `/projects` shows them `Only managers can manage projects.`

- **Header**: `Projects`, with the summary `<n> projects` (`1 project`), followed by ` · <m> remotes not added` (`1 remote not added`) when [Remotes not added yet](#remotes-not-added-yet) lists at least one remote; the `No remote` line is not counted. The page has no period pills; the project select stays in the sidebar and changes nothing here.
- **Table**: the columns `Name`, `Remote`, `Git host`, `Slug` and `Added`. Every project is listed, with no paging, sorted by name without letter case. Each name is a link to the project's [settings page](#project-settings). A last column holds a `Remove` button on each row (its accessible name is `Remove <name>`), separate from the link, which opens the [removal dialog](#removing-a-project). The remote shows in its normalised form (`github.com/owner/repo`). `Git host` reads the project's [git host](#git-host-of-a-project) and whether a [token](#git-host-token) is set, in one cell: `GitHub · token`, `GitLab · no token`, or `—` alone when the git host is unknown. `Added` is the date the project was added (`3 Feb 2026`), with the exact date and time in a tooltip. Long names and remotes wrap; a table wider than the page scrolls inside its box.
- **No project**: in place of the table, `No project yet. Add the first one with its git remote.`
- **Remotes not added yet**: a section under the projects, described [below](#remotes-not-added-yet).
- **Add project**: a button in the header, shown once the list has loaded (not while it loads, on the refusal or while the database is unreachable), opens the [add dialog](#adding-a-project).

The page loads like the others: the header keeps the place of its summary while the list loads, under it `Loading…`, and it reloads every `refreshSeconds`.

| Answer of `GET /api/admin/projects`        | The page shows                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `200`                                      | The table, or the line for no project.                                                  |
| `403`                                      | `Only managers can manage projects.` in place of the table, the header with no summary. |
| `503`                                      | `Database unreachable. Start it with pnpm db:up.`                                       |
| `401`, a network error or any other answer | The last data (or `Loading…`), and it tries again every 10 s.                           |

## Remotes not added yet

Under the projects, the section `Remotes not added yet` lists the remotes the team has sessions of but no project for, so that no work goes unseen. It shows once the list has loaded, keeps its last data while the page reloads, and is hidden when it has no line.

- **Remote of a session**: the recorded remote of its root, else the remote a CLI sent with it ([Project of a session](data.md#project-of-a-session)): the main log's, or a sub-agent's while the main log has none; a CLI remote that is not a git remote counts as none. Main sessions only are counted, whatever the period. Sessions deleted with a [removed project](#removing-a-project) never count, so a removed project's remote comes back only with later sessions.
- **A line per remote**: the columns `Remote`, `Sessions`, `First session`, `Last session`, then an `Add` button. `Sessions` reads `<n> sessions` (`1 session`). `First session` and `Last session` are the earliest and latest session times of the remote, in the relative form of `Last sign-in` of the Team page (`20 min ago`, `3 d ago`), with the exact date and time in a tooltip, and `—` when no session has a time. Lines are sorted by last session, most recent first (a remote with no time last), then by remote. Every remote is listed, with no paging.
- **No remote**: the sessions with no remote show as one last line `No remote <k> folders` (`1 folder`), with their sessions, empty time columns and no `Add` button. The folders are the distinct roots; sessions with no root (`unassigned`, which includes those a CLI sent) count in the sessions, not in the folders.
- **Add**: opens the [add dialog](#adding-a-project) with `Git remote` filled with `https://<remote>` (which normalises back to the same remote) and `Name` empty, so the name defaults to the repository's last path segment in lower case. Once the API answers `201`, the line of the new project's remote goes at once and its sessions belong to the project; a remote edited in the dialog keeps its line until it has a project. Ignoring a remote without adding it is not possible.

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

## Project settings

Each project has a settings page, `/projects/<slug>`, opened from its name in the table, for managers only like `/projects`: a dev sees `Only managers can manage projects.` The sidebar's `Projects` link stays current there. The page reads `GET /api/admin/projects` and finds its slug there, exact and case-sensitive.

- **Header**: a back link `← Projects` above the title, the project's name as the title, and the summary `<remote> · <sessions> sessions` (`1 session`): the normalised remote and the number of sessions stored for the project, whatever the period. While the list loads, the title is the slug of the address and the header keeps the place of its summary.
- **General**: the first section of the page. It holds `Name` and `Git remote`, filled with the project's name and normalised remote, and a `Save` button.
- **Role rules**: the project's [role rules](roles-and-work-items.md#role-rules-section), after `General`, saved with their own `Save rules` button.
- **Git host**: after `Role rules`, the project's [git host token](#the-git-host-section), saved with its own `Save token` button.
- **Unknown slug**: `No project <slug>.` under the header, whose back link leads to `/projects`.

`Save` is disabled while no field differs from the project. While the request runs, it reads `Saving…` and is disabled; the fields stay enabled. Once saved, the header and the fields show the project as the API answered it (the remote in its normalised form), and `Saved` shows beside the button for 3 seconds, or until the next edit. A refusal keeps the edits: its message shows under its field (`Git remote` for a remote that does not parse or belongs to another project, `Name` for a name refused) and the focus moves to that field. If the project was removed meanwhile, `<name> is no longer in FactoryDeck.` shows under `Save`, keeping the edits. A `503` shows `Database unreachable. Start it with pnpm db:up.` under the fields; any other failure shows the API's message there, or `Could not reach the server`.

The page reloads the list every `refreshSeconds`: the header follows it, a field with unsaved edits keeps them, and a field without edits shows the new value. When two managers save at once, the last save wins.

### What changing the remote does

The slug never changes. Sessions are linked to a project by their remote when they are read ([Data](data.md#project-of-a-session)), so no stored session changes: once the remote is saved, the sessions of the new remote belong to the project, and those of the old one leave it at once and wait under remotes not added yet. Git host data and friction reports follow the remote, so they stay with the old remote, whose [git host collection](data.md#git-host) stops. Rules stay with the project. A new remote on another host (the part before the first `/` of the normalised remote) forgets the project's [git host token](#git-host-token) and its chosen git host; on the same host they stay.

### The Git host section

The section `Git host` sets, checks and removes the project's [git host token](#git-host-token). It reads `secretKey`, `gitHost`, `tokenSet`, `tokenSetAt` and `tokenSetBy` from `GET /api/admin/projects`.

- **Host**: `GitHub` or `GitLab`, read-only for a remote on `github.com` or `gitlab.com` (by the host of the normalised remote, not by `gitHost`). For a remote on another host, a select with `GitHub` and `GitLab`, starting on the stored `gitHost`, or on an empty `Choose…` when it is unknown. The select is sent only with `Save token`: changing it with no token typed does nothing, and changing the host of a project that has a token means typing the token again.
- **Token state**: `Token set on <date> by <name>`, `Token set on <date>` once the account that set it is deleted, or `No token`. The date reads `3 Feb 2026`, with the time in a tooltip. A token that cannot be decrypted still reads `Token set on…` here; the [collection](data.md#git-host) reports it.
- **Token**: a password field, always empty when the page opens (`autocomplete="new-password"`). The token is never shown, even partly.
- **Buttons**: `Save token`, disabled while the trimmed field is empty, and `Remove token`, disabled with `No token`.

`Save token` sends [`PUT /api/admin/projects/<id>/git-host`](#admin-routes) with the trimmed token, and the select's value for a remote on another host. With the select on `Choose…`, nothing is sent: `Choose GitHub or GitLab` shows under the select, which takes the focus. While the check runs, `Save token` reads `Checking…`, both buttons are disabled, and the field and the select stay enabled. On success the field empties, the token state follows the answer, the list reloads, and `Token checked: <default branch> has docs/agents/factory.yml.` shows beside the buttons until the next edit or save. A refusal keeps the token: its message shows under its field (`Token` for a failed [check](#the-check), the select for `Choose GitHub or GitLab`) and the focus moves to that field. Other failures show under the buttons: `<name> is no longer in FactoryDeck.` on a `404`, `Database unreachable. Start it with pnpm db:up.` on the database's `503`, the API's message for the remote that changed during the check or the git host's CLI missing on the server, and `Could not reach the server` on a network error or a `401`. Saving the token leaves the edits of the other sections alone.

Without the secret key (`secretKey` is `false`, or `Save token` answers the `503` of the key), the section shows `Set FACTORYDECK_SECRET_KEY on the server to store tokens.` and `Save token` stays disabled; `Remove token` still works.

`Remove token` asks `Remove the git host token of <name>?`, `Its issues and pull requests stop updating.`, with `Cancel`, which has the focus, and `Remove token`, in the danger colour; `Escape`, `Cancel` or a click outside closes it. The dialog sends [`DELETE /api/admin/projects/<id>/git-host/token`](#admin-routes): the button reads `Removing…` and is disabled while it runs. On success the dialog closes, the section shows `No token`, and the focus goes to `Token`. A failure stays in the dialog: `<name> is no longer in FactoryDeck.` on a `404`, `Database unreachable. Start it with pnpm db:up.` on a `503`, `Could not reach the server` otherwise.

The page's refresh never empties a typed token nor resets a changed select. A typed token or a changed select counts as an unsaved change: leaving the page then asks `Leave without saving the token?` (an in-app link, and the browser's own prompt on closing or reloading the tab).

## Removing a project

`Remove` opens a confirmation `Remove <name>?` that says `Its <n> sessions and every figure from them are deleted. A developer who works in this repository again makes it reappear under Remotes not added yet.` (`Its 1 session…`), or, for a project with no session, `It has no sessions.` then the same sentence on reappearing. `<n>` is every stored session of the project, whatever the period: the dialog shows the count of the list at once, and replaces it with the count of `GET /api/admin/projects` read again when it opens. The buttons are `Cancel`, which has the focus, and `Remove`, in the danger colour; `Escape`, `Cancel` or a click outside closes the dialog without removing anything.

- While the request runs, the button reads `Removing…` and is disabled.
- On success the dialog closes, the row goes and the summary follows, the project leaves the [project select](navigation.md#project-select) (which falls back to `All projects` if it was selected), and the sidebar reloads its data. Removing the last project leaves the pages on their empty states, or the welcome screen when no session is left.
- On a `404`, the dialog shows `<name> is no longer in FactoryDeck.`, and the row goes at the next refresh of the list. On any other failure it shows `Could not remove <name>. Try again.`; nothing is removed.

Removing frees the slug and the remote: adding the remote again makes a new project, with a new id and the slug made again from the remote, and with only the sessions that come after the removal. What is deleted and what stays is described in [Data](data.md#removing-a-project).

## Git host token

A manager can give each project a token of its git host, so the server reads the project's issues and pull or merge requests itself, without any developer's machine. The token is checked before it is stored, stored encrypted, and never shown again: the API only says whether a token is set, when and by whom.

### Git host of a project

The git host of a project is `github` for a remote on `github.com`, `gitlab` for one on `gitlab.com`, and otherwise the one a manager chose when saving a token (`github` for GitHub Enterprise Server, `gitlab` for a self-hosted GitLab). With none chosen, it is unknown (`null`). Only `https` hosts are supported; a private certificate authority comes from the server's `SSL_CERT_FILE`. A remote with a port or an SSH alias (`github.com-work`) is read by its host name alone, so the check fails with `Could not reach <host>`: set the real remote in the project's settings.

### The secret key

Tokens are encrypted with `FACTORYDECK_SECRET_KEY`, 32 random bytes in base64 set in the root `.env` (`openssl rand -base64 32`, see [Getting started](../getting-started.md#configuration)). The key is trimmed and must be standard base64 decoding to exactly 32 bytes. An empty value counts as unset. A missing or invalid key does not stop the server: saving a token answers `503` until it is set, and `GET /api/admin/projects` says `"secretKey": false`.

Each token is encrypted with AES-256-GCM and a random 12-byte IV, bound to its project's id, and stored as `v1:<iv>:<tag>:<ciphertext>` in base64url without padding: a ciphertext copied to another project does not decrypt. A key changed later makes stored tokens unreadable, and the collection then reports `Token cannot be decrypted: set it again`. Rotating the key is not supported.

### Rights the token needs

- GitHub: a classic token with `repo`, or a fine-grained token with read access to Metadata, Contents, Issues and Pull requests.
- GitLab: a token with `read_api`.

### The check

Before storing a token, the server reads, with that token, the repository of the project's remote and its `docs/agents/factory.yml` on its default branch, the one the git host answers:

- GitHub: `gh api --hostname <host> repos/<owner>/<repo>` reads `default_branch`, then `gh api --hostname <host> "repos/<owner>/<repo>/contents/docs/agents/factory.yml?ref=<branch>"`.
- GitLab: `glab api --hostname <host> projects/<url-encoded path>`, then `glab api --hostname <host> "projects/<path>/repository/files/docs%2Fagents%2Ffactory.yml?ref=<branch>"`.

The file must exist and be a file. On GitHub, a remote whose path is not exactly `<owner>/<repo>` answers `Repository not found or not visible with this token` without calling `gh`. Each `gh` or `glab` call gets the token for that call only: `GH_TOKEN` and `GH_ENTERPRISE_TOKEN` (and `GH_HOST` for a host other than `github.com`), or `GITLAB_TOKEN` and `GITLAB_HOST`, plus `GH_PROMPT_DISABLED=1`. It gets only `PATH`, the proxy variables (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, `ALL_PROXY`, also in lower case) and the certificate variables (`SSL_CERT_FILE`, `SSL_CERT_DIR`, `NODE_EXTRA_CA_CERTS`) from the server's environment, an empty temporary `GH_CONFIG_DIR` or `GLAB_CONFIG_DIR`, and an empty temporary working folder: it never uses a token or a login of the server's own environment. Each call has 30 seconds. Nothing is written to `.env` or to the server's environment, and the token is never logged or written in an error.

A failed check answers a fixed message, never the git host's output:

| The git host answers                                                                                                                                         | Message                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `401`                                                                                                                                                        | `Bad token`                                           |
| `403` or `429` (missing scope, SSO, rate limit)                                                                                                              | `Token cannot read this repository`                   |
| `404` on the repository                                                                                                                                      | `Repository not found or not visible with this token` |
| An empty GitLab project (no default branch)                                                                                                                  | `Repository is empty`                                 |
| `404` on the file, or a folder at its path                                                                                                                   | `No docs/agents/factory.yml on <branch>`              |
| A timeout, a DNS or connection failure, a `5xx`, any other HTTP status (`400`, `410`, `451`…), or a server that cannot make its temporary folder for the CLI | `Could not reach <host>`                              |

## Admin routes

Every route under `/api/admin/` checks, in order: a session (`401`, or `503` while the database is unreachable), the role (`403` with `{ "error": "Managers only" }` for a dev, on any path under `/api/admin/`, unknown ones included), the body (`400`), then conflicts (`409`). A manager gets `404` with `{ "error": "Not found" }` on an unknown path. The role is read from the session's account at each request.

`GET /api/admin/projects` answers `200` with `{ "status": "ok", "refreshSeconds": <n>, "secretKey": <boolean>, "projects": [...], "pendingRemotes": [...], "noRemote": ... }`, in the order of the table. `secretKey` is `true` when [`FACTORYDECK_SECRET_KEY`](#the-secret-key) is set and valid. Each project has `id`, `name`, `slug`, `remote` (normalised), `createdAt` (ISO 8601), `sessions`, the number of sessions stored for the project (every session whose root has its remote, whatever the period), `gitHost` (`github`, `gitlab`, or `null` when [unknown](#git-host-of-a-project)), `tokenSet` (whether a token is stored), `tokenSetAt` (ISO 8601) and `tokenSetBy` (`{ "name": "<name>" }` of the manager who saved it, or `null` once that account is deleted); both are `null` without a token. The token, its ciphertext and its length are never returned. `pendingRemotes` holds the lines of [Remotes not added yet](#remotes-not-added-yet) in their order, each with `remote`, `sessions`, `firstAt` and `lastAt` (ISO 8601, or `null`), and is `[]` when there is none. `noRemote` is `{ "sessions": <n>, "folders": <k> }`, or `null` when every session has a remote. While the database is unreachable, it answers `503` with `{ "status": "unreachable", "refreshSeconds": <n> }`.

`POST /api/admin/projects` with `{ "remote": "<remote>", "name": "<name>" }` adds a project, with the [default role rules](roles-and-work-items.md#role-rules) in the same transaction, and answers `201` with it, in the shape of one project of the list. `name` may be missing, `null` or empty. Unknown fields are ignored, and a body that is not a JSON object is read as empty.

| Answer | When                                                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `{ "error": "Not a git remote", "field": "remote" }`: `remote` missing, not text, or not a remote of the forms above.         |
| `400`  | `{ "error": "Name must be text", "field": "name" }`, or `{ "error": "Name must be at most 80 characters", "field": "name" }`. |
| `409`  | `{ "error": "This remote is already the project <name>" }`: a project has the same normalised remote.                         |
| `503`  | The database is unreachable; nothing is added.                                                                                |

`PATCH /api/admin/projects/<id>` with `{ "name"?: "<name>", "remote"?: "<remote>" }` changes a project and answers `200` with it, in the shape of one project of the list, `sessions` counted after the change. A missing field stays unchanged; unknown fields are ignored; `{}` or a body that is not a JSON object answers `200` with the project unchanged. A remote that normalises to the project's own remote is saved without a conflict. The checks of the remote being free and the change run under the same lock as adding a project.

| Answer | When                                                                                                                                                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `404`  | `{ "error": "Not found" }`: `<id>` is not a positive integer, or no project has it (also one removed meanwhile). Checked before the body.                 |
| `400`  | `{ "error": "Not a git remote", "field": "remote" }`: `remote` is `null`, not text, or not a remote of the forms above. Checked before the name.          |
| `400`  | `{ "error": "Name is required", "field": "name" }` for an empty or blank name, `Name must be text`, or `Name must be at most 80 characters`, on `"name"`. |
| `409`  | `{ "error": "This remote is already the project <name>" }`: another project has the same normalised remote. Nothing is changed.                           |
| `503`  | `{ "status": "unreachable", "refreshSeconds": <n> }`: the database is unreachable; nothing is changed.                                                    |

The role rules of a project have their own routes, `GET` and `PUT /api/admin/projects/<id>/rules/role`: see [Roles and work items](roles-and-work-items.md#role-rules).

`DELETE /api/admin/projects/<id>` removes the project and every stored row of its remote ([Data](data.md#removing-a-project)) and answers `204` with no body. After the shared checks and `403`:

| Answer | When                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `404`  | `{ "error": "Not found" }`: `<id>` is not a positive integer written without a leading zero, or no project has it.                                                                   |
| `503`  | `{ "status": "unreachable", "refreshSeconds": <n> }` while the database is unreachable, or `{ "error": "Busy, try again" }` after 30 s of waiting for the locks. Nothing is removed. |

`PUT /api/admin/projects/<id>/git-host` with `{ "gitHost"?: "github" | "gitlab", "token": "<token>" }` [checks](#the-check) the token, then stores it encrypted, replacing any token stored before, and answers `200` with `{ "gitHost": "github", "tokenSet": true, "tokenSetAt": "<ISO 8601>", "tokenSetBy": { "name": "<name>" }, "defaultBranch": "<branch>" }`. The token is trimmed. `gitHost` is required, on every `PUT`, for a remote on another host than `github.com` and `gitlab.com`, and refused for those two. The token is stored under the same lock as adding a project, only if the project's remote is still the one checked. When two managers save at once, the last save wins. Nothing is stored on a refusal; after the shared checks and `403`, in this order:

| Answer | When                                                                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `404`  | `{ "error": "Not found" }`: `<id>` is not a positive integer, or no project has it (also one removed during the check).                                                    |
| `503`  | `{ "status": "unreachable", "refreshSeconds": <n> }`: the database is unreachable.                                                                                         |
| `400`  | `{ "error": "Token is required", "field": "token" }` for a token missing, empty, blank or not text, or `At most 1000 characters` on `"token"`. Checked before `gitHost`.   |
| `400`  | `{ "error": "Choose GitHub or GitLab", "field": "gitHost" }` for another host, when `gitHost` is missing or not `github` or `gitlab`.                                      |
| `400`  | `{ "error": "GitHub.com is always GitHub", "field": "gitHost" }` (or `GitLab.com is always GitLab`) when `gitHost` is sent for a remote on `github.com` (or `gitlab.com`). |
| `503`  | `{ "error": "No secret key: set FACTORYDECK_SECRET_KEY" }`: the key is missing or invalid.                                                                                 |
| `503`  | `{ "error": "gh not found on the server" }` (or `glab`): the git host's CLI is not installed on the server.                                                                |
| `422`  | `{ "error": "<message>", "field": "token" }`: the [check](#the-check) failed.                                                                                              |
| `409`  | `{ "error": "The remote changed during the check: try again" }`: the project's remote changed while the token was being checked.                                           |

`DELETE /api/admin/projects/<id>/git-host/token` forgets the project's token and answers `204`, also when no token was set; the chosen `gitHost` stays. It works without the secret key. After the shared checks and `403`, it answers `404` with `{ "error": "Not found" }` for an unknown project, then `503` while the database is unreachable.

## How a project is stored

The table `project` holds, for each project, its `id`, `name`, `slug` (unique), normalised `remote` (unique), `created_at` and `created_by`, the account of the manager who added it (emptied if that account is ever deleted). It also holds `git_host` (`github` or `gitlab`, stored only for a remote on another host than `github.com` and `gitlab.com`), `token_ciphertext`, `token_set_at` and `token_set_by`, the account that saved the token (emptied if that account is ever deleted). Removing a project deletes them with its row. The table `removed_session` lists every session deleted with a project: its session id, the project's name and the time of the removal.
