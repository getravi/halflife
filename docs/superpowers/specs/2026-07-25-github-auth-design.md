# Hosted platform, sub-project 2: GitHub auth — design

Date: 2026-07-25
Status: approved, not yet planned

## Problem

Sub-project 1 shipped a Worker, a D1 schema and a frontend where every query is
already scoped by `user_id`. What it does not have is any way to tell one
person from another. `worker/auth.js` reads:

```js
export async function getUser(request, env) {
  return env.DB.prepare('SELECT * FROM users WHERE id = ?')
               .bind(env.DEV_USER_ID).first();
}
```

Every request resolves to the same seeded row, regardless of who sent it. That
is fine on localhost and unacceptable deployed: anyone who found the URL would
have full read and write access to that account, including a working
`DELETE /api/me`.

This spec replaces that function body and adds the routes behind it. Nothing
else in the Worker moves, which is what the seam was for.

## Scope

Sub-project 2 of three:

1. **Foundation** — shipped. Workers, D1, content as data with stable ids, a
   multi-tenant schema, one seeded user.
2. **Auth** (this spec) — GitHub OAuth, sessions, real accounts, signed-out
   browsing, and a path picker.
3. **Path catalogue** — a second authored path, and whatever browsing and
   switching that turns out to need.

The path **picker** lands here rather than in sub-project 3, by explicit
choice. It stays a list: catalogue, enrol, go. The richer browsing and
switching design waits for a second path to exist, because it cannot be
designed honestly against a list of one.

**Out of scope:** email, profiles, avatars beyond the header, teams or sharing,
any second identity provider, session management UI beyond a single sign-out,
rate limiting.

### Decisions taken before this spec

- **GitHub OAuth only, public signup.** The audience are engineers following an
  ML roadmap; they have GitHub accounts. It is the only option that is both
  open to strangers and genuinely lightweight — no passwords, no reset flow, no
  verification mail, near-zero bot signups.
- **Sessions in D1**, not a stateless signed cookie. Revocation is the reason:
  a stolen stateless cookie stays valid until it expires and cannot be killed.
  `getUser` already reads D1 on every request, so the lookup is not new cost.
- **Signed-out visitors browse the path.** Paths are already public static
  assets and the curriculum is the thing worth showing.
- **Two GitHub OAuth apps**, dev and production. GitHub allows one callback URL
  per app, and the flow most likely to break is the one you never exercise
  before shipping.

### Success criteria

- Two different GitHub accounts sign in and provably cannot see, modify or
  delete each other's data — asserted through real sessions, not seeded ids.
- Signing out invalidates the cookie immediately, not on expiry.
- A signed-out visitor can read the whole curriculum and write nothing.

## Sessions

New migration, `0003_sessions.sql`:

```sql
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,   -- SHA-256 of the cookie token, never the token
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);
```

**The row stores a hash of the token, not the token.** A leaked database
otherwise replays directly as live sessions — the same reason passwords are not
stored in the clear. The cookie holds 32 bytes from `crypto.getRandomValues`,
base64url; the table holds its SHA-256.

Deletion cascades from `users`, so `DELETE /api/me` already signs out every
device that account ever used. Expired rows are swept opportunistically on
sign-in: it is a delete of rows nobody can use, and it does not need a cron of
its own.

### The cookie

`flp_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 30 days, and
`Secure` whenever the request arrived over https.

`Lax` rather than `Strict` is required, not preference. A `Strict` cookie is
not sent on the top-level redirect back from GitHub, so sign-in would appear to
succeed and then drop the user on the next request — a failure that looks like
a bug in the session store rather than in the cookie policy.

## The OAuth flow

Three new routes. `worker/index.js` gains a `public` flag on route entries so
these are reachable without a session.

```
GET  /api/auth/github    → 302 to GitHub, state cookie set
GET  /api/auth/callback  → verify state, exchange code, upsert user, 302 to /
POST /api/auth/signout   → delete the session row, clear the cookie
```

**`/api/auth/github`** generates 32 random bytes as `state`, sets them in a
short-lived (10 minute) `HttpOnly` cookie, and redirects to GitHub's authorize
endpoint.

**`/api/auth/callback`** rejects the request unless the `state` parameter
matches the cookie, and deletes the cookie either way. Missing parameter,
missing cookie and mismatch are all rejections. Without this check anyone can
hand you a prepared callback URL that signs you into *their* account, and every
card you then write goes to them.

It then exchanges the code for an access token, fetches the GitHub profile,
upserts `users` by `github_id`, creates a session, and redirects to `/`.

**No OAuth scope is requested.** `id`, `login` and `avatar_url` are public
profile fields. Asking for nothing gives both the smallest consent screen and
the smallest blast radius.

**The GitHub access token is used once to fetch the profile and then
discarded.** It is never stored and never logged.

### The seam

```js
export async function getUser(request, env) {
  const token = readCookie(request, 'flp_session');
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?`
  ).bind(await sha256(token), Date.now()).first();

  return row ?? null;
}
```

That is the whole change to existing code. Every route already begins with
`getUser` and scopes its queries by `user.id`; `index.js` already answers 401
on a null user. `DEV_USER_ID` is removed from `wrangler.jsonc` so nothing can
reach the seeded row.

**The seeded dev user row stays.** Deleting it would cascade away any data
captured locally during sub-project 1, for no benefit — with the var gone,
nothing can authenticate as it.

## Frontend

`GET /api/me` becomes public and answers `{ user: null, enrollments: [] }` when
signed out, rather than 401. One shape, so the frontend branches on state
rather than treating an error as a state.

Because it is public, its handler is the one place that receives `user = null`
and must not dereference it. Every other route stays behind the 401 in
`index.js` and can keep assuming a user exists — the exemption is exactly one
handler wide, deliberately.

`boot()` resolves three cases:

| state | lands on |
|---|---|
| signed out | the path, read-only |
| signed in, no enrolment | `#paths` |
| signed in, enrolled | `#today` |

**Signed out**, the curriculum renders in full. The header carries **Sign in
with GitHub**. Step checkboxes render `disabled`, the sidebar still opens
because the resources are the point, and Today is replaced by a short prompt.
No write leaves the browser.

**Signed in**, the header carries the avatar, the login and **Sign out**.

**The picker** is a new `#paths` view listing the catalogue: a title and an
**Enrol** button that posts `{ pathId, startedOn }` with `startedOn` from
`localDate(new Date())` — the local calendar day, because `toISOString` returns
the UTC day and would shift the plan start for anyone west of UTC.

New modules: `src/auth.js` (session state, header, sign-in and out) and
`src/paths-view.js` (the picker). `src/main.js` gains the branch.

## Failure handling

**A 401 is not a retryable failure.** The outbox currently queues any failed
mutation and retries forever. If a session expires mid-session, every tick
queues a write that can never succeed and the user watches an offline banner
that will never clear.

So on 401 the outbox **drops** the entry, `API.online` stays true, and the
header flips to signed-out with a prompt to sign in again. Conflating "no
network" with "no longer you" is how a card is lost into a queue nobody drains.

Everything else is unchanged: network failures still queue and flush, path
fetches still fall back to the Cache API, and D1 write failures still return
500 and retry.

## Config

| name | where | value |
|---|---|---|
| `GITHUB_CLIENT_ID` | `wrangler.jsonc` vars / `.dev.vars` | per environment |
| `GITHUB_CLIENT_SECRET` | `wrangler secret put` / `.dev.vars` | per environment |
| `APP_URL` | `wrangler.jsonc` vars | origin used to build `redirect_uri`, and to redirect back to after sign-in |

`.dev.vars` is git-ignored. Two GitHub OAuth apps: dev with callback
`http://localhost:8787/api/auth/callback`, production with the deployed URL.

GitHub calls live in `worker/github.js` — `exchangeCode()` and `fetchUser()` —
so the routes are testable without reaching the network.

## Testing

On top of the existing 66:

- **Session resolution** — no cookie resolves to null; an expired session
  resolves to null; a valid one resolves to its user.
- **CSRF** — the callback rejects a mismatched state, a missing state
  parameter, and a missing state cookie.
- **Sign-out** — deletes the row, and the same cookie afterwards resolves to
  null. This is the test that distinguishes a session table from a signed
  cookie; with a stateless cookie it cannot pass.
- **Account deletion** — removes that user's sessions and nobody else's.
- **Public versus protected** — a protected route 401s with no session, while
  `/api/me` answers `user: null`.
- **Isolation through real sessions** — two users sign in, and neither can
  read, grade or delete the other's cards. The sub-project 1 isolation tests
  proved this against seeded ids; this proves it through the path a real
  request actually takes.

## Build order

1. `0003_sessions.sql`, plus `sha256` and cookie helpers.
2. `worker/github.js` with `exchangeCode()` and `fetchUser()`.
3. The three auth routes and the `public` route flag.
4. `getUser` replaced; `DEV_USER_ID` removed. Every route except the auth
   routes and `/api/me` requires a real session from this point.
5. Isolation re-run through real sessions.
6. `src/auth.js`, the header, and the signed-out read-only branch.
7. `src/paths-view.js` and the boot branch.
8. The 401-drops-the-outbox change.
9. Two GitHub apps, secrets, deploy.

Step 4 is the point of no return: until it lands, the app authenticates nobody;
after it, every route requires a real session. It is deliberately a single
step, because a half-applied auth change is worse than either state.
