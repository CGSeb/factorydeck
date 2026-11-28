# The CLI

The FactoryDeck CLI runs on a developer's machine and sends their sessions to the instance under their account. It connects once, by asking the instance for a login that the developer approves in their browser: nobody copies a token.

## The command

The CLI is the `factorydeck` command, in the `cli/` package of the repository (a pnpm workspace package named `factorydeck`; the root package, private, is `factorydeck-app`). It has no runtime dependency and uses only Node 22 APIs.

### Installing for development

From a clone of the repository, `pnpm install`, then `pnpm cli <command>` runs `factorydeck <command>` from the TypeScript sources (`node cli/src/main.ts`), which needs Node 22.18 or later. Its tests run with the others in `pnpm check`. Publishing the package to npm is not done yet.

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

Exit codes: 0 success, 1 failure, 2 usage error. A usage error (an unknown command or option, a missing or extra argument, an invalid URL) is checked first, before any file or server is read. An unknown command prints the help, and no command at all prints the help on stderr, both with exit 2. Ctrl-C exits with code 130 and saves nothing.

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

`POST /api/cli/login` and `POST /api/cli/login/poll` need no token. An unknown route under `/api/cli/` answers `401` with `{ "error": "Run factorydeck login" }` without a valid token, and `404` with one. While the database is unreachable, a route that reads the connections answers `503` with the usual unreachable body.
