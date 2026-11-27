# Accounts

Who can use a FactoryDeck instance. One instance serves one organisation: there is no organisation in the data, and every account sees every project.

## Roles

| Role      | Who                                                 |
| --------- | --------------------------------------------------- |
| `manager` | Runs the instance. The first account is always one. |
| `dev`     | A member of the team.                               |

Accounts do not restrict the pages or the API yet: every route but the setup ones answers as before. An account has an email, a name, a password, a role, whether it is active, its creation time and its last sign-in time.

- **Email**: trimmed and lowercased, then stored that way: at most 254 characters, with one `@` that has text on both sides. Two accounts cannot share an email, so `Ada@Example.test` and `ada@example.test` are the same one.
- **Name**: trimmed, 1 to 80 characters.
- **Password**: 12 to 200 characters, kept as typed (spaces included). FactoryDeck stores only a salted `scrypt` hash of it, and never logs it.

## The first manager

A new instance has no account. While it has none, each start of the server creates a **setup code** and writes it to the server's log:

```
No account yet. Setup code: K7MQ2XRD
```

The code is 8 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0`, `O`, `1` or `I`). It lives in the server's memory only: a restart replaces it, and the first account makes it useless. Once an account exists, the server creates no code and logs nothing about it. Only someone who can read the server's log can set the instance up, so nobody who reaches a new instance first can take it.

The person who installs the instance sends the code with their email, name and password:

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
