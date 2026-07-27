# Better Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-rolled GitHub OAuth with Better Auth — email and password as the primary method, GitHub kept as an optional second one — so anyone can sign up without a GitHub account.

**Architecture:** Better Auth owns `/api/auth/*` and four tables of its own, using native D1. The four domain tables repoint their foreign key at its `user` table. `getUser` is rewritten a third time and nothing above it moves.

**Tech Stack:** `better-auth` (the project's first runtime dependency), Cloudflare Workers, D1, Vitest with `@cloudflare/vitest-pool-workers`, happy-dom, Vite 8, pnpm, Node 24.

## Global Constraints

- **Task 1 is a gate.** Nothing is deleted and nothing else is built until Better Auth provably signs a user up inside the Workers test pool against Miniflare D1.
- **`database: env.DB` directly.** Native D1, no adapter, no ORM. D1 has no interactive transactions; Better Auth uses `batch()`.
- **`createAuth(env)` is built per request.** `env` exists only inside `fetch`; a cached instance across environments is a staging-deploy bug.
- **Verification is required to write.** `401` means *who are you*; `403` means *I know who you are and you may not*. They are not interchangeable.
- **`/api/me` stays public** and returns `emailVerified`.
- **Better Auth is a server dependency only.** The browser uses plain `fetch` against `/api/auth/*`. No client SDK.
- **Neither 401 nor 403 is retryable.** Both drop the outbox entry.
- **`BETTER_AUTH_SECRET` has no default.** Better Auth refusing to start without it is correct.
- **Migration 0005 is destructive** and acceptable only because nothing is deployed and no real rows exist.
- **GitHub is configured only when both credentials are present.** A half-configured provider advertises a route that fails at the redirect.
- **`/api/me` reports `providers.github`** so the button is hidden rather than broken on a fresh clone.
- **Accounts link on matching email, with GitHub trusted.** Otherwise a password signup and a later GitHub sign-in produce two accounts and the person concludes their cards were lost.
- Package manager is pnpm. Node >= 24.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `migrations/0004_better_auth.sql` | Better Auth's four tables, captured as static SQL. |
| `migrations/0005_repoint_identity.sql` | Drops `users`/`sessions`, rebuilds the four domain tables against `user(id)`. |
| `worker/email.js` | `sendEmail(env, {to, subject, text})` — the seam, plus a recording stub. |
| `src/auth-view.js` | Sign-in, sign-up, forgot-password, and the unverified screen. |
| `test/worker/betterauth-spike.test.js` | The gate. Deleted once real tests replace it. |
| `test/worker/accounts.test.js` | Sign-up, verification, 403, sign-out. |

**Modified:** `worker/auth.js` (rewritten), `worker/index.js` (auth prefix, 403), `worker/db.js` (session and GitHub queries removed), `wrangler.jsonc`, `.dev.vars.example`, `src/api.js`, `src/main.js`, `index.html`, `style.css`, `README.md`, `test/worker/session-isolation.test.js`, the four route test files, `test/dom/harness.js`.

**Deleted:** `worker/github.js`, `worker/routes/auth.js`, `worker/crypto.js`, `test/worker/crypto.test.js`, `test/worker/github.test.js`, `test/worker/sessions-db.test.js`, `test/worker/auth.test.js`.

---

### Task 1: The spike — does it run in the test pool at all?

**Files:**
- Create: `test/worker/betterauth-spike.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: proof that `betterAuth({ database: env.DB })` can create its schema and sign a user up inside `workerd` under Miniflare.

**Nothing is deleted in this task.** All 224 existing tests stay green throughout.

- [ ] **Step 1: Install**

```bash
pnpm add better-auth
```

- [ ] **Step 2: Write the spike**

Create `test/worker/betterauth-spike.test.js`:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';

const config = {
  database: env.DB,
  secret: 'spike-secret-not-used-anywhere-else-0123456789',
  baseURL: 'https://x',
  emailAndPassword: { enabled: true, requireEmailVerification: false }
};

beforeAll(async () => {
  // Better Auth's own tables, created programmatically. Task 2 captures the
  // resulting SQL as a committed migration; this proves the schema can be
  // stood up inside the pool at all.
  const { runMigrations } = await getMigrations(config);
  await runMigrations();
});

describe('better auth inside the workers test pool', () => {
  it('creates its four tables', async () => {
    const { results } = await env.DB
      .prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const names = results.map(r => r.name);
    for (const t of ['user', 'session', 'account', 'verification']) {
      expect(names, `missing table ${t}`).toContain(t);
    }
  });

  it('signs a user up and hands back a user with an id', async () => {
    const auth = betterAuth(config);
    const res = await auth.api.signUpEmail({
      body: { email: 'spike@example.com', password: 'correct-horse-battery', name: 'Spike' }
    });
    expect(res.user?.id).toBeTruthy();
    expect(res.user.email).toBe('spike@example.com');
  });

  it('signs that user in and resolves a session from the returned headers', async () => {
    const auth = betterAuth(config);
    await auth.api.signUpEmail({
      body: { email: 'two@example.com', password: 'correct-horse-battery', name: 'Two' }
    });

    const signIn = await auth.api.signInEmail({
      body: { email: 'two@example.com', password: 'correct-horse-battery' },
      asResponse: true
    });
    const cookie = signIn.headers.get('set-cookie');
    expect(cookie).toBeTruthy();

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookie.split(';')[0] })
    });
    expect(session?.user?.email).toBe('two@example.com');
  });

  it('rejects a wrong password', async () => {
    const auth = betterAuth(config);
    await auth.api.signUpEmail({
      body: { email: 'three@example.com', password: 'correct-horse-battery', name: 'Three' }
    });
    await expect(auth.api.signInEmail({
      body: { email: 'three@example.com', password: 'wrong' }
    })).rejects.toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the gate**

```bash
pnpm vitest run test/worker/betterauth-spike.test.js
```

Expected: PASS, 4 tests.

**If this fails, stop.** Do not proceed to any later task, and do not delete
anything. Report what failed — a missing Node built-in, a bundling error, an
unsupported crypto call — and reconsider the approach with all 224 existing
tests still in place. That is the entire reason this task exists.

- [ ] **Step 4: Confirm nothing else broke**

```bash
pnpm test
```

Expected: 224 previous plus 4 new = **228 passing**.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml test/worker/betterauth-spike.test.js
git commit -m "Spike: prove Better Auth runs in the Workers test pool

Native D1 support is four months old, and works-on-Workers is not the
same claim as works-inside-the-Workers-test-pool. If this had failed,
every worker test in the project would have lost the ability to
authenticate — so it was written before anything was deleted, with all
224 existing tests still green."
```

---

### Task 2: Capture the schema, and the email seam

**Files:**
- Create: `migrations/0004_better_auth.sql`, `worker/email.js`

**Interfaces:**
- Consumes: the working config from Task 1.
- Produces:
  - `migrations/0004_better_auth.sql` — Better Auth's tables as committed SQL.
  - `sendEmail(env, { to, subject, text }) -> Promise<{ ok: true }>`
  - `env.SENT_MAIL` — an array the stub pushes to, so tests can read what was sent.

- [ ] **Step 1: Understand why the schema is committed**

Migrations in this repo are files that `wrangler d1 migrations apply` runs. A
library creating tables at runtime would put the schema outside that system,
and the next person would have no single place to read what the schema is. So
Better Auth's DDL is captured once and committed.

- [ ] **Step 2: Dump the DDL from inside the pool**

The spike created the tables inside Miniflare's isolated storage, which
`wrangler` cannot see. Rather than trying to reach that file, print the DDL
from a temporary test and paste it into the migration.

Create `test/worker/dump-schema.test.js`:

```js
import { env } from 'cloudflare:test';
import { it, expect } from 'vitest';
import { getMigrations } from 'better-auth/db/migration';

it('prints Better Auth DDL for migrations/0004_better_auth.sql', async () => {
  const { runMigrations } = await getMigrations({
    database: env.DB,
    secret: 'dump-only-0123456789abcdefghijklmnop',
    baseURL: 'https://x',
    emailAndPassword: { enabled: true }
  });
  await runMigrations();

  const { results } = await env.DB.prepare(
    `SELECT sql FROM sqlite_master
      WHERE name IN ('user','session','account','verification') AND sql IS NOT NULL`
  ).all();

  // Fails on purpose: vitest prints the diff, which is the DDL.
  expect(results.map(r => r.sql.trim() + ';').join('\n\n')).toBe('PASTE-ME');
});
```

Run it, copy the "received" block out of the failure output, and write it into
`migrations/0004_better_auth.sql` beneath this header:

```sql
-- Generated from Better Auth. Do not hand-edit.
-- Regenerate with test/worker/dump-schema.test.js when better-auth changes.
```

Then delete the temporary test:

```bash
rm test/worker/dump-schema.test.js
```

Deliberately failing an assertion to read a value is a blunt instrument, but it
is deterministic and needs no second mechanism for talking to the database.

- [ ] **Step 3: Verify the migration applies cleanly**

```bash
pnpm db:migrate:local
pnpm wrangler d1 execute frontier-lab --local --json \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected: the list contains `account`, `session`, `user`, `verification`
alongside the existing tables.

- [ ] **Step 4: Write the email seam**

Create `worker/email.js`:

```js
/**
 * The only place that sends mail. Swapping in Cloudflare Email Service or
 * Resend later touches this file and nothing else.
 *
 * Cloudflare Email Service can reach arbitrary recipients, but only on the
 * Workers Paid plan and after onboarding a sending domain. Resend's free tier
 * can without a paid plan. That decision is deliberately deferred; until it is
 * made, this records rather than sends.
 */
export async function sendEmail(env, { to, subject, text }) {
  // env.SENT_MAIL is present in tests. In production it is undefined and this
  // logs instead — visible in `wrangler tail`, and impossible to mistake for
  // a working provider.
  if (env.SENT_MAIL) {
    env.SENT_MAIL.push({ to, subject, text });
    return { ok: true };
  }

  console.log(`[email:unsent] to=${to} subject=${subject}\n${text}`);
  return { ok: true };
}
```

- [ ] **Step 5: Commit**

```bash
git add migrations/0004_better_auth.sql worker/email.js
git commit -m "Commit Better Auth's schema and add the email seam

The schema is captured as a normal migration rather than created at
runtime, because migrations here are files wrangler applies and a library
reaching into the database on boot would put the schema outside the one
place anyone reads to learn what it is.

The email stub records rather than sends. That is not only scaffolding:
Better Auth hands the send hook a verification link, so a recording stub
lets a test pull the real token out and complete a genuine verification
instead of poking emailVerified in the database."
```

---

### Task 3: Mount Better Auth and rewrite the seam

**Files:**
- Modify: `worker/auth.js`, `worker/index.js`, `wrangler.jsonc`, `.dev.vars.example`

**Interfaces:**
- Consumes: `sendEmail` (Task 2).
- Produces:
  - `createAuth(env) -> BetterAuthInstance`
  - `getUser(request, env) -> Promise<user | null>` — same signature as before, third implementation
  - `/api/auth/*` handled entirely by Better Auth
  - `403` on a protected route for a signed-in but unverified user

The old GitHub routes still exist after this task but are unreachable. They are
deleted in Task 4, after the new path works.

- [ ] **Step 1: Rewrite `worker/auth.js`**

```js
/**
 * Session resolution. The only place that decides who is asking.
 *
 * This is the third implementation behind the same signature — a seeded row,
 * then a hand-rolled session cookie, now Better Auth — and no route above it
 * has changed for any of them. The next tempting change will also want to
 * reach past this seam; it should not.
 */
import { betterAuth } from 'better-auth';
import { sendEmail } from './email.js';

export function createAuth(env) {
  // Built per request. env exists only inside fetch, and one isolate serving
  // two environments from a cached instance is a staging-deploy bug.
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    trustedOrigins: [env.APP_URL],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(env, {
          to: user.email,
          subject: 'Verify your email',
          text: `Confirm your address to start tracking progress:\n\n${url}\n`
        });
      }
    }
  });
}

export async function getUser(request, env) {
  const res = await createAuth(env).api.getSession({ headers: request.headers });
  return res?.user ?? null;
}
```

- [ ] **Step 2: Mount the handler and add the 403 in `worker/index.js`**

Replace the import of the old auth routes:

```js
import { getUser, createAuth } from './auth.js';
```

Remove `import * as auth from './routes/auth.js';` and the three
`/api/auth/...` entries from `ROUTES`.

Inside `fetch`, immediately after the assets branch:

```js
    // Better Auth owns this prefix entirely: sign-up, sign-in, sign-out,
    // verify, reset.
    if (url.pathname.startsWith('/api/auth/')) {
      return createAuth(env).handler(request);
    }
```

and replace the guard:

```js
    const user = await getUser(request, env);
    if (!user && !match[3]) return error('not signed in', 401);
    // 401 is "who are you"; 403 is "I know who you are and you may not". The
    // frontend needs to tell them apart to show "check your inbox" rather than
    // a sign-in form.
    if (user && !user.emailVerified && !match[3]) {
      return error('email not verified', 403);
    }
```

- [ ] **Step 3: Update configuration**

In `wrangler.jsonc`, replace the `vars` block:

```jsonc
  "vars": {
    "APP_URL": "http://localhost:8787"
  },
```

`GITHUB_CLIENT_ID` is gone.

Rewrite `.dev.vars.example`:

```
BETTER_AUTH_SECRET=
```

And create your local `.dev.vars` with a real value:

```bash
node -e "console.log('BETTER_AUTH_SECRET=' + require('crypto').randomBytes(32).toString('base64url'))" > .dev.vars
```

- [ ] **Step 4: Check the Worker still boots**

```bash
pnpm build
pnpm dev:worker &
sleep 9
curl -s -o /dev/null -w 'me %{http_code}\n' localhost:8787/api/me
curl -s -o /dev/null -w 'protected %{http_code}\n' 'localhost:8787/api/cards?pathId=frontier-lab'
curl -s -o /dev/null -w 'auth prefix %{http_code}\n' localhost:8787/api/auth/session
pkill -f "wrangler dev"
```

Expected: `me 200`, `protected 401`, and the auth prefix answering something
other than 404 — Better Auth is handling it.

- [ ] **Step 5: Commit**

```bash
git add worker/auth.js worker/index.js wrangler.jsonc .dev.vars.example
git commit -m "Mount Better Auth and rewrite getUser a third time

Three auth systems have now passed through one function signature — a
seeded row, a hand-rolled session cookie, and now a library — and no
route above it has changed for any of them.

A signed-in but unverified user gets 403 rather than 401. Those mean
different things, and collapsing them would leave the frontend unable to
distinguish 'sign in' from 'check your inbox'."
```

---

### Task 4: Repoint identity, and delete the old world

**Files:**
- Create: `migrations/0005_repoint_identity.sql`
- Delete: `worker/github.js`, `worker/routes/auth.js`, `worker/crypto.js`, `test/worker/crypto.test.js`, `test/worker/github.test.js`, `test/worker/sessions-db.test.js`, `test/worker/auth.test.js`
- Modify: `worker/db.js`

**Interfaces:**
- Produces: `cards`, `progress`, `reviews` and `enrollments` referencing `user(id)`.

**This is the destructive task.** It lands after the new path already works.

- [ ] **Step 1: Write `migrations/0005_repoint_identity.sql`**

SQLite cannot alter a foreign key in place. With no data to preserve, the
honest form is a drop and a recreate — and the honesty matters, because a week
after launch this same change would need a copy, a backfill and a cutover.

```sql
-- Destructive by design. Acceptable only because nothing is deployed and the
-- only rows are a seeded dev user and local test writes. Do not copy this
-- pattern once real accounts exist.

DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS progress;
DROP TABLE IF EXISTS enrollments;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

CREATE TABLE enrollments (
  user_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  path_id    TEXT NOT NULL,
  started_on TEXT NOT NULL,
  PRIMARY KEY (user_id, path_id)
);

CREATE TABLE progress (
  user_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  path_id    TEXT NOT NULL,
  node_id    TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, path_id, node_id)
);

CREATE TABLE cards (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  path_id          TEXT NOT NULL,
  subtask_id       TEXT NOT NULL,
  prompt           TEXT NOT NULL,
  answer           TEXT NOT NULL,
  created_at       INTEGER NOT NULL,
  last_reviewed_at INTEGER,
  due_at           INTEGER NOT NULL,
  stability        REAL NOT NULL DEFAULT 0,
  reps             INTEGER NOT NULL DEFAULT 0,
  lapses           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE reviews (
  id         TEXT PRIMARY KEY,
  card_id    TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  ts         INTEGER NOT NULL,
  grade      TEXT NOT NULL CHECK (grade IN ('again','hard','good','easy')),
  latency_ms INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX cards_due    ON cards(user_id, path_id, due_at);
CREATE INDEX reviews_card ON reviews(card_id, ts);
```

- [ ] **Step 2: Remove the dead queries from `worker/db.js`**

Delete `createSession`, `findSessionUser`, `deleteSession`,
`deleteExpiredSessions` and `upsertGithubUser`. Better Auth owns sessions and
users now.

`deleteUser` stays — `DELETE /api/me` still needs it, and the cascade still
works because `user(id)` is what everything references.

Change its statement to name the new table:

```js
export async function deleteUser(env, userId) {
  // The cascades do the rest.
  await env.DB.prepare('DELETE FROM user WHERE id = ?').bind(userId).run();
}
```

- [ ] **Step 3: Delete the old files**

```bash
git rm worker/github.js worker/routes/auth.js worker/crypto.js \
       test/worker/crypto.test.js test/worker/github.test.js \
       test/worker/sessions-db.test.js test/worker/auth.test.js
```

That is 44 tests removed, replaced by trusting a maintained library. Task 5
adds the ones that prove our own guarantees.

- [ ] **Step 4: Apply and confirm the schema**

```bash
pnpm db:migrate:local
pnpm wrangler d1 execute frontier-lab --local --json \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected: `account`, `cards`, `enrollments`, `progress`, `reviews`, `session`,
`user`, `verification`. **No `users`, no `sessions`.**

- [ ] **Step 5: Confirm the foreign key actually points at the new table**

```bash
pnpm wrangler d1 execute frontier-lab --local --json \
  --command "SELECT sql FROM sqlite_master WHERE name='cards'" | grep -c 'REFERENCES user(id)'
```

Expected: `1`. A migration that ran but left the old reference would be
invisible until the first insert.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Repoint identity at Better Auth and delete the old world

SQLite cannot alter a foreign key in place, so with no data to preserve
the honest form is a drop and a recreate. That is only acceptable because
nothing is deployed — a week after launch the same change needs a copy, a
backfill and a cutover, and the migration says so at the top so nobody
copies the pattern.

Forty-four tests are deleted here: crypto, github, sessions-db and the
hand-rolled auth routes. They are replaced by trusting a maintained
library, which is the real cost of this change."
```

---

### Task 5: Rewrite the worker tests around real accounts

**Files:**
- Create: `test/worker/accounts.test.js`
- Modify: `test/helpers.js`, `test/worker/session-isolation.test.js`, `test/worker/progress.test.js`, `test/worker/cards.test.js`, `test/worker/reviews.test.js`, `test/worker/me.test.js`
- Delete: `test/worker/betterauth-spike.test.js`

**Interfaces:**
- Produces in `test/helpers.js`:
  - `signUp(email) -> Promise<string>` — signs a user up, verifies them using the token from the recorded mail, signs in, and returns a cookie header
  - `resetDb()` — truncates `user` (everything cascades)
  - `sentMail()` — the array the email stub pushed to

- [ ] **Step 1: Expose the mail recorder to tests**

In `vitest.config.js`, add a binding to the worker project's miniflare block:

```js
            miniflare: {
              d1Databases: ['DB'],
              bindings: {
                TEST_MIGRATIONS: migrations,
                BETTER_AUTH_SECRET: 'test-secret-0123456789abcdefghijklmnop',
                APP_URL: 'https://x',
                SENT_MAIL: []
              }
            }
```

- [ ] **Step 2: Rewrite `test/helpers.js`**

```js
import { env, SELF } from 'cloudflare:test';

/**
 * Truncating `user` is enough: cards, progress, reviews, enrollments, sessions
 * and accounts all cascade from it.
 */
export async function resetDb() {
  await env.DB.prepare('DELETE FROM user').run();
  env.SENT_MAIL.length = 0;
}

export function sentMail() {
  return env.SENT_MAIL;
}

/**
 * Bare rows in Better Auth's user table, for the tests that call db.js
 * directly and only need a valid foreign key — cards-db, export-db and the
 * original isolation suite. They do not need a session, so signing them up
 * through the routes would be slower and prove nothing extra.
 */
export async function seedUsers(...ids) {
  for (const id of ids) {
    await env.DB.prepare(
      `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
       VALUES (?, ?, ?, 1, 0, 0)`
    ).bind(id, id, `${id}@example.com`).run();
  }
}

/**
 * A real account: signed up, verified through the link Better Auth actually
 * generated, and signed in. Returns the cookie header to send with requests.
 *
 * Verifying through the recorded mail rather than by setting emailVerified in
 * the database means the test exercises the flow a person goes through.
 */
export async function signUp(email = 'a@example.com', password = 'correct-horse-battery') {
  const before = env.SENT_MAIL.length;

  await SELF.fetch('https://x/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, name: email })
  });

  const mail = env.SENT_MAIL[before];
  if (!mail) throw new Error(`no verification mail was sent to ${email}`);

  const url = mail.text.match(/https?:\/\/\S+/)[0];
  const verify = await SELF.fetch(url, { redirect: 'manual' });

  // Verification signs the user in, so the cookie comes back on that response.
  const cookie = verify.headers.get('set-cookie');
  if (cookie) return cookie.split(';')[0];

  const signIn = await SELF.fetch('https://x/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return signIn.headers.get('set-cookie').split(';')[0];
}
```

- [ ] **Step 3: Write `test/worker/accounts.test.js`**

```js
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, signUp, sentMail } from '../helpers.js';

const post = (path, body, cookie) => SELF.fetch(`https://x${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body)
});

describe('signing up', () => {
  beforeEach(resetDb);

  it('creates a user and sends exactly one verification mail', async () => {
    await post('/api/auth/sign-up/email',
      { email: 'new@example.com', password: 'correct-horse-battery', name: 'New' });

    const { results } = await env.DB
      .prepare('SELECT email FROM user').all();
    expect(results.map(r => r.email)).toEqual(['new@example.com']);
    expect(sentMail()).toHaveLength(1);
    expect(sentMail()[0].to).toBe('new@example.com');
  });

  it('will not let an unverified account write anything', async () => {
    await post('/api/auth/sign-up/email',
      { email: 'unv@example.com', password: 'correct-horse-battery', name: 'U' });

    const signIn = await post('/api/auth/sign-in/email',
      { email: 'unv@example.com', password: 'correct-horse-battery' });
    const cookie = signIn.headers.get('set-cookie')?.split(';')[0];

    if (!cookie) return;   // sign-in refused outright, which is also acceptable

    const res = await SELF.fetch('https://x/api/progress', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ pathId: 'frontier-lab', nodeId: 'n1', done: true })
    });
    expect(res.status).toBe(403);
  });

  it('lets a verified account write, using the link from the mail it actually sent', async () => {
    const cookie = await signUp('ok@example.com');

    const res = await SELF.fetch('https://x/api/progress', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ pathId: 'frontier-lab', nodeId: 'n1', done: true })
    });
    expect(res.status).toBe(200);
  });

  it('reports the signed-in user from /api/me', async () => {
    const cookie = await signUp('me@example.com');
    const body = await (await SELF.fetch('https://x/api/me', { headers: { cookie } })).json();
    expect(body.user).toBeTruthy();
  });

  it('answers /api/me with a null user when signed out', async () => {
    const body = await (await SELF.fetch('https://x/api/me')).json();
    expect(body.user).toBeNull();
  });
});

describe('signing out', () => {
  beforeEach(resetDb);

  it('stops the cookie working', async () => {
    const cookie = await signUp('out@example.com');
    expect((await SELF.fetch('https://x/api/cards?pathId=p', { headers: { cookie } })).status)
      .toBe(200);

    await post('/api/auth/sign-out', {}, cookie);

    expect((await SELF.fetch('https://x/api/cards?pathId=p', { headers: { cookie } })).status)
      .toBe(401);
  });
});

describe('a wrong password', () => {
  beforeEach(resetDb);

  it('does not produce a usable session', async () => {
    await signUp('pw@example.com');
    const res = await post('/api/auth/sign-in/email',
      { email: 'pw@example.com', password: 'not-the-password' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
```

- [ ] **Step 4: Rewrite the isolation suite through real sign-ups**

In `test/worker/session-isolation.test.js`, replace the local `signIn` helper
and its `beforeEach` with:

```js
import { resetDb, signUp } from '../helpers.js';

  let A, B;

  beforeEach(async () => {
    await resetDb();
    A = await signUp('alice@example.com');
    B = await signUp('bob@example.com');
  });
```

Delete the `import * as db` and `sha256Hex` imports and the old `signIn`
function. Everything else in the file is unchanged — the assertions were never
about how the session was obtained.

- [ ] **Step 5: Point the four route test files at real accounts**

In each of `progress.test.js`, `cards.test.js`, `reviews.test.js` and
`me.test.js`, replace the local `signInAs` helper and its imports with:

```js
import { resetDb, signUp } from '../helpers.js';
```

and change each `beforeEach` to:

```js
  beforeEach(async () => {
    await resetDb();
    COOKIE = await signUp();
  });
```

Delete the `import * as db`, `import { sha256Hex }`, `AUTH_DAY` and
`signInAs` from each file — `crypto.js` no longer exists, so these will not
resolve.

In `me.test.js`, the assertion `expect(body.user.login).toBe('u1')` becomes:

```js
    expect(body.user.email).toBe('a@example.com');
```

Better Auth users have an email rather than a login.

`reviews.test.js` keeps its `seedUsers('someone-else')` call unchanged —
`seedUsers` now writes to Better Auth's `user` table, so the foreign key still
resolves and the test still means what it meant.

- [ ] **Step 5b: Confirm the direct-to-db suites still pass**

`cards-db.test.js`, `export-db.test.js` and `isolation.test.js` call `db.js`
functions directly and seed bare users. They need no edits, but they are the
files most likely to break silently on the foreign-key change:

```bash
pnpm vitest run --project worker test/worker/cards-db.test.js \
  test/worker/export-db.test.js test/worker/isolation.test.js
```

Expected: PASS. A failure here means `seedUsers` is writing columns Better
Auth's `user` table does not have.

- [ ] **Step 6: Delete the spike**

```bash
git rm test/worker/betterauth-spike.test.js
```

Its job is done: real tests now cover the same ground through the routes.

- [ ] **Step 7: Run the worker project**

```bash
pnpm vitest run --project worker
```

Expected: PASS. The count will be lower than 110 — 44 tests were deleted in
Task 4 and roughly 8 added here.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Rewrite the worker tests around real accounts

Every test now signs up through the route a person uses, and verifies
using the link Better Auth actually generated — pulled out of the
recorded mail rather than by setting emailVerified in the database. The
flow is tested, not simulated.

The isolation suite is unchanged apart from how its two users are
created. Its assertions were never about the mechanism, which is why they
survived three different auth systems."
```

---

### Task 6: The frontend, and four states

**Files:**
- Create: `src/auth-view.js`
- Modify: `src/api.js`, `src/auth.js`, `src/main.js`, `index.html`, `style.css`

**Interfaces:**
- Consumes: `/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/sign-out`, `/api/auth/forget-password`.
- Produces:
  - `renderAuthView(onChanged)` in `src/auth-view.js`
  - `API.unverified` flag, set on 403
  - a `#view-account` panel holding the forms

- [ ] **Step 1: Add the panel to `index.html`**

Immediately before `<div id="view-settings" class="view-panel">`:

```html
<div id="view-account" class="view-panel">
  <div class="container">
    <section class="today-block" id="auth-panel"></section>
  </div>
</div>
```

- [ ] **Step 2: Teach `src/api.js` about 403**

In `request`, beside the 401 branch:

```js
      if (res.status === 403) {
        const err = new Error(`${method} ${path} — 403`);
        err.unverified = true;
        throw err;
      }
```

Add `onUnverified: null,` beside `onUnauthorized: null,`.

In `mutate`'s catch, before the `unauthorized` branch:

```js
        // Neither 401 nor 403 is retryable. Queueing a write that can never
        // land leaves an offline banner that never clears.
        if (e.unverified) {
          API.dequeue(entry);
          API.onUnverified?.();
          return null;
        }
```

and the same two lines inside `flushOutbox`'s catch, using `continue`.

Add the auth calls beside `signout`:

```js
    async signUp(email, password) {
      return API.request('POST', '/api/auth/sign-up/email',
        { email, password, name: email });
    },

    async signIn(email, password) {
      return API.request('POST', '/api/auth/sign-in/email', { email, password });
    },

    async forgotPassword(email) {
      return API.request('POST', '/api/auth/forget-password',
        { email, redirectTo: `${window.location.origin}/#account` });
    },
```

and change `signout` to call Better Auth's route:

```js
    async signout() {
      try { await API.request('POST', '/api/auth/sign-out', {}); } catch {}
    },
```

- [ ] **Step 3: Write `src/auth-view.js`**

```js
/**
 * Sign-in, sign-up, forgotten password, and the unverified screen.
 *
 * Better Auth is a server dependency only — this talks to its routes with
 * plain fetch, so the bundle stays small and the project keeps exactly one
 * runtime dependency.
 */
import { API } from './api.js';
import { me } from './auth.js';

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const form = (mode) => `
  <div class="today-block-title">${mode === 'up' ? 'Create an account' : 'Sign in'}</div>
  <label class="capture-label">Email</label>
  <input class="capture-input" id="auth-email" type="email" autocomplete="email">
  <label class="capture-label">Password</label>
  <input class="capture-input" id="auth-password" type="password"
         autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}">
  <div class="settings-actions">
    <button class="today-review-btn" id="auth-submit">
      ${mode === 'up' ? 'Sign up' : 'Sign in'}</button>
    <button class="capture-skip" id="auth-toggle">
      ${mode === 'up' ? 'I already have an account' : 'Create an account'}</button>
    <span class="capture-status" id="auth-status"></span>
  </div>
  ${mode === 'in'
    ? `<div class="settings-actions">
         <button class="capture-skip" id="auth-forgot">Forgot password</button>
       </div>`
    : ''}`;

const unverified = (email) => `
  <div class="today-block-title">Check your inbox</div>
  <p class="settings-note">A verification link is on its way to
    <strong>${esc(email)}</strong>. You can read the whole plan now; tracking
    progress and writing cards start once the address is confirmed.</p>`;

export function renderAuthView(onChanged) {
  const panel = document.getElementById('auth-panel');
  if (!panel) return;

  const current = me();
  if (current.user && !current.user.emailVerified) {
    panel.innerHTML = unverified(current.user.email);
    return;
  }

  let mode = 'in';

  function paint() {
    panel.innerHTML = form(mode);

    document.getElementById('auth-toggle').addEventListener('click', () => {
      mode = mode === 'in' ? 'up' : 'in';
      paint();
    });

    document.getElementById('auth-submit').addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const status = document.getElementById('auth-status');

      if (!email || !password) {
        status.textContent = 'Email and password, both.';
        return;
      }

      status.textContent = mode === 'up' ? 'Creating…' : 'Signing in…';
      try {
        if (mode === 'up') await API.signUp(email, password);
        else await API.signIn(email, password);
        await onChanged();
      } catch {
        // Deliberately the same message for a wrong password and an unknown
        // address: distinguishing them tells a stranger which emails have
        // accounts here.
        status.textContent = mode === 'up'
          ? 'Could not create that account.'
          : 'That email and password do not match.';
      }
    });

    const forgot = document.getElementById('auth-forgot');
    if (forgot) {
      forgot.addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value.trim();
        const status = document.getElementById('auth-status');
        if (!email) { status.textContent = 'Enter your email first.'; return; }
        await API.forgotPassword(email).catch(() => {});
        // Always the same answer, for the same reason as above.
        status.textContent = 'If that address has an account, a reset link is on its way.';
      });
    }
  }

  paint();
}
```

- [ ] **Step 4: Update the header in `src/auth.js`**

Replace the signed-out branch of `renderHeader`:

```js
  if (!current.user) {
    slot.innerHTML = `<a class="auth-signin" href="#account">Sign in</a>`;
    return;
  }
```

and the signed-in branch's identity line — Better Auth users have an email
rather than a login:

```js
  const { email, emailVerified } = current.user;
  slot.innerHTML = `
    <span class="auth-login">${email ?? ''}</span>
    ${emailVerified ? '' : '<a class="auth-signin" href="#account">verify</a>'}
    <button class="auth-signout" id="auth-signout">Sign out</button>`;
```

- [ ] **Step 5: Wire the fourth state into `src/main.js`**

Add the import:

```js
import { renderAuthView } from './auth-view.js';
```

After `renderHeader()`, add:

```js
  // Re-boot after a successful sign-in or sign-up rather than patching state
  // in place: every view depends on who is asking.
  renderAuthView(async () => { window.location.reload(); });
```

Add the unverified handler beside the unauthorized one:

```js
  API.onUnverified = () => { window.location.hash = '#account'; };
```

and replace the routing decision at the end of `boot`:

```js
  const verified = Boolean(me.user?.emailVerified);

  if (me.user && !verified) {
    window.location.hash = '#account';
  } else if (verified && !enrolled.has(PATH_ID)) {
    window.location.hash = '#paths';
  } else if (!window.location.hash) {
    window.location.hash = '#today';
  }
```

Change the two `isSignedIn()` guards in `boot` to require verification too, so
an unverified account does not request progress or cards:

```js
  if (verified) {
    setProgressState(await API.getProgress(PATH_ID));
    CAPTURE_STATE.cards = await API.getCards(PATH_ID);
  }
```

- [ ] **Step 6: Make `isSignedIn` mean "may write"**

In `src/auth.js`:

```js
/**
 * Signed in AND verified. Everything that gates writing calls this, and an
 * unverified account must not be able to tick a step or capture a card.
 */
export function isSignedIn() {
  return Boolean(current.user?.emailVerified);
}
```

- [ ] **Step 7: Add the nav link**

In `index.html`, after the Settings link:

```html
    <a href="#account">Account</a>
```

- [ ] **Step 8: Build**

```bash
pnpm build
```

Expected: a clean build.

- [ ] **Step 9: Commit**

```bash
git add src index.html style.css
git commit -m "Add email and password sign-in, and a fourth boot state

The unverified state gets its own screen rather than an error message.
The person has an account and simply cannot write yet; showing them a
sign-in form would be actively wrong.

Sign-in failures say the same thing for a wrong password and an unknown
address, and forgotten-password always claims a link is on its way.
Distinguishing them would tell a stranger which email addresses have
accounts here.

isSignedIn now means signed in AND verified, because every caller uses it
to gate writing."
```

---

### Task 7: DOM tests for the new states

**Files:**
- Modify: `test/dom/harness.js`, `test/dom/boot.test.js`
- Create: `test/dom/account.test.js`

**Interfaces:**
- Consumes: `mountApp` (existing harness).
- Produces: a `verified` option on `mountApp`, defaulting to `true` when signed in.

- [ ] **Step 1: Teach the harness about verification**

In `test/dom/harness.js`, change the state destructuring and the `me` object:

```js
  const {
    signedIn = false,
    verified = true,
    enrolled = false,
    cards = [],
    progress = []
  } = state;
```

```js
  const me = signedIn
    ? {
        user: { id: 'u1', email: 'ravi@example.com', emailVerified: verified },
        enrollments: enrolled
          ? [{ pathId: 'frontier-lab', startedOn: '2026-07-01' }]
          : []
      }
    : { user: null, enrollments: [] };
```

- [ ] **Step 2: Write `test/dom/account.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { mountApp } from './harness.js';

const $ = sel => document.querySelector(sel);

describe('signed out', () => {
  it('offers sign-in from the header', async () => {
    await mountApp();
    expect($('.auth-signin')).toBeTruthy();
  });

  it('shows a sign-in form on the account panel', async () => {
    await mountApp();
    expect($('#auth-email')).toBeTruthy();
    expect($('#auth-password')).toBeTruthy();
  });

  it('can switch to the sign-up form and back', async () => {
    await mountApp();
    $('#auth-toggle').click();
    expect($('#auth-submit').textContent).toMatch(/sign up/i);
    $('#auth-toggle').click();
    expect($('#auth-submit').textContent).toMatch(/sign in/i);
  });

  it('posts to the sign-in route with what was typed', async () => {
    const { requests } = await mountApp();
    $('#auth-email').value = 'someone@example.com';
    $('#auth-password').value = 'a-password';
    $('#auth-submit').click();
    await new Promise(r => setTimeout(r, 0));

    const post = requests.find(r => r.url.includes('/api/auth/sign-in/email'));
    expect(post).toBeTruthy();
    expect(post.body).toMatchObject({ email: 'someone@example.com', password: 'a-password' });
  });

  it('refuses to submit an empty form rather than posting blanks', async () => {
    const { requests } = await mountApp();
    $('#auth-submit').click();
    await new Promise(r => setTimeout(r, 0));

    expect($('#auth-status').textContent).toMatch(/both/i);
    expect(requests.find(r => r.url.includes('/api/auth/sign-in'))).toBeUndefined();
  });
});

describe('signed in but unverified', () => {
  it('lands on the account panel rather than Today', async () => {
    await mountApp({ signedIn: true, verified: false, enrolled: true });
    expect(window.location.hash).toBe('#account');
  });

  it('says to check the inbox, and names the address', async () => {
    await mountApp({ signedIn: true, verified: false, enrolled: true });
    expect($('#auth-panel').textContent).toMatch(/check your inbox/i);
    expect($('#auth-panel').textContent).toContain('ravi@example.com');
  });

  it('still renders the whole curriculum, because reading was never gated', async () => {
    await mountApp({ signedIn: true, verified: false, enrolled: true });
    expect(document.querySelectorAll('.task-item').length).toBeGreaterThan(100);
  });

  it('cannot write: every step checkbox is disabled', async () => {
    const { path } = await mountApp({ signedIn: true, verified: false, enrolled: true });
    const id = path.phases[0].tasks[0].subtasks[0].id;
    $(`.task-item[data-subtask-id="${id}"]`).click();

    const boxes = [...document.querySelectorAll('#sidebar-body .step-checkbox')];
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.every(b => b.disabled)).toBe(true);
  });

  it('never asks for progress or cards', async () => {
    const { requests } = await mountApp({ signedIn: true, verified: false, enrolled: true });
    const urls = requests.map(r => r.url).join(' ');
    expect(urls).not.toMatch(/api\/progress/);
    expect(urls).not.toMatch(/api\/cards/);
  });
});

describe('signed in and verified', () => {
  it('goes to Today when enrolled', async () => {
    await mountApp({ signedIn: true, verified: true, enrolled: true });
    expect(window.location.hash).toBe('#today');
  });

  it('shows the email in the header', async () => {
    await mountApp({ signedIn: true, verified: true, enrolled: true });
    expect($('.auth-login').textContent).toContain('ravi@example.com');
  });
});
```

- [ ] **Step 3: Run the DOM project**

```bash
pnpm vitest run --project dom
```

Expected: PASS. The existing boot tests still pass because `verified` defaults
to `true`.

- [ ] **Step 4: Commit**

```bash
git add test/dom
git commit -m "Test the four boot states in the DOM

The unverified case is the new one and the one worth having: it asserts
the curriculum still renders, every checkbox is disabled, and the app
never asks for progress or cards. An account that cannot write should not
be requesting the data it cannot change."
```

---

### Task 8: Documentation

**Files:**
- Modify: `README.md`, `.dev.vars.example`

- [ ] **Step 1: Rewrite the Running it section's credentials paragraph**

Replace the GitHub OAuth paragraphs in `README.md` with:

````markdown
Sign-in is email and password, handled by [Better Auth](https://better-auth.com)
against D1. Set a session secret before first run:

```sh
cp .dev.vars.example .dev.vars
node -e "console.log('BETTER_AUTH_SECRET=' + require('crypto').randomBytes(32).toString('base64url'))" >> .dev.vars
```

**Email is not wired to a provider yet.** `worker/email.js` records and logs
instead of sending, so verification links appear in `wrangler tail` rather than
an inbox. Choosing a provider — Cloudflare Email Service needs the Workers Paid
plan and an onboarded sending domain; Resend's free tier does not — is a
one-file change to that seam.
````

- [ ] **Step 2: Update the editing note**

Replace the sessions paragraph under **The one thing to know before editing**:

````markdown
Sessions and accounts belong to Better Auth, in its own `user`, `session`,
`account` and `verification` tables. Every domain table references `user(id)`
with `ON DELETE CASCADE`, so deleting an account still removes every card and
review with it.
````

- [ ] **Step 3: Run everything**

```bash
pnpm test
pnpm build
pnpm validate
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add README.md .dev.vars.example
git commit -m "Document email and password sign-in

Says plainly that email is not yet wired to a provider and that
verification links appear in wrangler tail. A README that implied working
mail would waste the first hour of anyone's setup."
```

---

## Verification checklist

- [ ] `pnpm test` — both projects green
- [ ] A signed-up but unverified account gets 403 on every protected route
- [ ] Verifying through the link in the recorded mail then allows writes
- [ ] Two really-signed-up users cannot read, grade or delete each other's data
- [ ] `DELETE /api/me` removes that user's rows and nobody else's
- [ ] Signing out makes the cookie stop working immediately
- [ ] A wrong password and an unknown address produce the same message
- [ ] Signed out, the curriculum renders and every checkbox is disabled
- [ ] Unverified, the app never requests progress or cards
- [ ] `SELECT sql FROM sqlite_master WHERE name='cards'` contains `REFERENCES user(id)`
