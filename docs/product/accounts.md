# Accounts

Who can use a FactoryDeck instance. One instance serves one organisation: there is no organisation in the data, and every account sees every project.

## Roles

| Role      | Who                                                 |
| --------- | --------------------------------------------------- |
| `manager` | Runs the instance. The first account is always one. |
| `dev`     | A member of the team.                               |

Every API route needs a signed-in account, except the few listed under [Without a session](#without-a-session); the roles change nothing there: a dev and a manager read every route alike. While the instance has no account, the pages open the [first-manager screen](#the-first-manager-screen). An account has an email, a name, a password, a role, whether it is active, its creation time and its last sign-in time.

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
- While the state is not known yet, the app shows nothing and calls no other route; while `setup` is `true`, the app calls only `/api/auth/*`. If the state cannot be read (the database or the server does not answer), the app opens as usual and each page shows its own unreachable message.
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

## How long a session lasts

A session expires **30 days after its last use**: once 30 days or more have passed since its stored last use. Each request with it moves its last use (written at most once a minute) and sends the cookie again with a fresh `Max-Age` of 30 days, so a session used every day never ends. An expired session is deleted the next time it is sent, and the request is answered as not signed in. A session whose account is deactivated is refused and deleted the same way.

## Without a session

Every route under `/api/` answers `401` with `{ "error": "Not signed in" }` without a valid session, unknown routes included, except:

- `GET /api/health`;
- `GET /api/auth/state` and `POST /api/auth/setup`;
- `POST /api/auth/sign-in` and `POST /api/auth/sign-out`.

The built UI (its HTML, scripts and styles) is served without a session. Until it has a sign-in screen, its pages show their usual error state when the API answers `401`. While the database is unreachable, a route that needs a session answers `503` with the usual unreachable body. No setting turns authentication off.

Every `POST`, `PUT`, `PATCH` and `DELETE` under `/api/`, open routes included, goes through two body checks before the session is checked, in this order:

1. A body larger than 1 MB (1,048,576 bytes) answers `413` with `{ "error": "Body too large" }`, without being read further.
2. A body that is not `application/json` (any letter case, with or without a `charset`) answers `415` with `{ "error": "JSON body expected" }`, so a form on another site cannot send one with the cookie.

A request with no body passes both. Only then does a missing session answer `401`.

## The demo manager

`pnpm demo` creates the manager `demo@example.com` and prints its password when it starts. `pnpm shot` and `pnpm shift` sign in with it before they load a page.
