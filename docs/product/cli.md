# The CLI

The FactoryDeck CLI runs on a developer's machine and sends their sessions to the instance under their account. It connects once, by asking the instance for a login that the developer approves in their browser: nobody copies a token.

## The command

The CLI is the `factorydeck` command, in the `cli/` package of the repository (a pnpm workspace package named `factorydeck`; the root package, private, is `factorydeck-app`). It has no runtime dependency and uses only Node 22 APIs.

### Installing

The CLI is published on npm as `factorydeck` and needs Node 22 or later:

```sh
npm i -g factorydeck
factorydeck login https://deck.example.test
```

`npm i -g factorydeck@latest` upgrades it. `factorydeck --version` (or `-v`) prints `factorydeck <version>`, then `parser <n>`, the version of the log parser it sends sessions with, on stdout with exit 0. A usage error still wins over it, as over `--help`.

The published package holds one bundled file, `dist/main.js`, with the shared modules of `src/` it imports and the code of the libraries it uses (today `zod`; `yaml` and `smol-toml` once the CLI reads logs and configuration), so it installs no dependency; plus its `README.md` and `LICENSE`. No test, story or source map is published.

### Installing for development

From a clone of the repository, `pnpm install`, then `pnpm cli <command>` runs `factorydeck <command>` from the TypeScript sources (`node cli/src/main.ts`), which needs Node 22.18 or later; `--version` then reads the version of `cli/package.json`. Its tests run with the others in `pnpm check`. `pnpm --filter factorydeck build` bundles it into `cli/dist/main.js` (a Vite library build for Node 22, without source maps).

### Releasing

`cli/package.json` holds the version. The `Release CLI` workflow (`.github/workflows/release-cli.yml`) publishes the package when a tag `cli-v<version>` is pushed: it runs `pnpm check`, runs the pack test on Node 22, then publishes with `npm publish --provenance`, using the `NPM_TOKEN` secret (a publish-only npm token for `factorydeck`). A version with a `-` (`1.3.0-beta.1`) goes to the `next` dist-tag, any other to `latest`.

- It fails when the tag is not `cli-v` followed by the version of `cli/package.json`, and when that version is already on npm.
- A dry run (`npm publish --dry-run`) runs on every pull request that touches `cli/` or `src/cli-ingest/`, and from the Actions tab (`workflow_dispatch`, whose `dry-run` input defaults to true). A real publish needs a `cli-v<version>` tag; a dry run checks the tag too when it runs on one, and only warns when the version is already on npm.

To release: raise the version in `cli/package.json`, merge it, then push the tag, for example `git tag cli-v1.2.0 && git push origin cli-v1.2.0`.

`--server <url>` on any command overrides the server it uses, for example `pnpm cli status --server http://127.0.0.1:4317` against a local instance. `--server` and a different `<url>` argument together are a usage error.

### Servers

A server is named by its **origin**: `<url>` is trimmed and needs `http://` or `https://`; its path, query and trailing `/` are dropped, its host is compared without letter case (and in punycode), and a default port is dropped. So `https://Deck.example.test/team/` and `https://deck.example.test:443` are the same server, `https://deck.example.test`. A URL without `http://` or `https://`, or with a user name or password, prints `Invalid server URL: <url>. It needs http:// or https://.` and exits with code 2.

### factorydeck login \<url\>

Runs the [login flow](#connecting-the-cli) against the server, under the machine's host name (trimmed, cut to 80 characters, `unknown` when empty):

1. It prints `Open <verificationUrl> and check the code <XXXX-XXXX>.` and opens that URL in the browser when it can: with `open` on macOS, `cmd /c start` on Windows, `wslview` (else `explorer.exe`) under WSL, `xdg-open` on Linux with a display; on Linux without `DISPLAY` or `WAYLAND_DISPLAY`, or when the opener fails, the URL is only printed.
2. It polls every `interval` seconds the server gives (never less than 5), until `expiresIn`. A `429` waits one more interval; a network error or a `503` keeps polling.
3. Once the login is approved, it prints `Logged in to <origin> as <name> (<email>).` and saves the token.

Logging in again to a server keeps the old token until the new one arrives, then logs the old connection out (`POST /api/cli/logout`) and replaces it.

Errors, all with exit code 1:

| Case                                              | Message                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| The login is cancelled in the browser, or expires | `Login cancelled or expired. Run factorydeck login <origin> again.` |
| No answer, or none within 10 seconds              | `Could not reach <origin>.`                                         |
| `404` to the login request                        | `<origin> is not a FactoryDeck server with CLI login.`              |
| `503` to the login request                        | the server's error, e.g. `Too many pending logins, try again later` |
| A redirect (never followed) or another answer     | `Unexpected answer from <origin> (HTTP <status>).`                  |

### factorydeck logout \<url\>

Calls `POST /api/cli/logout` with the server's token, then forgets the token on this machine whatever the answer:

- `204` or `401` (the token was already refused): `Logged out of <origin>.`, exit 0.
- Anything else, or no answer: `Logged out of <origin> on this machine; could not reach it to end the connection.`, exit 1. The connection then stays on the server until it expires or is disconnected from the [CLI connections page](#the-cli-connections-page).
- Without a token for that server: `Not logged in to <origin>.`, exit 0.

### factorydeck status

Checks every server that has a token, in parallel, with `GET /api/cli/me`, and prints one line per server, sorted by origin:

```
https://deck.example.test  Ada ada@example.test  ada-laptop  ok
```

The line is the origin, the account's name and email, the machine name, and the result: `ok`, `token refused` (`401`), `unreachable` (no answer within 10 seconds, or `503`) or `unexpected answer (HTTP <n>)`. Columns are padded only on a terminal. The account and the machine come from the credentials file, so they show even when the server cannot be reached. `status` never rewrites the file: a refused token stays until `logout` or the next `login`.

- It exits with code 1 when a server is not `ok`, 0 otherwise.
- With no token: `Not logged in. Run factorydeck login <url>.` (exit 0).
- With `--server <url>`, it checks only that server, or prints `Not logged in to <origin>.` (exit 0).

### Help and exit codes

`factorydeck --help` prints `Usage: factorydeck <command> [options]` and one line per command and for `--server`; `factorydeck <command> --help` describes the command. Both go to stdout with exit 0.

Exit codes: 0 success, 1 failure, 2 usage error. A usage error (an unknown command or option, a missing or extra argument, an invalid URL) is checked first, before any file or server is read, and wins over `--help`: `factorydeck login not-a-url --help` is a usage error, while `factorydeck login --help` without a URL prints the help. An unknown command prints the help, and no command at all prints the help on stderr, both with exit 2. Ctrl-C exits with code 130 and saves nothing.

Errors go to stderr and everything else to stdout, with no colour and no spinner, the same with or without a terminal.

### Files

The CLI keeps its state in the folder `FACTORYDECK_CLI_HOME`, by default `~/.config/factorydeck` (`%APPDATA%\factorydeck` on Windows; under WSL, the Linux home). An empty `FACTORYDECK_CLI_HOME` counts as unset, `~/` is expanded, a relative path is resolved from the current folder, and `XDG_CONFIG_HOME` is not read. The folder is created with mode `700`.

The tokens live in `credentials.json` there, and nowhere else: one entry per server origin, readable only by the user (mode `600` where the file system has modes; on Windows, the rights of the profile apply). It is UTF-8 JSON indented with 2 spaces:

```json
{
  "version": 1,
  "servers": {
    "https://deck.example.test": {
      "token": "fdk_…",
      "account": {
        "id": 7,
        "email": "ada@example.test",
        "name": "Ada",
        "role": "dev"
      },
      "machine": "ada-laptop",
      "loggedInAt": "2026-03-02T09:30:00.000Z"
    }
  }
}
```

The file is written atomically (a temporary file with mode `600`, then a rename), and read again right before each write, so two logins at once keep both servers. A missing or empty file holds no server. A file that cannot be read or is not valid prints `Could not read <path>.`, exits with code 1, and is left as it is; one that cannot be written prints `Could not write <path>.` with exit 1.

## Connecting the CLI

1. The CLI sends `POST /api/cli/login` with `{ "machine": "<name of the machine>" }`, without a session. The instance answers:

   ```json
   {
     "deviceCode": "<32 random bytes, base64url>",
     "userCode": "WDJB-MJHT",
     "verificationUrl": "https://deck.example.test/cli?code=WDJB-MJHT",
     "expiresIn": 600,
     "interval": 5
   }
   ```

2. The CLI shows the code and the URL. The developer opens the URL in their browser and approves the login on the [Connect page](#the-connect-page).
3. Meanwhile the CLI polls `POST /api/cli/login/poll` with `{ "deviceCode": "…" }` every 5 seconds. It answers `202` `{ "status": "pending" }` until the login is approved, then `200` `{ "token": "fdk_…", "account": { "id", "email", "name", "role" } }`, once.
4. The CLI keeps the token and sends it as `Authorization: Bearer <token>`.

### The login request

- `machine` is trimmed, then 1 to 80 characters; otherwise `400` with `{ "error": "Machine is required" }` or `{ "error": "Machine must be at most 80 characters" }` and `"field": "machine"`. Unknown fields are ignored.
- Like every JSON route, a body that is not `application/json` answers `415` with `{ "error": "JSON body expected" }`, and a body over 1 MB answers `413` (see [Without a session](accounts.md#without-a-session)).
- `userCode` is 8 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0`, `O`, `1` or `I`), shown `XXXX-XXXX`. The instance reads a code without letter case, dashes and spaces, so `wdjb mjht` is the same code.
- `verificationUrl` is `<origin>/cli?code=<userCode>`, from the origin of the CLI's request: its `Host`, and `https` when the request came over HTTPS directly or with `X-Forwarded-Proto: https`.
- A login request lives 10 minutes: at 10 minutes or more it is expired. Pending requests live in the server's memory, so a restart cancels them. At most 1000 are pending at once; beyond, `POST /api/cli/login` answers `503` with `{ "error": "Too many pending logins, try again later" }`.

### Polling

The poll checks, in this order:

1. The body: without a `deviceCode` string, `400` with `{ "error": "Device code is required", "field": "deviceCode" }`.
2. The rate: a poll less than 5 seconds after the previous poll of the same login answers `429` with `{ "error": "Slow down" }`. The first poll may come at any time, and a refused poll does not count as the previous one.
3. The code: a cancelled, expired, unknown or already used login answers `410` with `{ "error": "This login is no longer valid. Run factorydeck login again." }`. So does an approved login whose account was deactivated before the poll.

The token is given once, to the first poll after the approval; the next poll answers `410`.

## The Connect page

`/cli?code=<userCode>` opens the Connect page for a signed-in account; signed out, it opens the [sign-in screen](accounts.md#the-sign-in-screen), which comes back to it once signed in. The page shows the FactoryDeck logo and the title `Connect the FactoryDeck CLI`, without the sidebar.

- With a code that is waiting for approval, it shows the line `<machine> asks to send sessions as <name> (<email>).`, with the name and email of the signed-in account, the code, and the buttons `Connect` and `Cancel`. Both are disabled while the choice is sent.
- `Connect` approves the login for the signed-in account and shows `Connected. You can go back to your terminal.` The CLI's next poll gets the token.
- `Cancel` cancels the login and shows `Cancelled.` The CLI's next poll answers `410`.
- While the code of the URL is read, the page shows nothing, so the card appears whole; while a typed code is read, the form stays in place with `Continue` disabled.
- Without a code, the page asks for it: a field `Code from your terminal` and a button `Continue`.
- An unknown or expired code, or one approved or cancelled already, shows `This code is not valid or has expired.` under the field, so another code can be typed.
- When the choice cannot be sent (the database or the server does not answer), the message shows under the buttons and both stay.

The page uses `POST /api/auth/cli` (read a login by its `code`), `POST /api/auth/cli/approve` and `POST /api/auth/cli/cancel`, all with `{ "code": "…" }` and a session. Each answers `410` with `{ "error": "This code is not valid or has expired." }` for a code that is not waiting for approval.

## CLI connections

Each approved login creates a **CLI connection**: the account, the machine name, a SHA-256 hash of the token, its creation time and its last use time. The token is `fdk_` followed by 32 random bytes in base64url; the instance never stores it, only its hash. A developer may have several connections, one per machine or more.

- A connection expires 30 days after its last use: at 30 days or more without use, its token is refused and the connection is deleted when it is seen.
- Each request with the token moves its last use, written at most once a minute.
- A manager sees the connections of every account on the [Team page](accounts.md#cli-connections-of-the-team), and can disconnect any of them there.
- [Deactivating an account](accounts.md#deactivating-an-account) deletes all its CLI connections, as it deletes its sign-in sessions. Their tokens stay refused after a reactivation: the developer runs `factorydeck login` again.

## The CLI connections page

`CLI connections` in the [account menu](navigation.md#sidebar) opens `/account/cli`, with the sidebar, for any signed-in account. It lists the connections of the signed-in account only: a manager sees their own here, not the team's.

- **Header**: `CLI connections`, with the summary `<n> machines` (`1 machine`). The page has no period pills; the project select stays in the sidebar and changes nothing here.
- **Table**: the columns `Machine`, `Connected` (the day the connection was made, `2 Mar 2026`) and `Last used` (`just now`, `3 min ago`, `2 h ago`, `5 d ago`), each with the exact date and time in a tooltip, and a `Disconnect` button at the end of each row. Rows are sorted by last use, most recent first. An expired connection is not listed.
- **Empty**: `No machine connected. Run factorydeck login <this site's address> in a terminal.`, with the address of the page (`https://deck.example.test`).
- **Disconnect** asks `Disconnect <machine>?` with `Its CLI stops sending until you log in again.`, and the buttons `Cancel` and `Disconnect` (in the danger colour). Confirming deletes the connection: the row goes away, the summary follows, and its token is refused from the next request. The focus moves to the `Disconnect` button of the row that took its place (the new last row when it was the last), or to the page when no machine is left. While it runs, the button reads `Disconnecting…` and the dialog cannot be closed. A connection that was already gone (disconnected from another tab, expired) counts as disconnected. When the database or the server does not answer, the dialog stays open with `Database unreachable. Start it with pnpm db:up.` or `Could not reach the server`, so the person can try again.

The page loads like the others: the header keeps the place of its summary while the list loads, under it `Loading…`, and it reloads every `refreshSeconds`. A `503` shows the unreachable message.

### Routes of the page

Both need the session cookie: a CLI token counts for nothing there (`401` with `{ "error": "Not signed in" }`).

| Route                                      | Answer                                                                                                                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/account/cli-connections`         | `200` `{ "status": "ok", "refreshSeconds": <n>, "connections": [{ "id", "machine", "createdAt", "lastUsedAt" }] }`: the account's connections that have not expired, by last use, most recent first. |
| `DELETE /api/account/cli-connections/<id>` | `204` once the connection is deleted. A connection of another account, an unknown id or one already deleted answers `404` with `{ "error": "Connection not found" }`, and nothing is deleted.        |

While the database is unreachable, both answer `503` with the usual unreachable body.

## Routes with a token

The token is checked on the whole `/api/cli/` prefix, before any route, except `POST /api/cli/login` and `POST /api/cli/login/poll`. A request with `Authorization: Bearer <token>` of an active connection is signed in as its account on the routes under `/api/cli/`, and nowhere else: on every other route, the token counts for nothing and the session cookie is needed. On the routes under `/api/cli/`, the cookie counts for nothing. A missing, wrong, disconnected or expired token, or the token of a deactivated account, answers `401` with `{ "error": "Run factorydeck login" }`.

| Route                  | Answer                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `GET /api/cli/me`      | `200` `{ "account": { "id", "email", "name", "role" }, "machine": "<machine name>" }`.  |
| `POST /api/cli/logout` | Deletes the connection of the token and answers `204`; the token is refused afterwards. |
| `POST /api/cli/ingest` | Stores a batch of session figures: see [Sending sessions](#sending-sessions).           |

`POST /api/cli/login` and `POST /api/cli/login/poll` need no token. An unknown route under `/api/cli/` answers `401` with `{ "error": "Run factorydeck login" }` without a valid token, and `404` with one. While the database is unreachable, a route that reads the connections answers `503` with the usual unreachable body.

## Sending sessions

The CLI reads the session logs on the developer's machine and sends their figures with `POST /api/cli/ingest`; the logs themselves never leave the machine. A batch holds what the database stores for sessions, sub-agents, API calls, skill launches, prompts and closing lines, and nothing more: no prompt text, tool output or file content. The schema of the batch lives in `src/cli-ingest/batch-schema.ts`, which imports nothing from the server or the database, so the CLI imports it.

### The batch

```json
{
  "parserVersion": 1,
  "threads": [
    {
      "fileKey": "claude-code/4f1c…/main",
      "agent": "claude-code",
      "sessionId": "4f1c…",
      "subAgentId": null,
      "remote": "git@github.com:acme/shop.git",
      "from": 0,
      "readTo": 18342,
      "session": {
        "cwd": "/home/dev/shop",
        "gitBranch": "feat/12-cart",
        "gitBranches": ["main", "feat/12-cart"],
        "title": "Build the cart",
        "firstAt": "2026-03-12T09:00:00.000Z",
        "lastAt": "2026-03-12T09:30:00.000Z",
        "turnEnded": true
      },
      "apiCalls": [
        {
          "requestKey": "req_011",
          "at": "2026-03-12T09:01:00.000Z",
          "model": "claude-sonnet-4-5",
          "inputTokens": 100,
          "cacheWriteTokens": 10,
          "cacheReadTokens": 1000,
          "outputTokens": 50
        }
      ],
      "skillLaunches": [
        {
          "recordId": "9b2e…",
          "at": "2026-03-12T09:00:30.000Z",
          "skill": "build-feature",
          "subAgentId": null
        }
      ],
      "prompts": [
        {
          "recordId": "9b2e…",
          "at": "2026-03-12T09:00:30.000Z",
          "promptId": "c41a…",
          "command": "build-feature"
        }
      ],
      "closingLines": [
        {
          "recordId": "e07d…",
          "at": "2026-03-12T09:29:00.000Z",
          "position": 17904,
          "line": "Work item: #12 (builder)"
        }
      ]
    }
  ]
}
```

- A **thread** is one session log (`subAgentId: null`, with its `session` fields) or one sub-agent log (`subAgentId` set, with its `subAgent` fields: `toolUseId`, `agentType`, `description`, `model`, `cwd`, `gitBranch`, `firstAt`, `lastAt`). `apiCalls` may be empty or left out.
- `fileKey` is `<agent>/<session id>/<main | sub-agent id>`. It is the source of the thread's records, in place of a path on the machine, so the same session sent from two machines, or read by the [local ingestion](data.md#session-logs) and sent by a CLI, is one session and counts once.
- `from` and `readTo` are the byte offsets of the log the thread starts at and reads up to. The instance keeps, per file key, the last `readTo` and `parserVersion` received; it does not check `from`.
- A thread carries the fields of its thread up to `readTo`; they replace the stored ones, except `firstAt`, which keeps the earlier of the two. When a session's main log has no working directory, the session takes the one of its earliest sub-agent, as the [local ingestion](data.md#claude-code) does.
- Unknown fields are ignored, so a newer CLI is accepted by an older instance.

### Skill launches, prompts and closing lines

A thread may carry three more arrays, each empty or left out when it has none. They hold what the [local ingestion](data.md#session-logs) stores, and are stored and read the same way: the [Skills](skills-and-roles.md) page counts the launches, and the closing lines give a thread its [work item and role](roles-and-work-items.md) on every page, including the issue story.

- `skillLaunches`: each skill launched, by a `Skill` tool call or by a typed slash command: `recordId` (the log record's id), `at`, `skill` and `subAgentId`, which is the thread's own (`null` on a session log) and may be left out. One record can launch several skills. A slash command whose skill instructions come in a later batch is resolved by the CLI, which keeps the pending command and sends the launch once resolved, on the session log.
- `prompts`: each prompt the developer typed, on a session log only: `recordId`, `at`, `promptId` (a string or `null`) and `command`, the slash command's name without the `/`, or `null` for a plain prompt. **The text of a prompt is never sent**, only the name of the command it typed.
- `closingLines`: the last line of the assistant's reply that closes a turn, on a session log only: `recordId`, `at`, `position` (the record's byte offset in the log) and `line`, at most 200 characters.
- A `recordId` is the record's `uuid`, or `offset:<n>` for a record without one; at most 200 characters.
- A skill launch is known by its file key, record id and skill; a prompt and a closing line by their file key and record id. A marker is read when the pages are read, with the rules of the session's project, so a session whose project is added later shows its work item without being sent again.

### Project and sender

- `remote` is the `origin` remote of the thread's working directory, stored in the normalised form of [Remotes](projects.md#remotes). A remote that is not a git remote (a path, a `file://` URL) counts as `null`, never as an error.
- A session belongs to the project of its main log's remote; a sub-agent's remote gives the project only while the main log has none. A session whose remote is no project's is stored and shows once a project with that remote is added; a session with no remote is stored with none.
- Each session records the account and the machine (the CLI connection's name) that sent it first. A session sent later by another account keeps its first sender; the records of the second are added like any other. A session first read by the local ingestion gets the first CLI sender that sends it. `GET /api/sessions/<id>` gives it as `sentBy: { "name": "<the account's current name>", "machine": "<machine>" }`, or `null` for a session never sent by a CLI.
- Sending the same batch twice stores nothing twice: a session, a sub-agent and an API call are known by their session id, sub-agent id and record key, a skill launch, a prompt and a closing line by their file key and record id, never by the machine.
- The instance never deletes a session or a record because a CLI stopped sending it.

### Answers

`200` with `{ "sessions": <n>, "threads": <n>, "apiCalls": <n> }`: the distinct sessions of the batch, the threads received, and the API calls this batch stored (a call already stored is not counted). `threads: []` answers zeros.

The body is JSON, gzip-compressed or not (`Content-Encoding: gzip`). A batch is stored in one transaction, under the ingestion lock, or not at all. The checks run in this order:

| Answer | When                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `401`  | The token is refused: `{ "error": "Run factorydeck login" }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `415`  | The body is not `application/json` (`{ "error": "JSON body expected" }`), or its `Content-Encoding` is not `gzip`, `x-gzip` or `identity`, read without letter case (`{ "error": "Content-Encoding must be gzip" }`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `413`  | The body is above 5 MB as sent: `{ "error": "Batch too large", "limit": "body" }`. This route has its own limits in place of the 1 MB of the other routes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `413`  | The body is above 20 MB once decompressed: `limit` `decompressed`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `400`  | The body is not valid gzip or JSON (`{ "error": "Body is not valid gzip", "path": "" }`, `Body is not valid JSON`), or does not match the schema: `{ "error": "<message>", "path": "threads.3.apiCalls.12.at" }`, for the first problem only. So are a `fileKey` not derived from `agent`, `sessionId` and `subAgentId`, or sent twice; an id empty, over 200 characters or containing `/`; an `agent` other than `claude-code` or `codex`; a `parserVersion` that is not a whole number from 1 to 2,147,483,647; `readTo` below `from`; a negative or fractional offset, position or token count; a time that is not ISO 8601 with an offset; a `recordId` empty or over 200 characters; an empty `skill`, `command` or `line`, or a `line` over 200 characters; a skill launch whose `subAgentId` is not its thread's; prompts or closing lines on a sub-agent log (`threads.4.prompts`). |
| `413`  | More than 2000 threads (`limit` `threads`) or 20 000 records in all, API calls, skill launches, prompts and closing lines together (`limit` `records`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `503`  | `{ "error": "Busy, try again" }` after waiting 30 seconds for the ingestion lock, held by the local ingestion, a git host collection, a project deletion or another batch. The local ingestion does not wait: it skips its run while a batch holds the lock.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

1 MB is 1,048,576 bytes; 5 MB and 20 MB the same way. 2000 threads and 20 000 records are accepted; one more is refused. While the database is unreachable, the route answers `503` with the usual unreachable body and stores nothing.
