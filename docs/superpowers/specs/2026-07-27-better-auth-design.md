# Better Auth with email and password — design

Date: 2026-07-27
Status: approved, not yet planned

## Problem

Sign-in is GitHub OAuth. It is built, tested and working — sessions in D1, a
CSRF-checked callback, and isolation proven through real cookies. The only
missing piece is a GitHub OAuth app, which is a three-field form.

The request is to replace it with email and password, because passwords feel
simpler.

**They are not simpler to build.** OAuth here is one redirect and a state
check, already written. Email and password means password hashing, reset
tokens, verification mail, login rate limiting, and an email provider with a
verified sending domain — which is strictly more setup than the OAuth app it
avoids. That was put to the author twice, with the specifics, and the decision
stands. It is recorded here so the trade is visible later rather than
rediscovered.

What the change does buy: anyone can sign up without a GitHub account, and a
maintained library takes over the parts of auth most likely to be got wrong.

## Scope

Replace hand-rolled GitHub OAuth with Better Auth: email and password as the
primary method, with GitHub kept as an optional second one.

**Out of scope:** social providers other than GitHub, two-factor, organisations
and teams, passkeys, magic links, rate limiting beyond whatever Better Auth
provides by default, and choosing an email provider.

### Decisions taken before this spec

- **Better Auth**, using its native D1 support — added in 1.5, February 2026 —
  so no ORM or adapter is needed.
- **Email and password with verification required**, and a reset flow.
- **Domain tables repoint at Better Auth's `user` table.** The existing `users`
  and `sessions` tables are dropped.
- **GitHub sign-in survives as a second method** — amended after the spike, at
  the author's request. The hand-rolled `worker/github.js` and
  `worker/routes/auth.js` are still deleted; Better Auth's own social provider
  replaces them, which is roughly sixty lines of OAuth we no longer maintain.
  It stays optional: without credentials the button is not rendered at all.
- **Email sending is a seam**, with a recording stub. Cloudflare Email Service
  can reach arbitrary recipients, but only on the Workers Paid plan and after
  onboarding a sending domain; Resend's free tier can without a paid plan. That
  choice is deferred rather than guessed.

### Success criteria

- Someone with no GitHub account can sign up, verify, and capture a card.
- An unverified account cannot write anything.
- Two really-signed-up users cannot see each other's data.

## Timing

**There is no production data.** Nothing is deployed. The only rows anywhere
are the seeded dev user and local test writes.

That makes this migration nearly free today and expensive in a week. SQLite
cannot alter a foreign key in place, so repointing four tables means rebuilding
them; with no data, rebuilding is a drop and a create. After launch the same
change is a copy, a backfill and a careful cutover.

Doing it now is worth doing deliberately rather than by luck.

## Schema

Better Auth's four tables — `user`, `session`, `account`, `verification` — are
captured from its own DDL and committed as `migrations/0004_better_auth.sql`.

They are committed rather than applied at runtime because migrations in this
repo are files that `wrangler d1 migrations apply` runs. A library reaching
into the schema on boot would put the database outside that system, and the
next person would have no single place to read what the schema is.

Then `migrations/0005_repoint_identity.sql`:

- drops `sessions` and `users`
- drops and recreates `cards`, `progress`, `reviews` and `enrollments` with
  every column and index unchanged, and the foreign key repointed from
  `users(id)` to `user(id)`

`ON DELETE CASCADE` is preserved, so Better Auth deleting a user still removes
their cards, and `DELETE /api/me` keeps working untouched.

**This migration is destructive.** That is acceptable only because nothing real
exists yet, and the spec says so plainly so nobody copies the pattern later.

### Deleted

`worker/github.js`, `worker/routes/auth.js`, `worker/crypto.js`, and the
session and GitHub-user queries in `worker/db.js`.

## Mounting, and the seam for the third time

```js
export function createAuth(env) {
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    emailVerification: { sendOnSignUp: true, sendVerificationEmail: … },
    trustedOrigins: [env.APP_URL]
  });
}

export async function getUser(request, env) {
  const res = await createAuth(env).api.getSession({ headers: request.headers });
  return res?.user ?? null;
}
```

The instance is built per request. `env` exists only inside `fetch`, and one
isolate serving two environments from a cached instance is a bug waiting for a
staging deploy.

**`getUser` is being rewritten a third time** — seeded row, then session
cookie, now Better Auth — and every route above it is untouched again. Three
different auth systems have now passed through one function body. That is the
whole argument for the seam, and it is recorded here because the next tempting
change will also want to reach past it.

`worker/index.js` gains one branch before its exact-match table:

```js
if (url.pathname.startsWith('/api/auth/')) {
  return createAuth(env).handler(request);
}
```

Better Auth owns that prefix entirely: sign-up, sign-in, sign-out, verify,
reset.

### Verification is enforced in one place

```js
if (!user && !isPublic) return error('not signed in', 401);
if (user && !user.emailVerified && !isPublic) return error('email not verified', 403);
```

401 and 403 mean different things here — *who are you* against *I know who you
are and you may not* — and the frontend needs to tell them apart to show "check
your inbox" instead of a sign-in form.

`/api/me` stays public and returns `emailVerified`, so the frontend reads the
state directly rather than inferring it from a status code.

### Configuration

| name | where | notes |
|---|---|---|
| `BETTER_AUTH_SECRET` | `wrangler secret put`, and `.dev.vars` locally | signs and encrypts sessions; a random 32-byte value |
| `APP_URL` | `wrangler.jsonc` vars | already present; becomes `baseURL` and the only trusted origin |
| `GITHUB_CLIENT_ID` | `.dev.vars` / `wrangler secret put` | optional; absent means no GitHub button |
| `GITHUB_CLIENT_SECRET` | `.dev.vars` / `wrangler secret put` | optional, and required only alongside the id |

### GitHub as a second method

`socialProviders.github` is configured **only when both variables are present**.
A half-configured provider is worse than none: Better Auth would advertise a
route that fails at the redirect.

`/api/me` reports `providers: { github: boolean }`, so the frontend renders the
button only when it can work. A fresh clone shows email and password alone,
with nothing visibly broken — a button that 500s reads as a bug in the app
rather than as missing configuration.

**Accounts are linked when the email matches**, with GitHub trusted. GitHub
verifies its addresses, so this is safe, and it is what people expect. Without
it, signing up with a password and later using GitHub produces a second empty
account, and the person concludes the app lost a year of their cards.

The secret is not optional and has no safe default. Better Auth will refuse to
start without it, which is the correct behaviour — a session secret that falls
back to a constant is worse than one that is missing.

## Email

`worker/email.js` is one function:

```js
export async function sendEmail(env, { to, subject, text }) { … }
```

The stub logs and records. Swapping in a real provider touches this file alone.

**The stub is also how the tests read verification tokens.** Better Auth hands
the send hook a link; a recording stub lets a test pull the real token out and
complete a genuine verification, which is a far better test than reaching into
the database and setting `emailVerified` by hand.

## Frontend

**Better Auth is a server dependency only.** The browser talks to `/api/auth/*`
with plain `fetch` — `sign-up/email`, `sign-in/email`, `forget-password`,
`reset-password`. No client SDK, so the bundle stays around its current 27 kB
and the project keeps exactly one runtime dependency.

`src/auth-view.js` renders sign-in, sign-up and forgot-password.

Four states now, where there were three:

| State | Shows |
|---|---|
| signed out | the curriculum, plus sign-in and sign-up |
| signed in, unverified | "check your inbox", with a resend button |
| verified, not enrolled | `#paths` |
| verified, enrolled | `#today` |

The unverified state needs its own screen rather than an error message. The
person has an account and simply cannot write yet; showing them a sign-in form
would be actively wrong.

`src/api.js` gains an `unverified` flag beside `unauthorized`, set on 403.
**Neither is retryable**: both drop the outbox entry rather than queueing writes
that can never land, the same rule already established for 401.

## Testing

**44 tests are deleted**: `crypto.test.js` (13), `github.test.js` (7),
`sessions-db.test.js` (11) and `auth.test.js` (13). They are replaced by
trusting a maintained library. That is the real cost of this change and it
belongs in the open.

What replaces them is smaller and different in kind. We do not test Better
Auth; we test our integration and the guarantees that are ours:

- signing up creates a user and puts a verification mail in the stub
- an unverified user gets 403 on a protected route and cannot write
- taking the token out of the stubbed mail and verifying then allows writes —
  a real end-to-end verification rather than a database poke
- a wrong password fails, and signing out invalidates the session
- **two really-signed-up users cannot read, grade or delete each other's data**
  — the isolation suite rewritten to go through actual sign-up
- `DELETE /api/me` removes that user's rows and nobody else's

DOM tests gain the unverified state and a sign-up form posting to the right
endpoint.

## The risk

Better Auth must run inside `workerd` under the Vitest pool, against
Miniflare's D1. Native D1 support is four months old, and "works on Workers" is
not the same claim as "works inside the Workers test pool". If it does not
work, every worker test in this project loses the ability to authenticate.

**So the first task is a spike**: install it, stand up the tables, sign one user
up inside a worker test, and assert a session comes back. Nothing else is built
until that passes, and **nothing is deleted** until it passes. If it fails
there, we stop and reconsider rather than forcing it — with 44 working tests
still in place.

## Build order

1. **Spike.** Better Auth signs a user up inside a worker test against
   Miniflare D1. Nothing deleted yet.
2. `migrations/0004_better_auth.sql`, generated and committed.
3. `worker/email.js` and its recording stub.
4. `createAuth`, the `/api/auth/` branch, and `getUser` rewritten. The old auth
   still present but unreachable.
5. `migrations/0005_repoint_identity.sql`, and the deletions.
6. Worker tests rewritten: verification, isolation through real sign-up,
   account deletion.
7. `src/auth-view.js`, the four-state boot, and the 403 handling.
8. DOM tests for the new states.
9. README and `.dev.vars.example`.

Step 1 is a gate, not a formality. Step 5 is the destructive one and is
deliberately after the new path already works.
