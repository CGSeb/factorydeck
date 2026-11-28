# The CLI

The FactoryDeck CLI runs on a developer's machine and sends their sessions to the instance under their account. It connects once, by asking the instance for a login that the developer approves in their browser: nobody copies a token.

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
- [Deactivating an account](accounts.md#deactivating-an-account) deletes all its CLI connections, as it deletes its sign-in sessions. Their tokens stay refused after a reactivation: the developer runs `factorydeck login` again.

## The CLI connections page

`CLI connections` in the [account menu](navigation.md#sidebar) opens `/account/cli`, with the sidebar, for any signed-in account. It lists the connections of the signed-in account only: a manager sees their own here, not the team's.

- **Header**: `CLI connections`, with the summary `<n> machines` (`1 machine`). The page has no period pills; the project select stays in the sidebar and changes nothing here.
- **Table**: the columns `Machine`, `Connected` (the day the connection was made, `2 Mar 2026`) and `Last used` (`just now`, `3 min ago`, `2 h ago`, `5 d ago`), each with the exact date and time in a tooltip, and a `Disconnect` button at the end of each row. Rows are sorted by last use, most recent first. An expired connection is not listed.
- **Empty**: `No machine connected. Run factorydeck login <this site's address> in a terminal.`, with the address of the page (`https://deck.example.test`).
- **Disconnect** asks `Disconnect <machine>?` with `Its CLI stops sending until you log in again.`, and the buttons `Cancel` and `Disconnect` (in the danger colour). Confirming deletes the connection: the row goes away, the summary follows, and its token is refused from the next request. While it runs, the button reads `Disconnecting…` and the dialog cannot be closed. A connection that was already gone (disconnected from another tab, expired) counts as disconnected. When the database or the server does not answer, the dialog stays open with `Database unreachable. Start it with pnpm db:up.` or `Could not reach the server`, so the person can try again.

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
