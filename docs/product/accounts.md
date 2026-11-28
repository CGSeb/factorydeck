# Accounts

Who can use a FactoryDeck instance. One instance serves one organisation: there is no organisation in the data, and every account sees every project.

## Roles

| Role      | Who                                                 |
| --------- | --------------------------------------------------- |
| `manager` | Runs the instance. The first account is always one. |
| `dev`     | A member of the team.                               |

Every API route needs a signed-in account, except the few listed under [Without a session](#without-a-session). A dev and a manager read every route alike, except the routes under `/api/team/`, which only a manager can use (see [The Team page](#the-team-page)). While the instance has no account, the pages open the [first-manager screen](#the-first-manager-screen). An account has an email, a name, a password, a role, whether it is active, its creation time and its last sign-in time.

- **Email**: trimmed and lowercased, then stored that way: at most 254 characters, with one `@` that has text on both sides. Two accounts cannot share an email, so `Ada@Example.test` and `ada@example.test` are the same one.
- **Name**: trimmed, 1 to 80 characters.
- **Password**: 12 to 200 characters, kept as typed (spaces included). FactoryDeck stores only a salted `scrypt` hash of it, and never logs it.

## The first manager

A new instance has no account. While it has none, each start of the server creates a **setup code** and writes it to the server's log:

```
No account yet. Setup code: K7MQ2XRD
```

The code is 8 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0`, `O`, `1` or `I`). It lives in the server's memory only: a restart replaces it, and the first account makes it useless. Once an account exists, the server creates no code and logs nothing about it. Only someone who can read the server's log can set the instance up, so nobody who reaches a new instance first can take it.

### The first-manager screen

While `GET /api/auth/state` answers `{ "setup": true }`, every page of the app opens `/setup` instead of its content, without the sidebar. The screen shows the FactoryDeck logo, the title `Set up FactoryDeck`, the line `Enter the setup code from the server log, then create the first manager account.`, the fields `Setup code`, `Name`, `Email` and `Password` (hint `At least 12 characters`), and the button `Create manager account`. It follows the light or dark theme chosen before (or the device's).

- Focus starts on `Setup code`; Enter in any field submits. The values are sent as typed: the server trims the code, the email and the name.
- While the request runs, the button reads `Creating…` and is disabled; a second Enter sends nothing.
- `201` opens `/`, signed in. A `403` (`Wrong setup code`) or a `409` (`Already set up`) shows the API's message under the form; a `400` shows its message under the field it names, marks that field invalid and moves the focus to it. A `503` shows `Database unreachable. Start it with pnpm db:up.` under the form. No answer at all, or any other answer without an `error` message (a `500` or `502` from a proxy, for example), shows `Could not reach the server`. Each message is announced to screen readers, and the place of every message is reserved (one line, two below 480 px wide, enough for every message the server sends), so the form keeps its size.
- While the state is not known yet, the app shows nothing and calls no other route; while `setup` is `true`, the app calls only `/api/auth/*`. If the state cannot be read (the database or the server does not answer), the app shows the [unreachable screen](#the-unreachable-screen).
- Once set up, `/setup` opens `/`.

The person who installs the instance can also send the code with their email, name and password from a terminal:

```bash
curl -i http://127.0.0.1:4317/api/auth/setup \
  -H 'content-type: application/json' \
  -d '{"code":"K7MQ2XRD","email":"ada@example.test","name":"Ada","password":"a long passphrase"}'
```

| Answer | When                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `201`  | The account is created, role `manager`, and signed in: the body is its `id`, `email`, `name` and `role`.                 |
| `409`  | An account already exists: `{ "error": "Already set up" }`.                                                              |
| `403`  | The code is wrong or missing: `{ "error": "Wrong setup code" }`. Letter case and spaces around it do not matter.         |
| `400`  | A field is not valid: `{ "error": "<message>", "field": "email" \| "name" \| "password" }`, the first one in that order. |

The server checks for an existing account first, then the code, then the fields; nothing is created unless the answer is `201`. Two setups sent at the same time create one account; the other answers `409`.

`GET /api/auth/state` answers `{ "setup": true }` while the instance has no account, then `{ "setup": false }`. Both routes work without being signed in. While the database is unreachable, both answer `503` with `{ "status": "unreachable", "refreshSeconds": <n> }`, like the other routes, and create nothing.

The server checks for an account once it listens, then prints its address. If the database does not answer at that moment, it logs `Could not check for accounts: <message>` and creates no code: restart it once the database is up.

## Sign-in sessions

A successful setup signs the new manager in: it records their last sign-in time and sets the cookie `factorydeck_session`, which holds a random 32-byte token.

| Attribute  | Value                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `HttpOnly` | Always: page scripts cannot read it.                                                                |
| `SameSite` | `Lax`.                                                                                              |
| `Path`     | `/`.                                                                                                |
| `Max-Age`  | 30 days.                                                                                            |
| `Secure`   | When the request came over HTTPS, directly or through a proxy that sets `X-Forwarded-Proto: https`. |

FactoryDeck stores only the SHA-256 hash of the token, with the session's creation time and last use time.

## Signing in and out

```bash
curl -i -c cookies http://127.0.0.1:4317/api/auth/sign-in \
  -H 'content-type: application/json' \
  -d '{"email":"ada@example.test","password":"a long passphrase"}'
```

| Route                     | Answer                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/sign-in`  | `200` with the account (`id`, `email`, `name`, `role`): it opens a new session, sets its cookie and records the last sign-in time. A wrong email, a wrong password, a missing field and a deactivated account all answer `401` with `{ "error": "Wrong email or password" }`. Too many failures on one email answer `429` (see [Failed sign-ins](#failed-sign-ins)). |
| `POST /api/auth/sign-out` | `204`, with or without a valid session: it deletes the current session and clears the cookie.                                                                                                                                                                                                                                                                        |
| `GET /api/auth/me`        | The account of the session, or `401` with `{ "error": "Not signed in" }`.                                                                                                                                                                                                                                                                                            |

The email is compared the way it is stored: trimmed, in lower case. The password is compared as typed. An account can have several sessions open at once, one per browser or computer; signing out closes only the current one. In the app, `Sign out` is in the [account menu](navigation.md#sidebar) at the bottom of the sidebar. A sign-in sent with a session cookie deletes that session before it opens the new one; a failed sign-in leaves it open.

### Failed sign-ins

After **10 failed sign-ins on one email within 15 minutes**, `POST /api/auth/sign-in` for that email answers `429` with `{ "error": "Too many attempts, try again in <n> minutes" }`, even with the right password, until 15 minutes after the oldest of those attempts. `<n>` is the minutes left, rounded up and at least 1 (`try again in 1 minute` in the singular), and the header `Retry-After` gives the seconds left, rounded up.

- The count is kept per email, trimmed and in lower case. An email with no account counts the same, so the answer does not tell which emails exist; a deactivated account counts too.
- An attempt is counted when it arrives, before its password is checked, so attempts sent at the same time on one email get at most 10 password checks per window. An attempt leaves the count once 15 minutes or more have passed since it.
- The limit is checked before the database: while it applies, `429` wins over `503` and `401`. An attempt answered `429` or `503` is not counted, and an email that is missing, not a string or not of the email form (at most 254 characters, one `@` with text on both sides) answers `401` without being counted.
- A successful sign-in clears the count of its email. Sessions already open keep working: only signing in is limited.
- The counts live in the server's memory, for at most 10,000 emails (beyond that, the email with the oldest last attempt is dropped); a restart forgets them. Only this route counts: the first-manager setup keeps its own code check.

### The sign-in screen

When the app loads, it reads `GET /api/auth/state`, then `GET /api/auth/me` only when `setup` is `false`. A `401` from `/me` opens the sign-in screen; the app calls no data route before `/me` answers an account. Any page opened without a session shows the sign-in screen at `/sign-in?next=<path, query and hash asked for>`, without the sidebar: `next` is encoded as a query value (`/sign-in?next=%2Fsessions%3Fperiod%3D7d`), and left out when the page asked for is `/`. The screen reuses the card of the first-manager screen: the FactoryDeck logo, the title `Sign in to FactoryDeck`, the fields `Email` (an email field the browser fills as the user name) and `Password` (filled as the current password), and the button `Sign in`. It has no theme button and follows the light or dark theme chosen before (or the device's).

- Focus starts on `Email`; Enter in any field submits. The email and password are sent as typed, with no check in the browser: an empty field is sent and answered `Wrong email or password`, and the server normalises the email.
- While the request runs, the button reads `Signing in…` and is disabled; a second Enter sends nothing.
- Success reads `GET /api/auth/me`, then opens `next`, replacing the sign-in screen in the history, so Back never shows it again. If that read gets no account, the form shows the message of the unreachable screen and stays.
- A refusal (`401`, `Wrong email or password`; `429`, `Too many attempts, try again in <n> minutes`; or any other answer with an `error` message) shows the API's message under the form, keeps the email, empties the password and moves the focus to `Password`. A `503` shows `Database unreachable. Start it with pnpm db:up.`; no answer at all, or any other answer without an `error` message, shows `Could not reach the server`; both keep the email and the password and move the focus to `Sign in`. Each message is announced to screen readers, and its place under the button is reserved (one line, two below 480 px wide), so the card keeps its size.
- `next` is used only when it is a path of this site: it starts with `/` and not with `//`, holds no `\`, and is not `/sign-in`, `/setup`, or under `/api/`, `/invite/` or `/reset/` (in any letter case, with or without a trailing `/`). Anything else, or none, opens `/`. When `next` is repeated, the first value counts. The app opens it inside the app, never by setting the browser's location.
- Any `401` from the API while the app is open, from any route but `POST /api/auth/sign-in`, writes included, opens the sign-in screen with `next` set to the current page, replacing it in the history. From that first `401`, the app calls no data route until a sign-in succeeds, ignores the answers of requests already sent, and drops the action that got the `401`; after the sign-in, the page loads afresh.
- A signed-in person who opens `/sign-in` goes to `next`, or `/`. While `setup` is `true`, `/sign-in` opens `/setup` and drops `next`.

### The unreachable screen

When the state or the account cannot be read at load, the app shows the unreachable screen instead of the sign-in screen, at the address asked for: the card of the sign-in screen with the logo, the message (`Database unreachable. Start it with pnpm db:up.` on a `503`, `Could not reach the server` on no answer, a `500`, a `502` from a proxy, or a body that is not the one expected), then a `Retry` button, which takes the focus. The message is announced to screen readers.

`Retry` reads `Retrying…` and is disabled while it runs, and keeps the focus. It reads the state and the account again: an account opens the page asked for, a `401` the sign-in screen, `setup: true` the first-manager screen, and a failure keeps the unreachable screen with its new message. Nothing retries by itself.

## How long a session lasts

A session expires **30 days after its last use**: once 30 days or more have passed since its stored last use. Each request with it moves its last use (written at most once a minute) and sends the cookie again with a fresh `Max-Age` of 30 days, so a session used every day never ends. An expired session is deleted the next time it is sent, and the request is answered as not signed in. A session whose account is deactivated is refused and deleted the same way.

## Without a session

Every route under `/api/` answers `401` with `{ "error": "Not signed in" }` without a valid session, unknown routes included, except:

- `GET /api/health`;
- `GET /api/auth/state` and `POST /api/auth/setup`;
- `POST /api/auth/sign-in` and `POST /api/auth/sign-out`;
- `POST /api/auth/invitation` and `POST /api/auth/invitation/accept` (see [Invitations](#invitations));
- `POST /api/auth/reset` and `POST /api/auth/reset/save` (see [Reset links](#reset-links)).

The built UI (its HTML, scripts and styles) is served without a session. When the API answers `401`, its pages open the [sign-in screen](#the-sign-in-screen). While the database is unreachable, a route that needs a session answers `503` with the usual unreachable body. No setting turns authentication off.

Every `POST`, `PUT`, `PATCH` and `DELETE` under `/api/`, open routes included, goes through two body checks before the session is checked, in this order:

1. A body larger than 1 MB (1,048,576 bytes) answers `413` with `{ "error": "Body too large" }`, without being read further.
2. A body that is not `application/json` (any letter case, with or without a `charset`) answers `415` with `{ "error": "JSON body expected" }`, so a form on another site cannot send one with the cookie.

A request with no body passes both. Only then does a missing session answer `401`.

## The Team page

A manager sees a `Team` link in the sidebar, the last one, after `Roles`; it opens `/team`, the list of every account of the instance. A dev sees no such link.

- **Header**: `Team`, with the summary `<n> accounts · <m> managers`. `<n>` counts every account and `<m>` every account with role `manager`, deactivated ones included; one reads `1 account` and `1 manager`. The page has no period pills; the project select stays in the sidebar and changes nothing here.
- **Table**: the columns `Name`, `Email`, `Role` (`Manager` or `Dev`), `Status` (`Active` or `Deactivated`) and `Last sign-in`. Every account is listed, with no paging: active accounts first, then by name without letter case, then by email. The email shows as stored. The manager's own row carries a small muted `You` tag after the name. Deactivated rows are in muted text. Long names and emails wrap; a table wider than the page scrolls inside its box.
- **Last sign-in** reads as elsewhere (`just now`, `3 min ago`, `2 h ago`, `5 d ago`), with the exact date (`22 Nov, 17:33`) in a tooltip; an account that never signed in reads `Never`.
- **Actions**: each row of another account gets an actions menu (the `⋯` button at the end of the row); the manager's own row has none. An active dev's menu offers `Make manager`, an active manager's `Make dev` (see [Changing a role](#changing-a-role)), then `Reset password link` (see [Reset links](#reset-links)), and the menu of an active account ends with `Deactivate`, in the danger colour. A deactivated account's menu offers only `Reactivate` (see [Deactivating an account](#deactivating-an-account)).
- **Invite**: a button in the header, shown once the list has loaded (not while it loads, on the refusal or while the database is unreachable), opens the [invite dialog](#inviting-someone).
- **Pending invitations**: under the accounts, a section with the columns `Email`, `Role`, `Invited by` and `Expires`, then `New link` and `Revoke` on each row. It is hidden when no invitation is pending. See [Invitations](#invitations).

The page loads like the others: the header keeps the place of its summary while the list loads, under it `Loading…`, and it reloads every `refreshSeconds`. It reads `GET /api/team/accounts` and `GET /api/team/invitations` together, as one load: a `503` from either shows the unreachable message, and any other failure of either keeps the last data. Invitations are not counted in the summary.

| Answer of `GET /api/team/accounts`         | The page shows                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `200`                                      | The table.                                                                              |
| `403`                                      | `Only managers can manage the team.` in place of the table, the header with no summary. |
| `503`                                      | `Database unreachable. Start it with pnpm db:up.`                                       |
| `401`, a network error or any other answer | The last data (or `Loading…`), and it tries again every 10 s.                           |

The refusal also replaces a table already shown: a manager made dev meanwhile sees it at the next refresh. The `Team` link, though, comes from one `GET /api/auth/me` each time the app enters the signed-in dashboard (first load, after setup, after each sign-in): it shows once that read answers a manager, and stays absent while it loads or when it answers `503` or nothing. A `401` from that read opens the [sign-in screen](#the-sign-in-screen), without the sidebar. A role changed meanwhile shows or hides the link at the next of those reads, not before.

### Team routes

`GET /api/team/accounts` answers `200` with `{ "status": "ok", "refreshSeconds": <n>, "accounts": [...] }`, in the order of the table. Each account has `id`, `name`, `email`, `role`, `active`, `lastSignInAt` (ISO 8601, or `null`) and `you` (`true` on the requester's own account only). While the database is unreachable, it answers `503` with `{ "status": "unreachable", "refreshSeconds": <n> }`.

The role is read from the session's account at each request, so a change of role counts from the next request. When several answers apply to a path under `/api/team/`, the first wins: `413`, then `415`, then `401` (or `503`), as for every route; then `403` with `{ "error": "Managers only" }` for a dev, on any path under `/api/team/`, unknown ones included; then `404` with `{ "error": "Not found" }` for a manager on an unknown one.

### Changing a role

`Make manager` and `Make dev` apply at once, with no confirmation. While the change runs, the menu closes and that row's actions button is disabled and busy; the other rows stay usable. Once the API answers, the row shows the new role and the summary `<m> managers` is recounted at once; list answers to requests sent before the change answered are ignored, so a refresh never brings the old role back. Success or failure, the focus goes back to the row's actions button.

A failure keeps the old role and shows its message on one line under the row, spanning the table and announced politely without moving the focus: the API's message on a `409` (or a `400`), `Database unreachable. Start it with pnpm db:up.` on a `503`, and `Could not reach the server` on a `404`, a network error or any other answer without a message. The line stays across auto refreshes and clears when any action on the page starts or succeeds. A `403` replaces the table with the refusal, as a `403` on the list does; a `401` opens the [sign-in screen](#the-sign-in-screen).

The new role counts from the person's next request (the role is read at each one); their sessions stay open. A manager made dev loses the `Team` link at their next [read of the account](#the-team-page), and a dev made manager gains it.

`PATCH /api/team/accounts/<id>` with `{ "role": "manager" | "dev" }` answers `200` with the account, in the shape of one row of `GET /api/team/accounts`, with no envelope. The body takes exactly one of `role` or `active`; unknown fields are ignored, and a body that is not a JSON object is read as empty.

| Answer | When                                                                                                                                                                                                                                                                 |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `404`  | `<id>` is not the decimal id of an existing account (`abc`, `-1`, `1.5`, `007`, an unknown number): `{ "error": "Not found" }`.                                                                                                                                      |
| `400`  | `role` is `null`, not a string, or not exactly `manager` or `dev`: `{ "error": "Role must be manager or dev", "field": "role" }`. Both `role` and `active`: `{ "error": "Change the role or the status, not both" }`. Neither: `{ "error": "Send role or active" }`. |
| `409`  | `{ "error": "You cannot change your own role" }`; on a deactivated account, `{ "error": "Reactivate this account first" }`; when the change would leave no active manager, `{ "error": "The team needs at least one active manager" }`.                              |
| `200`  | The account; a role it already has answers it unchanged and writes nothing.                                                                                                                                                                                          |

When several answers apply, the first wins: the chain of the [team routes](#team-routes), then `404`, then `400`, then `409` yourself, then `409` deactivated, then `409` last active manager. The change runs in one transaction that locks the active managers and reads the requester again: one deactivated meanwhile gets `401` `{ "error": "Not signed in" }`, one made dev meanwhile `403` `{ "error": "Managers only" }`. So two changes at the same time never leave the team without an active manager; since changing one's own role is refused and the requester must be an active manager, the last-manager answer only comes from such a race.

## Invitations

A manager invites a developer or another manager with a link they send themselves: FactoryDeck sends no email. An invitation is a row of the account tokens, kind `invitation`, for one email and one role, valid **7 days**: it stops working once 7 × 24 h or more have passed since it was created. The link is `<origin>/invite/<token>`, where `<origin>` is the origin the manager's browser uses (so it works behind a reverse proxy) and `<token>` is 32 random bytes in base64url. FactoryDeck stores only the token's hex SHA-256, so it can show a link only once, when it is created: a lost link is replaced with `New link`. A link works once.

An invitation is **pending** while it is unused and not expired. Creating an invitation for an email (`Invite` or `New link`) and revoking one delete the unused invitations of that email, so an email has at most one pending invitation and the older link stops working. Accepting marks the invitation used. Expired invitations are kept, but never listed. An invitation outlives the manager who sent it, even demoted or deactivated: it keeps working and still names them. A pending `manager` invitation does not count as a manager.

### Inviting someone

`Invite` opens a dialog with `Email`, `Role` (a select, `Dev` first and by default, or `Manager`), `Cancel` and `Create invitation`, with the focus on `Email`. While the request runs, the button reads `Creating…` and is disabled. A `400` shows its message under the field it names and moves the focus there; a `409` (`This email already has an account`) shows under `Email` the same way. A `503` shows `Database unreachable. Start it with pnpm db:up.` and any other failure `Could not reach the server`, under the fields, keeping them.

On `201`, the same dialog shows the link: the title `Invitation link`, the line `Send this link to <email>. It works once, until <expiry>, and is shown only now: if it is lost, make a new one.`, the link in a read-only field, `Copy link` and `Done`. `Copy link` reads `Copied` for 2 seconds; when the browser refuses the copy, it reads `Could not copy` for 4 seconds and the link is left selected in its field, to copy by hand. The link stays through the page's refreshes until `Done` closes it: `Escape` and a click outside leave it open, since a lost link can only be replaced. In the form, `Escape` and a click outside act as `Cancel`. Closing the dialog gives the focus back to `Invite`.

### Pending invitations

The section lists each pending invitation with its email, its role (`Manager` or `Dev`), who invited (the inviter's name, or `—` when that account no longer exists) and when it expires, as an exact date (`29 Nov, 17:33`). It is sorted by soonest expiry, then by email, with no limit and no paging; long values wrap.

- `New link` replaces the invitation with a new one, same email and role, sent by the manager who clicked, valid 7 days from then, and shows its link in the dialog above.
- `Revoke` deletes the invitation at once, without a confirmation; the row leaves the list. After `Revoke` or `New link` succeeds, the focus moves to `Invite`, since the row it was on is gone.
- An error of either shows beside the row (`Invitation not found` for one accepted, expired or revoked meanwhile); the next refresh drops a row that is gone.

### Team invitation routes

| Route                                      | Answer                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/team/invitations`                | `200` with `{ "status": "ok", "refreshSeconds": <n>, "invitations": [...] }`, in the order of the section, each with `id`, `email`, `role`, `invitedBy` (a name or `null`), `createdAt` and `expiresAt` (ISO 8601). `503` while the database is unreachable.                                                        |
| `POST /api/team/invitations`               | With `{ "email", "role" }`: `201` with `{ id, email, role, invitedBy, createdAt, expiresAt, token }`. `400` with `{ "error", "field": "email" \| "role" }`, email checked first (`Role must be manager or dev`); then `409` with `{ "error": "This email already has an account" }`, deactivated accounts included. |
| `POST /api/team/invitations/<id>/new-link` | `201` with the same shape for the new invitation. `404` with `{ "error": "Invitation not found" }` when the invitation is not pending, or the id is unknown or not a number.                                                                                                                                        |
| `DELETE /api/team/invitations/<id>`        | `204`, also when the invitation is already gone.                                                                                                                                                                                                                                                                    |

They answer like every route under `/api/team/` first (`413`, `415`, `401` or `503`, `403` for a dev, `404` for an unknown path), then their own answers. The email is trimmed and lowercased as for an account; unknown fields are ignored and a body that is not a JSON object reads as empty. Two invitations sent at the same time for one email leave one pending.

### The invitation screen

`/invite/<token>` shows, in the card of the sign-in screen, the FactoryDeck logo, the title `Join FactoryDeck`, the invited email (not editable), the fields `Name` and `Password` (hint `At least 12 characters`, filled by the browser as a new password, with a hidden user name field holding the email) and the button `Create account`. Opened while signed in, it also shows above the form, in muted text, `You are signed in as <name>. Creating this account signs you out.` See [Invitation screen](navigation.md#invitation-screen) for how it is reached.

- Nothing shows until the invitation is read. A `503` shows the unreachable card with `Database unreachable. Start it with pnpm db:up.`, and no answer or an unexpected one `Could not reach the server`, both with `Retry`.
- A dead link shows `This invitation link no longer works. Ask a manager for a new one.` in the card, without the form.
- Focus starts on `Name`; Enter submits. While the request runs, the button reads `Creating account…` and is disabled.
- `201` opens `/`, signed in as the new account, replacing the invitation screen in the history. A `400` shows its message under the field it names and moves the focus to it; a `410` shows the screen of a dead link; a `503` or no answer shows its message under the form, keeps the fields and moves the focus to the button. Each message is announced to screen readers.

| Route                              | Answer                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/invitation`        | With `{ "token" }`: `200` with `{ email, role }` for a pending invitation.                                                                                                                  |
| `POST /api/auth/invitation/accept` | With `{ "token", "name", "password" }`: `201` with the account (`id`, `email`, `name`, `role`) and the session cookie. `400` with `{ "error", "field": "name" \| "password" }`, name first. |

Both work without a session. A dead link (an unknown or malformed token, or one used, replaced, revoked or expired, or an email that got an account since) answers both `410` with `{ "error": "This invitation link no longer works. Ask a manager for a new one." }`, checked before the fields. Accepting creates the account with the invitation's email and role, records its last sign-in time, deletes the session the browser already had, opens a new one, and marks the invitation used; it does not clear the [failed sign-ins](#failed-sign-ins) of the email. Two accepts of one token at the same time create one account, and the other answers `410`; an accept racing a revoke or a new link either succeeds whole or answers `410`.

## Deactivating an account

A manager deactivates the account of someone who left, and reactivates it if they come back. Accounts are never deleted: a deactivated account keeps its name on everything it did, and the invitations it created keep working and still show who invited.

- **Deactivate**: choosing `Deactivate` in a row's menu opens the dialog `Deactivate <name>?` (a long name wraps in the title), with the text `They are signed out at once.` and the buttons `Cancel` and `Deactivate`. While the request runs, the dialog stays open (Escape and `Cancel` do nothing) and its button reads `Deactivating…` and is disabled. Once the API answers, the dialog closes.
- **Reactivate**: choosing `Reactivate` sends the change at once, without a dialog. While it runs, the row's actions button keeps its size and place, is disabled, and reads `Reactivating…` (its accessible name and tooltip).
- **After the answer**: on `200`, the row shows its new status (`Active` or `Deactivated`) at once, from the answer, and moves to its sorted place (active accounts first) at the next refresh; a list that was asked for before the answer does not bring the old status back. A refusal or a failure shows its message on the same line under the row as a role change, announced politely: the API's message on a `409` or a `400` (`You cannot deactivate yourself`, `The team needs at least one active manager`…), `Database unreachable. Start it with pnpm db:up.` on a `503`, and `Could not reach the server` on a `404`, a network error or any other answer without a message. Like the role-change line, it stays across auto refreshes and clears when any action on the page starts or succeeds. A `403` replaces the table with `Only managers can manage the team.`, as on the list; a `401` opens the [sign-in screen](#the-sign-in-screen).
- **Focus**: when the menu or the dialog closes, the focus goes back to the row's actions button; it stays there after a reactivation.

Deactivating an account, in one transaction:

- sets it inactive, so it cannot sign in (`POST /api/auth/sign-in` answers `401` `Wrong email or password`, as for a wrong password);
- deletes all its sessions, so its next request is not signed in;
- marks its unused password reset links as used, so they never work again, even after a reactivation.

It deletes nothing else. If any step fails, the answer is `503` and nothing changes. Reactivating opens no session: the person signs in again with their password. Inviting the email of a deactivated account is refused as for any existing account: a person who comes back is reactivated.

### The status route

```bash
curl -i -b cookies -X PATCH http://127.0.0.1:4317/api/team/accounts/4 \
  -H 'content-type: application/json' -d '{"active":false}'
```

`PATCH /api/team/accounts/<id>` with `{ "active": false }` or `{ "active": true }` answers `200` with the account in the shape of one row of `GET /api/team/accounts` (`id`, `name`, `email`, `role`, `active`, `lastSignInAt`, `you`), with no envelope. A change that changes nothing (deactivating a deactivated account, reactivating an active one) answers `200` with the account unchanged, and deletes no session.

| Answer | When                                                                                                                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `404`  | `<id>` is not a positive whole number without leading zeros (`abc`, `007`, `0`, `-1`, `1.5`), or no account has it: `{ "error": "Not found" }`.                                                                                                                                      |
| `400`  | The body has both `role` and `active`: `{ "error": "Change the role or the status, not both" }`. It has neither, or is not a JSON object: `{ "error": "Send role or active" }`. `active` is not `true` or `false`: `{ "error": "Active must be true or false", "field": "active" }`. |
| `409`  | Deactivating yourself: `{ "error": "You cannot deactivate yourself" }`. Deactivating the last active manager (an account with role `manager` that is active): `{ "error": "The team needs at least one active manager" }`.                                                           |

Unknown fields are ignored. When several answers apply, the first wins: the chain of the [team routes](#team-routes) (`413`, `415`, `401` or `503`, `403`), then `404`, then `400`, then `409` yourself, then `409` last active manager. Reactivating yourself changes nothing and answers `200`.

Every change of an account's status runs in one transaction that locks the active managers, as a role change does, and reads the requester again: a requester deactivated meanwhile gets `401` `{ "error": "Not signed in" }`, one made dev meanwhile `403` `{ "error": "Managers only" }`. So two managers deactivating each other, or a demotion and a deactivation of the other manager at the same time, leave one active manager. Since the requester is an active manager and cannot deactivate themselves, the last-manager `409` stays as a guard inside that transaction.

## Reset links

A member who forgot their password gets a **reset link** from a manager: `<origin>/reset/<token>`, valid 24 hours, where `<origin>` is the origin the manager's browser uses. There is no email: the manager hands the link over.

### Creating a link

`Reset password link` in the actions menu of another active account's row creates one at once, with no confirmation: nothing changes for the account until the link is used. A manager cannot reset their own password from the Team page (another manager does it), and a deactivated row has no such action.

While the request runs, the row's actions button is disabled and busy. The link then shows on a line under the row: the link in a read-only field (its text selected on focus), `Valid for 24 hours`, `Copy link` (with a copy icon, and the focus) and `Done`. `Copy link` reads `Copied` for 2 seconds, or `Could not copy` for 4 seconds with the link left selected so it can be copied by hand; both are announced. The line stays through the page's refreshes until `Done`, which gives the focus back to the row's actions button. It also closes when the row becomes deactivated, whether this manager deactivated it or a refresh shows it deactivated; a later reactivation does not bring it back. The link is shown once and cannot be shown again: a manager who lost it creates a new one, and **a new link replaces the previous one**, from the Team page or the command line alike.

A failure answers as a [role change](#changing-a-role) does. It shows its message on the row's one message line, the same line as role and status changes: the API's message on a `409`, `Database unreachable. Start it with pnpm db:up.` on a `503`, and `Could not reach the server` on a `404`, a network error or any other answer without a message. The line is announced politely without moving the focus. It stays across auto refreshes, and it clears when any action on the page starts or succeeds. With several actions running, it shows the failure of the last action started. A `403` replaces the table with `Only managers can manage the team.`, as a `403` on the list does. Success or failure, the focus goes back to the row's actions button, then moves to `Copy link` when the link line opens.

`POST /api/team/accounts/<id>/reset-link`, with no body (any JSON body is ignored), answers `201` with `{ "token": "<token>", "expiresAt": "<ISO 8601>" }`; the browser builds the link from its own origin. When several answers apply, the first wins: the chain of the [team routes](#team-routes), then `404` `{ "error": "Not found" }` for an `<id>` that is not the decimal id of an existing account, then `409` `{ "error": "You cannot reset your own password here" }` for the requester's own id, then `409` `{ "error": "This account is deactivated" }`.

### On the server

`pnpm account:reset-link <email> --origin <url>` prints a reset link for that account on stdout, alone, as the Team page creates it, so a team whose only manager forgot their password gets back in. `--origin <url>` (or `--origin=<url>`) is required; only its origin is kept, so a trailing `/` or a path is dropped. The email is normalised as at sign-in (trimmed, lower case). Errors go to stderr and exit with code 1, checked in this order:

1. A missing email or `--origin`, an extra argument, an unknown option, or an `--origin` that is not an `http:` or `https:` URL: `Usage: pnpm account:reset-link <email> --origin <url>`.
2. A database that does not answer: `Database unreachable. Start it with pnpm db:up.`
3. An unknown or deactivated email: `No active account with this email`.

### The reset screen

`/reset/<token>` opens without a session and without the sidebar, whether someone is signed in or not; it never opens the [sign-in screen](#the-sign-in-screen), and a `401` from `GET /api/auth/me` there is ignored. It reuses the card of the sign-in screen: the logo, the title `Choose a new password`, the account's email in muted text that cannot be edited, the field `New password` (filled by the browser as a new password, with the hint `At least 12 characters`) and the button `Save password`. Opened while signed in (any account), it also shows `You are signed in as <name>. Saving signs you out.`

- Focus starts on `New password`; Enter submits. The password is sent as typed, with no check in the browser. While the request runs, the button reads `Saving…` and is disabled; a second Enter sends nothing.
- Success replaces the password, closes every session of the account and the session the browser had (of any account), opens a new one for the account and opens `/`, replacing the reset screen in the history, so Back never shows the used link.
- A `400` shows the API's message under the button, marks the field invalid and keeps the focus on it. A `503` shows `Database unreachable. Start it with pnpm db:up.`, a network error or any other answer `Could not reach the server`; both keep the password and move the focus to `Save password`. Each message is announced, and its place under the button is reserved (one line, two below 480 px wide).
- A `410` on save replaces the form with the message below.
- While the screen loads, a `503` or a network error shows the [unreachable screen](#the-unreachable-screen) with `Retry`.

A link that is used, replaced, expired or of a deactivated account, and `/reset` without a token or with a malformed one (a token is 43 base64url characters, and a trailing `/` after it counts as malformed), show the card with the logo and `This link no longer works. Ask a manager for a new one.`, with no button.

### Reset routes

Both routes work without a session, read `{ "token" }` (and `"password"`) from a JSON object, and read any other body as empty; unknown fields are ignored.

- `POST /api/auth/reset` with `{ "token" }` answers `200` with `{ "email" }` and uses nothing.
- `POST /api/auth/reset/save` with `{ "token", "password" }` answers `200` with the account (`id`, `email`, `name`, `role`), sets the session cookie as a sign-in does, and records the account's last sign-in time.

A token that is missing, not a string, unknown, used, replaced, expired, or of a deactivated account answers `410` with `{ "error": "This link no longer works. Ask a manager for a new one." }` on both routes, checked before the password. Then a password that breaks the [first manager's rules](#the-first-manager) answers `400` with `{ "error": "<message>", "field": "password" }` (`Password is required` when it is missing). The new password may equal the current one. A reset does not clear the [failed sign-in count](#failed-sign-ins). Of two saves at once with one token, one wins and the other answers `410`. While the database is unreachable, both answer `503`.

### How a link is stored

A reset link is a row of the account tokens, kind `reset`: the token is 32 random bytes, base64url in the link, and only its hex SHA-256 is stored. The row holds the account, `created_by` the manager (empty from the command line), the creation time and the expiry; its email and role stay empty. A token works once. It is expired once 24 hours or more have passed since its creation. Creating a link deletes the account's previous unused, unexpired reset token in the same transaction. Used and expired rows are kept, with their used time. [Deactivating an account](#deactivating-an-account) marks its unused reset tokens as used, so a link made before a deactivation never works again, even after a reactivation. A link outlives its creator being made dev or deactivated.

## The demo manager

`pnpm demo` creates the manager `demo@example.com` and prints its password when it starts. `pnpm shot` and `pnpm shift` sign in with it before they load a page.
