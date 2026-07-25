# GitHub Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the seeded-user seam with real GitHub OAuth sessions, so the app can be deployed publicly without handing every visitor the same account.

**Architecture:** A `sessions` table in D1 holds a SHA-256 of an opaque cookie token. `getUser` resolves the cookie to a user or `null`; `index.js` already 401s on null. Three new public routes handle the OAuth dance. The frontend gains a signed-out read-only branch and a path picker.

**Tech Stack:** Cloudflare Workers, D1, Wrangler, Vitest with `@cloudflare/vitest-pool-workers`, Vite 8, pnpm, Node 24. WebCrypto for hashing and randomness — no crypto dependency.

## Global Constraints

- **Sessions are stored, not signed.** The table holds `SHA-256(token)`; the cookie holds the token. Never store the token itself.
- **Cookie is `flp_session`:** `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 2592000 (30 days), and `Secure` only when the request is https. `Lax` is required — a `Strict` cookie is not sent on the redirect back from GitHub.
- **No OAuth scope is requested.** `id`, `login` and `avatar_url` are public profile fields.
- **The GitHub access token is used once and discarded.** Never stored, never logged.
- **The `state` parameter is mandatory.** The callback rejects a missing parameter, a missing cookie, or a mismatch.
- **A 401 is not a retryable failure.** The outbox drops the entry rather than queueing it forever.
- **Only `/api/me` and the three auth routes are public.** Everything else 401s without a session.
- **`startedOn` is a local calendar date** as `YYYY-MM-DD`. Never `toISOString()`, which returns the UTC day.
- Every query stays scoped by `user_id`. That work is already done; do not undo it.
- Package manager is pnpm. Node >= 24.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `migrations/0003_sessions.sql` | The sessions table and its index. |
| `worker/crypto.js` | `sha256Hex`, `randomToken`, `readCookie`, `cookieHeader`. No app logic. |
| `worker/github.js` | `exchangeCode`, `fetchUser`. The only file that talks to github.com. |
| `worker/routes/auth.js` | `start`, `callback`, `signout`. |
| `test/worker/auth.test.js` | Session resolution, CSRF, sign-out, public vs protected. |
| `test/worker/session-isolation.test.js` | Two real signed-in users cannot see each other's data. |
| `src/auth.js` | Session state and the header. |
| `src/paths-view.js` | The path picker. |

**Modified:** `worker/auth.js` (the seam), `worker/index.js` (public route flag), `worker/db.js` (session queries, user upsert), `worker/routes/me.js` (null-user branch), `wrangler.jsonc`, `.gitignore`, `src/api.js` (401 handling), `src/main.js` (boot branch), `src/sidebar.js` (disable when signed out), `index.html` (header slot, `#view-paths`), `style.css`.

---

### Task 1: The sessions table and crypto helpers

**Files:**
- Create: `migrations/0003_sessions.sql`, `worker/crypto.js`, `test/worker/crypto.test.js`

**Interfaces:**
- Produces:
  - `sha256Hex(text) -> Promise<string>` — lowercase hex
  - `randomToken() -> string` — 32 random bytes, base64url, no padding
  - `readCookie(request, name) -> string | null`
  - `cookieHeader(name, value, {maxAge, secure}) -> string`
  - Table `sessions(id, user_id, created_at, expires_at, user_agent)` where `id` is `SHA-256` of the token.

- [ ] **Step 1: Write `migrations/0003_sessions.sql`**

```sql
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);
```

- [ ] **Step 2: Write the failing test**

Create `test/worker/crypto.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { sha256Hex, randomToken, readCookie, cookieHeader } from '../../worker/crypto.js';

describe('sha256Hex', () => {
  it('matches the known digest of the empty string', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('is stable, because the stored session id is derived from it every request', async () => {
    expect(await sha256Hex('abc')).toBe(await sha256Hex('abc'));
  });

  it('differs for different input', async () => {
    expect(await sha256Hex('abc')).not.toBe(await sha256Hex('abd'));
  });
});

describe('randomToken', () => {
  it('is url-safe, so it survives a Set-Cookie header unescaped', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is long enough not to be guessed', () => {
    // 32 bytes base64url with no padding
    expect(randomToken().length).toBeGreaterThanOrEqual(43);
  });

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 200 }, () => randomToken()));
    expect(seen.size).toBe(200);
  });
});

describe('readCookie', () => {
  const req = header => new Request('https://x/', { headers: header ? { cookie: header } : {} });

  it('returns null when there is no cookie header at all', () => {
    expect(readCookie(req(null), 'flp_session')).toBeNull();
  });

  it('finds a cookie among several', () => {
    expect(readCookie(req('a=1; flp_session=tok; b=2'), 'flp_session')).toBe('tok');
  });

  it('does not match a cookie whose name merely ends with the one asked for', () => {
    // "x_flp_session" must not satisfy a request for "flp_session"
    expect(readCookie(req('x_flp_session=nope'), 'flp_session')).toBeNull();
  });

  it('returns null for a name that is absent', () => {
    expect(readCookie(req('other=1'), 'flp_session')).toBeNull();
  });
});

describe('cookieHeader', () => {
  it('is HttpOnly and Lax, because Strict is not sent on the redirect back from GitHub', () => {
    const h = cookieHeader('flp_session', 'tok', { maxAge: 60, secure: true });
    expect(h).toMatch(/HttpOnly/);
    expect(h).toMatch(/SameSite=Lax/);
    expect(h).toMatch(/Path=\//);
    expect(h).toMatch(/Max-Age=60/);
    expect(h).toMatch(/Secure/);
  });

  it('omits Secure on plain http, so local development can sign in', () => {
    expect(cookieHeader('flp_session', 'tok', { maxAge: 60, secure: false }))
      .not.toMatch(/Secure/);
  });

  it('clears with Max-Age=0 when given an empty value', () => {
    expect(cookieHeader('flp_session', '', { maxAge: 0, secure: false }))
      .toMatch(/Max-Age=0/);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
pnpm vitest run test/worker/crypto.test.js
```

Expected: FAIL — `worker/crypto.js` does not exist.

- [ ] **Step 4: Write `worker/crypto.js`**

```js
/**
 * Cookie and crypto helpers. WebCrypto only — Workers has it built in, and a
 * dependency here would be a dependency in the security-critical path.
 */

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 32 bytes, base64url, unpadded — safe in a cookie without escaping. */
export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function readCookie(request, name) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    // Trim before comparing: "x_flp_session" must not satisfy "flp_session".
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

export function cookieHeader(name, value, { maxAge, secure }) {
  const parts = [
    `${name}=${value}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAge}`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
```

- [ ] **Step 5: Run the tests**

```bash
pnpm vitest run test/worker/crypto.test.js
```

Expected: PASS, 12 tests.

- [ ] **Step 6: Apply the migration locally**

```bash
pnpm db:migrate:local
pnpm wrangler d1 execute frontier-lab --local --json \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected: the list includes `sessions`.

- [ ] **Step 7: Commit**

```bash
git add migrations worker/crypto.js test/worker/crypto.test.js
git commit -m "Add the sessions table and cookie helpers

The table's primary key is a SHA-256 of the cookie token rather than the
token, so a leaked database does not replay as live sessions.

SameSite is Lax and that is load-bearing: a Strict cookie is not sent on
the top-level redirect back from GitHub, so sign-in would appear to
succeed and then drop the user on the very next request."
```

---

### Task 2: Session and user queries

**Files:**
- Modify: `worker/db.js`
- Create: `test/worker/sessions-db.test.js`

**Interfaces:**
- Consumes: `sha256Hex`, `randomToken` (Task 1); `resetDb`, `seedUsers` from `test/helpers.js`.
- Produces:
  - `createSession(env, userId, tokenHash, now, ttlMs, userAgent) -> Promise<void>`
  - `findSessionUser(env, tokenHash, now) -> Promise<user | null>`
  - `deleteSession(env, tokenHash) -> Promise<void>`
  - `deleteExpiredSessions(env, now) -> Promise<void>`
  - `upsertGithubUser(env, {githubId, login, avatarUrl}, now) -> Promise<user>` — returns the existing row when `github_id` already exists, otherwise inserts one with a fresh id.

- [ ] **Step 1: Write the failing test**

Create `test/worker/sessions-db.test.js`:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../worker/db.js';
import { resetDb, seedUsers } from '../helpers.js';

const DAY = 86400000;
const T = 1_800_000_000_000;

describe('session queries', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers('u1', 'u2');
  });

  it('resolves a live session to its user', async () => {
    await db.createSession(env, 'u1', 'hash-1', T, 30 * DAY, 'agent');
    const user = await db.findSessionUser(env, 'hash-1', T + DAY);
    expect(user.id).toBe('u1');
  });

  it('does not resolve an expired session, because that is the whole point of storing them', async () => {
    await db.createSession(env, 'u1', 'hash-1', T, DAY, 'agent');
    expect(await db.findSessionUser(env, 'hash-1', T + 2 * DAY)).toBeNull();
  });

  it('does not resolve an unknown token', async () => {
    expect(await db.findSessionUser(env, 'never-issued', T)).toBeNull();
  });

  it('stops resolving after the session is deleted — a signed cookie could not do this', async () => {
    await db.createSession(env, 'u1', 'hash-1', T, 30 * DAY, 'agent');
    await db.deleteSession(env, 'hash-1');
    expect(await db.findSessionUser(env, 'hash-1', T)).toBeNull();
  });

  it('leaves other sessions alone when one is deleted', async () => {
    await db.createSession(env, 'u1', 'hash-1', T, 30 * DAY, 'a');
    await db.createSession(env, 'u2', 'hash-2', T, 30 * DAY, 'b');
    await db.deleteSession(env, 'hash-1');
    expect(await db.findSessionUser(env, 'hash-2', T)).not.toBeNull();
  });

  it('sweeps only expired rows', async () => {
    await db.createSession(env, 'u1', 'old', T, DAY, 'a');
    await db.createSession(env, 'u2', 'new', T, 30 * DAY, 'b');
    await db.deleteExpiredSessions(env, T + 2 * DAY);
    expect(await db.findSessionUser(env, 'old', T + 2 * DAY)).toBeNull();
    expect(await db.findSessionUser(env, 'new', T + 2 * DAY)).not.toBeNull();
  });

  it('deleting a user removes their sessions, so account deletion signs out every device', async () => {
    await db.createSession(env, 'u1', 'hash-1', T, 30 * DAY, 'a');
    await db.deleteUser(env, 'u1');
    const { results } = await env.DB.prepare('SELECT * FROM sessions').all();
    expect(results).toHaveLength(0);
  });
});

describe('upsertGithubUser', () => {
  beforeEach(resetDb);

  it('creates a user the first time that github id is seen', async () => {
    const u = await db.upsertGithubUser(env,
      { githubId: 4242, login: 'ravi', avatarUrl: 'https://x/a.png' }, T);
    expect(u.id).toBeTruthy();
    expect(u.login).toBe('ravi');
  });

  it('returns the same row on a second sign-in rather than creating a duplicate', async () => {
    const first = await db.upsertGithubUser(env,
      { githubId: 4242, login: 'ravi', avatarUrl: 'a' }, T);
    const second = await db.upsertGithubUser(env,
      { githubId: 4242, login: 'ravi', avatarUrl: 'a' }, T + DAY);
    expect(second.id).toBe(first.id);
    const { results } = await env.DB.prepare('SELECT * FROM users WHERE github_id = 4242').all();
    expect(results).toHaveLength(1);
  });

  it('updates a changed login and avatar, because people rename themselves', async () => {
    const first = await db.upsertGithubUser(env,
      { githubId: 4242, login: 'old', avatarUrl: 'old.png' }, T);
    const second = await db.upsertGithubUser(env,
      { githubId: 4242, login: 'new', avatarUrl: 'new.png' }, T + DAY);
    expect(second.id).toBe(first.id);
    expect(second.login).toBe('new');
    expect(second.avatar_url).toBe('new.png');
  });

  it('keeps two different github ids as two different accounts', async () => {
    const a = await db.upsertGithubUser(env, { githubId: 1, login: 'a', avatarUrl: '' }, T);
    const b = await db.upsertGithubUser(env, { githubId: 2, login: 'b', avatarUrl: '' }, T);
    expect(a.id).not.toBe(b.id);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/worker/sessions-db.test.js
```

Expected: FAIL — `db.createSession is not a function`.

- [ ] **Step 3: Append to `worker/db.js`**

```js
export async function createSession(env, userId, tokenHash, now, ttlMs, userAgent) {
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, user_agent)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(tokenHash, userId, now, now + ttlMs, userAgent ?? null).run();
}

export async function findSessionUser(env, tokenHash, now) {
  const row = await env.DB.prepare(
    `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?`
  ).bind(tokenHash, now).first();
  return row ?? null;
}

export async function deleteSession(env, tokenHash) {
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(tokenHash).run();
}

/** Swept on sign-in rather than by a cron: these rows can no longer be used. */
export async function deleteExpiredSessions(env, now) {
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run();
}

export async function upsertGithubUser(env, { githubId, login, avatarUrl }, now) {
  const existing = await env.DB
    .prepare('SELECT * FROM users WHERE github_id = ?').bind(githubId).first();

  if (existing) {
    // A login or avatar can change between sign-ins; the id must not.
    await env.DB.prepare('UPDATE users SET login = ?, avatar_url = ? WHERE id = ?')
      .bind(login, avatarUrl ?? null, existing.id).run();
    return { ...existing, login, avatar_url: avatarUrl ?? null };
  }

  const id = newId();
  await env.DB.prepare(
    `INSERT INTO users (id, github_id, login, avatar_url, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, githubId, login, avatarUrl ?? null, now).run();

  return { id, github_id: githubId, login, avatar_url: avatarUrl ?? null, created_at: now };
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run test/worker/sessions-db.test.js
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/db.js test/worker/sessions-db.test.js
git commit -m "Add session and GitHub user queries

Sign-out is asserted by the session ceasing to resolve. That test is the
difference between a session table and a signed cookie — with a stateless
cookie it cannot pass, which is why the table exists.

upsertGithubUser updates a changed login and avatar but never the row id,
because people rename themselves and their cards must not move."
```

---

### Task 3: The GitHub client

**Files:**
- Create: `worker/github.js`, `test/worker/github.test.js`

**Interfaces:**
- Produces:
  - `authorizeUrl(env, state) -> string`
  - `exchangeCode(env, code, fetchImpl = fetch) -> Promise<string>` — the access token; throws on a GitHub error response
  - `fetchUser(token, fetchImpl = fetch) -> Promise<{githubId, login, avatarUrl}>`
  - `fetchImpl` is injected so the routes are testable without reaching the network.

- [ ] **Step 1: Write the failing test**

Create `test/worker/github.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { authorizeUrl, exchangeCode, fetchUser } from '../../worker/github.js';

const ENV = {
  GITHUB_CLIENT_ID: 'client-abc',
  GITHUB_CLIENT_SECRET: 'secret-xyz',
  APP_URL: 'https://app.example'
};

const jsonResponse = body => new Response(JSON.stringify(body), {
  status: 200, headers: { 'content-type': 'application/json' }
});

describe('authorizeUrl', () => {
  it('carries the client id, the callback and the state', () => {
    const u = new URL(authorizeUrl(ENV, 'state-123'));
    expect(u.origin + u.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(u.searchParams.get('client_id')).toBe('client-abc');
    expect(u.searchParams.get('state')).toBe('state-123');
    expect(u.searchParams.get('redirect_uri')).toBe('https://app.example/api/auth/callback');
  });

  it('requests no scope at all, which is the smallest consent screen and blast radius', () => {
    const u = new URL(authorizeUrl(ENV, 's'));
    expect(u.searchParams.get('scope')).toBeNull();
  });
});

describe('exchangeCode', () => {
  it('posts the code and returns the access token', async () => {
    let seen = null;
    const fake = async (url, opts) => {
      seen = { url, body: JSON.parse(opts.body) };
      return jsonResponse({ access_token: 'gho_token' });
    };
    expect(await exchangeCode(ENV, 'the-code', fake)).toBe('gho_token');
    expect(seen.url).toBe('https://github.com/login/oauth/access_token');
    expect(seen.body.code).toBe('the-code');
    expect(seen.body.client_secret).toBe('secret-xyz');
  });

  it('throws when GitHub answers with an error rather than a token', async () => {
    const fake = async () => jsonResponse({ error: 'bad_verification_code' });
    await expect(exchangeCode(ENV, 'stale', fake)).rejects.toThrow(/bad_verification_code/);
  });

  it('throws on a non-200, rather than treating undefined as a token', async () => {
    const fake = async () => new Response('nope', { status: 500 });
    await expect(exchangeCode(ENV, 'c', fake)).rejects.toThrow();
  });
});

describe('fetchUser', () => {
  it('maps the GitHub profile onto our own field names', async () => {
    const fake = async (url, opts) => {
      expect(url).toBe('https://api.github.com/user');
      expect(opts.headers.authorization).toBe('Bearer gho_token');
      return jsonResponse({ id: 4242, login: 'ravi', avatar_url: 'https://x/a.png' });
    };
    expect(await fetchUser('gho_token', fake)).toEqual({
      githubId: 4242, login: 'ravi', avatarUrl: 'https://x/a.png'
    });
  });

  it('throws on a non-200 rather than returning a user with an undefined id', async () => {
    const fake = async () => new Response('unauthorized', { status: 401 });
    await expect(fetchUser('bad', fake)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/worker/github.test.js
```

Expected: FAIL — `worker/github.js` does not exist.

- [ ] **Step 3: Write `worker/github.js`**

```js
/**
 * The only module that talks to github.com. fetch is injected so the routes
 * can be tested without reaching the network — and so a test cannot
 * accidentally hit GitHub's rate limit.
 */

export function authorizeUrl(env, state) {
  const u = new URL('https://github.com/login/oauth/authorize');
  u.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  u.searchParams.set('redirect_uri', `${env.APP_URL}/api/auth/callback`);
  u.searchParams.set('state', state);
  // No scope. id, login and avatar_url are public profile fields, so asking
  // for nothing gives both the smallest consent screen and the smallest
  // blast radius if a token ever leaks.
  return u.toString();
}

export async function exchangeCode(env, code, fetchImpl = fetch) {
  const res = await fetchImpl('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${env.APP_URL}/api/auth/callback`
    })
  });
  if (!res.ok) throw new Error(`github token exchange failed: ${res.status}`);

  const body = await res.json();
  // GitHub answers 200 with an error field rather than a status code.
  if (body.error) throw new Error(`github: ${body.error}`);
  if (!body.access_token) throw new Error('github: no access_token in response');
  return body.access_token;
}

export async function fetchUser(token, fetchImpl = fetch) {
  const res = await fetchImpl('https://api.github.com/user', {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'frontier-lab-plan'
    }
  });
  if (!res.ok) throw new Error(`github user fetch failed: ${res.status}`);

  const u = await res.json();
  return { githubId: u.id, login: u.login, avatarUrl: u.avatar_url };
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run test/worker/github.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/github.js test/worker/github.test.js
git commit -m "Add the GitHub OAuth client

GitHub answers a bad code with HTTP 200 and an error field rather than a
status code, so a naive read of access_token yields undefined and the
flow continues with a broken token. Both cases throw here.

No scope is requested. id, login and avatar_url are public profile
fields, so asking for nothing gives the smallest consent screen and the
smallest blast radius."
```

---

### Task 4: The auth routes and the seam

**Files:**
- Create: `worker/routes/auth.js`, `test/worker/auth.test.js`
- Modify: `worker/auth.js`, `worker/index.js`, `worker/routes/me.js`, `wrangler.jsonc`, `.gitignore`

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces:
  - `GET /api/auth/github` → 302 with `location` to GitHub and a `flp_oauth_state` cookie
  - `GET /api/auth/callback?code&state` → 302 to `/` with `flp_session` set; 400 on any state problem
  - `POST /api/auth/signout` → 200, session row deleted, cookie cleared
  - `ROUTES` entries become `[method, path, handler, isPublic]`. Public: the three auth routes and `GET /api/me`.
  - `getUser(request, env)` resolves the cookie or returns `null`.

This is the point of no return: after this task every route except the public four requires a real session.

- [ ] **Step 1: Write the failing test**

Create `test/worker/auth.test.js`:

```js
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '../helpers.js';
import * as db from '../../worker/db.js';
import { sha256Hex } from '../../worker/crypto.js';

const DAY = 86400000;

async function signIn(userId = 'u1') {
  await env.DB.prepare('INSERT INTO users (id, login, created_at) VALUES (?, ?, 0)')
    .bind(userId, userId).run();
  const token = `tok-${userId}`;
  await db.createSession(env, userId, await sha256Hex(token), Date.now(), 30 * DAY, 'test');
  return `flp_session=${token}`;
}

const withCookie = (path, cookie, init = {}) =>
  SELF.fetch(`https://x${path}`, { ...init, headers: { ...(init.headers ?? {}), cookie } });

describe('session resolution', () => {
  beforeEach(resetDb);

  it('401s a protected route with no cookie at all', async () => {
    expect((await SELF.fetch('https://x/api/cards?pathId=p')).status).toBe(401);
  });

  it('401s a protected route with a cookie that was never issued', async () => {
    expect((await withCookie('/api/cards?pathId=p', 'flp_session=made-up')).status).toBe(401);
  });

  it('allows a protected route with a live session', async () => {
    const cookie = await signIn();
    expect((await withCookie('/api/cards?pathId=p', cookie)).status).toBe(200);
  });

  it('401s once the session has expired', async () => {
    await env.DB.prepare('INSERT INTO users (id, login, created_at) VALUES (?, ?, 0)')
      .bind('u1', 'u1').run();
    await db.createSession(env, 'u1', await sha256Hex('tok'), Date.now() - 2 * DAY, DAY, 't');
    expect((await withCookie('/api/cards?pathId=p', 'flp_session=tok')).status).toBe(401);
  });
});

describe('public routes', () => {
  beforeEach(resetDb);

  it('answers /api/me with a null user instead of 401, so the frontend branches on state', async () => {
    const res = await SELF.fetch('https://x/api/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null, enrollments: [] });
  });

  it('answers /api/me with the user when signed in', async () => {
    const cookie = await signIn();
    const body = await (await withCookie('/api/me', cookie)).json();
    expect(body.user.id).toBe('u1');
  });
});

describe('sign-in start', () => {
  beforeEach(resetDb);

  it('redirects to GitHub and plants a state cookie', async () => {
    const res = await SELF.fetch('https://x/api/auth/github', { redirect: 'manual' });
    expect(res.status).toBe(302);

    const location = new URL(res.headers.get('location'));
    expect(location.host).toBe('github.com');
    const state = location.searchParams.get('state');
    expect(state).toBeTruthy();

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain(`flp_oauth_state=${state}`);
    expect(setCookie).toMatch(/HttpOnly/);
  });
});

describe('callback CSRF', () => {
  beforeEach(resetDb);

  it('rejects a callback with no state cookie, because that is a forged sign-in', async () => {
    const res = await SELF.fetch('https://x/api/auth/callback?code=c&state=s',
      { redirect: 'manual' });
    expect(res.status).toBe(400);
  });

  it('rejects a state that does not match the cookie', async () => {
    const res = await withCookie('/api/auth/callback?code=c&state=attacker',
      'flp_oauth_state=mine', { redirect: 'manual' });
    expect(res.status).toBe(400);
  });

  it('rejects a callback with no state parameter', async () => {
    const res = await withCookie('/api/auth/callback?code=c',
      'flp_oauth_state=mine', { redirect: 'manual' });
    expect(res.status).toBe(400);
  });

  it('does not create a session when the state check fails', async () => {
    await withCookie('/api/auth/callback?code=c&state=attacker',
      'flp_oauth_state=mine', { redirect: 'manual' });
    const { results } = await env.DB.prepare('SELECT * FROM sessions').all();
    expect(results).toHaveLength(0);
  });
});

describe('sign out', () => {
  beforeEach(resetDb);

  it('deletes the session so the same cookie stops working', async () => {
    const cookie = await signIn();
    expect((await withCookie('/api/cards?pathId=p', cookie)).status).toBe(200);

    const out = await withCookie('/api/auth/signout', cookie, { method: 'POST' });
    expect(out.status).toBe(200);
    expect(out.headers.get('set-cookie')).toMatch(/Max-Age=0/);

    expect((await withCookie('/api/cards?pathId=p', cookie)).status).toBe(401);
  });

  it('leaves another user signed in', async () => {
    const a = await signIn('u1');
    const b = await signIn('u2');
    await withCookie('/api/auth/signout', a, { method: 'POST' });
    expect((await withCookie('/api/cards?pathId=p', b)).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/worker/auth.test.js
```

Expected: FAIL — the auth routes 404, and protected routes still succeed without a cookie.

- [ ] **Step 3: Write `worker/routes/auth.js`**

```js
import { json, error } from '../http.js';
import { randomToken, sha256Hex, readCookie, cookieHeader } from '../crypto.js';
import { authorizeUrl, exchangeCode, fetchUser } from '../github.js';
import {
  createSession, deleteSession, deleteExpiredSessions, upsertGithubUser
} from '../db.js';

const SESSION_COOKIE = 'flp_session';
const STATE_COOKIE = 'flp_oauth_state';
const SESSION_TTL = 30 * 86400000;
const STATE_TTL_SECONDS = 600;

const isHttps = request => new URL(request.url).protocol === 'https:';

export async function start(request, env) {
  const state = randomToken();
  return new Response(null, {
    status: 302,
    headers: {
      location: authorizeUrl(env, state),
      'set-cookie': cookieHeader(STATE_COOKIE, state, {
        maxAge: STATE_TTL_SECONDS, secure: isHttps(request)
      })
    }
  });
}

export async function callback(request, env) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const expected = readCookie(request, STATE_COOKIE);

  // Clear the state cookie whatever happens next — it is single use.
  const clearState = cookieHeader(STATE_COOKIE, '', { maxAge: 0, secure: isHttps(request) });

  // Without this check anyone can hand you a prepared callback URL that signs
  // you into their account, and every card you write afterwards is theirs.
  if (!expected || !state || state !== expected) {
    return new Response(JSON.stringify({ error: 'bad oauth state' }), {
      status: 400,
      headers: { 'content-type': 'application/json', 'set-cookie': clearState }
    });
  }
  if (!code) {
    return new Response(JSON.stringify({ error: 'missing code' }), {
      status: 400,
      headers: { 'content-type': 'application/json', 'set-cookie': clearState }
    });
  }

  const token = await exchangeCode(env, code);
  const profile = await fetchUser(token);
  // The access token has done its only job. It is never stored or logged.

  const now = Date.now();
  const user = await upsertGithubUser(env, profile, now);

  await deleteExpiredSessions(env, now);

  const sessionToken = randomToken();
  await createSession(env, user.id, await sha256Hex(sessionToken), now, SESSION_TTL,
    request.headers.get('user-agent'));

  const headers = new Headers({ location: env.APP_URL || '/' });
  headers.append('set-cookie', clearState);
  headers.append('set-cookie', cookieHeader(SESSION_COOKIE, sessionToken, {
    maxAge: SESSION_TTL / 1000, secure: isHttps(request)
  }));
  return new Response(null, { status: 302, headers });
}

export async function signout(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await deleteSession(env, await sha256Hex(token));

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': cookieHeader(SESSION_COOKIE, '', { maxAge: 0, secure: isHttps(request) })
    }
  });
}
```

**Note:** `headers.append` is used twice rather than a plain object, because two `Set-Cookie` headers must both survive — clearing the state cookie and setting the session cookie. An object literal would keep only the last.

- [ ] **Step 4: Replace the seam in `worker/auth.js`**

```js
/**
 * Session resolution. This is the only place that decides who is asking.
 *
 * Returns null rather than throwing when there is no valid session, because
 * index.js turns null into a 401 and /api/me turns it into a signed-out body.
 */
import { readCookie, sha256Hex } from './crypto.js';
import { findSessionUser } from './db.js';

export async function getUser(request, env) {
  const token = readCookie(request, 'flp_session');
  if (!token) return null;
  return findSessionUser(env, await sha256Hex(token), Date.now());
}
```

- [ ] **Step 5: Add the public flag in `worker/index.js`**

Replace the imports and `ROUTES`:

```js
import { getUser } from './auth.js';
import { error } from './http.js';
import * as progress from './routes/progress.js';
import * as cards from './routes/cards.js';
import * as reviews from './routes/reviews.js';
import * as meRoutes from './routes/me.js';
import * as auth from './routes/auth.js';

// [method, path, handler, isPublic]
const ROUTES = [
  ['GET', '/api/auth/github', auth.start, true],
  ['GET', '/api/auth/callback', auth.callback, true],
  ['POST', '/api/auth/signout', auth.signout, true],
  ['GET', '/api/me', meRoutes.me, true],
  ['GET', '/api/progress', progress.list],
  ['PUT', '/api/progress', progress.set],
  ['GET', '/api/cards', cards.list],
  ['POST', '/api/cards', cards.create],
  ['POST', '/api/reviews', reviews.create],
  ['DELETE', '/api/me', meRoutes.destroy],
  ['POST', '/api/enrollments', meRoutes.enrol]
];
```

and the guard inside `fetch`:

```js
    const user = await getUser(request, env);
    if (!user && !match[3]) return error('not signed in', 401);
```

- [ ] **Step 6: Give `me` its null-user branch in `worker/routes/me.js`**

Replace the `me` function:

```js
// The one handler that can receive a null user, because it is public. Every
// other route stays behind the 401 in index.js and may assume a user exists —
// the exemption is exactly one handler wide, deliberately.
export async function me(request, env, user) {
  if (!user) return json({ user: null, enrollments: [] });

  const rows = await getEnrollments(env, user.id);
  return json({
    user: { id: user.id, login: user.login, avatarUrl: user.avatar_url },
    enrollments: rows.map(r => ({ pathId: r.path_id, startedOn: r.started_on }))
  });
}
```

- [ ] **Step 7: Update config**

In `wrangler.jsonc`, replace the `vars` block:

```jsonc
  "vars": {
    "GITHUB_CLIENT_ID": "replace-with-the-dev-app-client-id",
    "APP_URL": "http://localhost:8787"
  },
```

`DEV_USER_ID` is deliberately gone: with it removed, nothing can authenticate as the seeded row. The row itself stays, because deleting it would cascade away any data captured locally during sub-project 1.

Append to `.gitignore`:

```
.dev.vars
```

Create `.dev.vars` (git-ignored, for local sign-in):

```
GITHUB_CLIENT_ID=the-dev-app-client-id
GITHUB_CLIENT_SECRET=the-dev-app-secret
```

- [ ] **Step 8: Fix the test helper**

`test/helpers.js` seeds `env.DEV_USER_ID`, which no longer exists. Replace `resetDb`:

```js
export async function resetDb() {
  await env.DB.prepare('DELETE FROM users').run();
}
```

The seeded row is no longer needed by tests: every test that needs a user now creates one and signs it in.

- [ ] **Step 9: Run the whole suite**

```bash
pnpm vitest run
```

Expected: the auth tests pass. **Several existing worker tests will now fail with 401** — `progress.test.js`, `cards.test.js`, `reviews.test.js` and `me.test.js` all relied on the seeded user. That is correct: they were passing because the app authenticated nobody.

- [ ] **Step 10: Give the existing route tests a real session**

In each of `test/worker/progress.test.js`, `cards.test.js`, `reviews.test.js` and `me.test.js`, add this helper and route every request through it:

```js
import * as db from '../../worker/db.js';
import { sha256Hex } from '../../worker/crypto.js';

const DAY = 86400000;
let COOKIE;

async function signIn(userId = 'u1') {
  await env.DB.prepare('INSERT INTO users (id, login, created_at) VALUES (?, ?, 0)')
    .bind(userId, userId).run();
  await db.createSession(env, userId, await sha256Hex(`tok-${userId}`),
    Date.now(), 30 * DAY, 'test');
  return `flp_session=tok-${userId}`;
}

const api = (path, init = {}) => SELF.fetch(`https://x${path}`, {
  ...init,
  headers: { ...(init.headers ?? {}), cookie: COOKIE }
});
```

Set `COOKIE = await signIn()` at the end of each `beforeEach`, and replace every `SELF.fetch('https://x…', …)` with `api('…', …)`.

In `reviews.test.js`, the other-user card test already seeds `someone-else` via `seedUsers`; leave that as it is — it inserts a row directly rather than signing in.

- [ ] **Step 11: Run the whole suite again**

```bash
pnpm vitest run
```

Expected: all tests pass — the previous 66 plus 30 new ones.

- [ ] **Step 12: Commit**

```bash
git add worker test wrangler.jsonc .gitignore
git commit -m "Require a real session on every route but four

getUser now resolves the flp_session cookie against the sessions table
instead of returning a seeded row to anybody who asks. DEV_USER_ID is
gone from the config, so nothing can authenticate as the seeded user.

The callback rejects a missing state cookie, a missing state parameter
and a mismatch, and creates no session in any of those cases. Without
that check anyone can hand you a prepared callback URL that signs you
into their account.

The existing route tests began failing with 401 the moment this landed.
They were passing because the app authenticated nobody; they now sign in
first."
```

---

### Task 5: Isolation through real sessions

**Files:**
- Create: `test/worker/session-isolation.test.js`

**Interfaces:**
- Consumes: everything from Task 4.

The sub-project 1 isolation tests proved separation by calling `db.js` with two user ids. This proves it through the path a real request actually takes — cookie, session lookup, route handler — which is the only version that would catch a route that forgot to pass `user.id` down.

- [ ] **Step 1: Write the test**

Create `test/worker/session-isolation.test.js`:

```js
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '../helpers.js';
import * as db from '../../worker/db.js';
import { sha256Hex } from '../../worker/crypto.js';

const DAY = 86400000;

async function signIn(userId) {
  await env.DB.prepare('INSERT INTO users (id, login, created_at) VALUES (?, ?, 0)')
    .bind(userId, userId).run();
  await db.createSession(env, userId, await sha256Hex(`tok-${userId}`),
    Date.now(), 30 * DAY, 'test');
  return `flp_session=tok-${userId}`;
}

const as = (cookie, path, init = {}) => SELF.fetch(`https://x${path}`, {
  ...init, headers: { ...(init.headers ?? {}), cookie, 'content-type': 'application/json' }
});

const makeCard = (cookie, prompt) => as(cookie, '/api/cards', {
  method: 'POST',
  body: JSON.stringify({
    pathId: 'frontier-lab', subtaskId: 'p2-serving-s01', prompt, answer: 'a'
  })
});

describe('isolation through real sessions', () => {
  let A, B;

  beforeEach(async () => {
    await resetDb();
    A = await signIn('alice');
    B = await signIn('bob');
  });

  it("does not list one signed-in user another's cards", async () => {
    await makeCard(A, 'alice-card');
    await makeCard(B, 'bob-card');

    const forA = await (await as(A, '/api/cards?pathId=frontier-lab')).json();
    expect(forA.cards).toHaveLength(1);
    expect(forA.cards[0].prompt).toBe('alice-card');
  });

  it("refuses to grade another user's card, answering exactly as for one that does not exist", async () => {
    const bob = (await (await makeCard(B, 'bob-card')).json()).card;

    const theirs = await as(A, '/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ cardId: bob.id, grade: 'good', latencyMs: 1 })
    });
    const missing = await as(A, '/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ cardId: 'no-such-card', grade: 'good', latencyMs: 1 })
    });

    expect(theirs.status).toBe(404);
    expect(await theirs.json()).toEqual(await missing.json());

    const row = await env.DB.prepare('SELECT reps FROM cards WHERE id = ?')
      .bind(bob.id).first();
    expect(row.reps).toBe(0);
  });

  it('keeps progress separate between two signed-in users', async () => {
    await as(A, '/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ pathId: 'frontier-lab', nodeId: 'n1', done: true })
    });

    const forB = await (await as(B, '/api/progress?pathId=frontier-lab')).json();
    expect(forB.nodeIds).toEqual([]);
  });

  it('keeps enrolments separate', async () => {
    await as(A, '/api/enrollments', {
      method: 'POST',
      body: JSON.stringify({ pathId: 'frontier-lab', startedOn: '2026-07-25' })
    });

    const meB = await (await as(B, '/api/me')).json();
    expect(meB.enrollments).toEqual([]);
  });

  it("deleting one account leaves the other's data and session intact", async () => {
    await makeCard(A, 'alice-card');
    await makeCard(B, 'bob-card');

    expect((await as(A, '/api/me', { method: 'DELETE' })).status).toBe(200);

    // Alice's session died with her account.
    expect((await as(A, '/api/cards?pathId=frontier-lab')).status).toBe(401);

    const forB = await (await as(B, '/api/cards?pathId=frontier-lab')).json();
    expect(forB.cards).toHaveLength(1);
    expect(forB.cards[0].prompt).toBe('bob-card');
  });
});
```

- [ ] **Step 2: Run it**

```bash
pnpm vitest run test/worker/session-isolation.test.js
```

Expected: PASS, 5 tests. If any fail, a route is not scoping by `user.id` — fix the route, never the test.

- [ ] **Step 3: Commit**

```bash
git add test/worker/session-isolation.test.js
git commit -m "Prove isolation through real sessions

The sub-project 1 tests proved separation by calling db.js with two user
ids. These go through the path a real request takes — cookie, session
lookup, route handler — which is the only version that catches a route
that forgot to pass user.id down.

Deleting an account also kills its sessions, so the same cookie stops
working immediately rather than at expiry."
```

---

### Task 6: The signed-out frontend and the header

**Files:**
- Create: `src/auth.js`
- Modify: `index.html`, `src/main.js`, `src/sidebar.js`, `src/api.js`, `style.css`

**Interfaces:**
- Consumes: `GET /api/me`, `POST /api/auth/signout`.
- Produces:
  - `src/auth.js` exports `renderHeader(me)` and `isSignedIn()`
  - `src/api.js` gains `signout()` and drops outbox entries on 401
  - `src/main.js` branches on the three states

- [ ] **Step 1: Add the header slot and the paths view to `index.html`**

Inside `<header class="site-header">`, after the `<nav>`, add:

```html
  <div class="auth-slot" id="auth-slot"></div>
```

Before `<div id="phase-views"></div>`, add:

```html
<div id="view-paths" class="view-panel">
  <div class="container">
    <section class="today-block">
      <div class="today-block-title">Learning paths</div>
      <div id="paths-list"></div>
    </section>
  </div>
</div>
```

- [ ] **Step 2: Write `src/auth.js`**

```js
/**
 * Session state and the header. The signed-out branch is not an error state:
 * a visitor can read the whole curriculum, they simply cannot write to it.
 */
import { API } from './api.js';

let current = { user: null, enrollments: [] };

export function setMe(me) {
  current = me ?? { user: null, enrollments: [] };
}

export function me() {
  return current;
}

export function isSignedIn() {
  return Boolean(current.user);
}

export function renderHeader() {
  const slot = document.getElementById('auth-slot');
  if (!slot) return;

  if (!current.user) {
    slot.innerHTML =
      `<a class="auth-signin" href="/api/auth/github">Sign in with GitHub</a>`;
    return;
  }

  const { login, avatarUrl } = current.user;
  slot.innerHTML = `
    ${avatarUrl ? `<img class="auth-avatar" src="${avatarUrl}" alt="">` : ''}
    <span class="auth-login">${login ?? ''}</span>
    <button class="auth-signout" id="auth-signout">Sign out</button>`;

  document.getElementById('auth-signout').addEventListener('click', async () => {
    await API.signout();
    window.location.href = '/';
  });
}
```

- [ ] **Step 3: Teach `src/api.js` that a 401 is not retryable**

In `src/api.js`, replace `request` and `mutate`:

```js
  async request(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401) {
      const err = new Error(`${method} ${path} — 401`);
      err.unauthorized = true;
      throw err;
    }
    if (!res.ok) throw new Error(`${method} ${path} — ${res.status}`);
    return res.json();
  },

  async signout() {
    try { await API.request('POST', '/api/auth/signout'); } catch {}
  },

  // Queue first, then send. If the send fails the entry is already durable.
  async mutate(method, path, body) {
    const outbox = read(OUTBOX, []);
    const entry = { method, path, body, queuedAt: nextId() };
    outbox.push(entry);
    write(OUTBOX, outbox);

    try {
      const result = await API.request(method, path, body);
      API.online = true;
      API.dequeue(entry);
      return result;
    } catch (e) {
      // A 401 is not a retryable failure. Queueing it would mean every tick
      // piles up a write that can never succeed, behind an offline banner
      // that never clears. Drop it and let the caller re-authenticate.
      if (e.unauthorized) {
        API.dequeue(entry);
        API.onUnauthorized?.();
        return null;
      }
      API.online = false;
      return null;
    }
  },
```

and inside `flushOutbox`, replace the `catch` block:

```js
        } catch (e) {
          if (e.unauthorized) {
            API.dequeue(entry);
            API.onUnauthorized?.();
            continue;
          }
          API.online = false;
          break; // preserve order; try again next time
        }
```

Add `onUnauthorized: null,` beside `online: true,` in the `API` object.

- [ ] **Step 4: Disable writing when signed out, in `src/sidebar.js`**

In `openSidebar`, where each step checkbox is rendered, add `disabled` when signed out. Change the two `<input type="checkbox" class="step-checkbox" …>` lines to include:

```js
${isSignedIn() ? '' : 'disabled'}
```

and add the import at the top:

```js
import { isSignedIn } from './auth.js';
```

Also guard the milestone listener registered in `initSidebar`:

```js
  document.addEventListener('change', async e => {
    const cb = e.target.closest('.milestone-checkbox');
    if (!cb) return;
    if (!isSignedIn()) { cb.checked = false; return; }
    await toggle(ctx.pathId, cb.dataset.nodeId, cb.checked);
    refreshTaskBadges();
    window.TODAY?.render();
  });
```

- [ ] **Step 5: Add the styles**

Append to `style.css`:

```css
/* ── Auth ──────────────────────────────────────────────────── */
.auth-slot { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.auth-avatar { width: 20px; height: 20px; border-radius: 50%; }
.auth-login { color: var(--muted2); }
.auth-signin, .auth-signout { font: inherit; font-size: 12px; padding: 5px 12px;
  border: 1px solid var(--border); border-radius: 2px;
  background: rgba(255,255,255,0.06); color: inherit; cursor: pointer; }
.auth-signin:hover, .auth-signout:hover { background: rgba(255,255,255,0.12); }
.signed-out-note { color: var(--muted); font-size: 13px; }
.step-checkbox:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 6: Commit**

```bash
git add src/auth.js src/api.js src/sidebar.js index.html style.css
git commit -m "Add the header, signed-out browsing and 401 handling

A 401 drops the outbox entry rather than queueing it. The outbox retries
forever, so an expired session would otherwise pile up writes that can
never succeed behind an offline banner that never clears — conflating
no network with no longer you is how a card is lost into a queue nobody
drains.

Signed out, the curriculum still renders in full. It is already a public
static asset and it is the thing worth showing; only writing is gated."
```

---

### Task 7: The path picker and the boot branch

**Files:**
- Create: `src/paths-view.js`
- Modify: `src/main.js`, `src/today.js`

**Interfaces:**
- Consumes: `loadCatalogue` from `src/content.js`, `setMe`/`renderHeader`/`isSignedIn` from `src/auth.js`.
- Produces: `renderPaths(catalogue, enrolledIds, onEnrol)` in `src/paths-view.js`, where `enrolledIds` is a `Set` of path ids.

- [ ] **Step 1: Write `src/paths-view.js`**

```js
/**
 * The path picker. A list, deliberately — with one path it is a list of one,
 * and the richer browsing design needs a second path to be honest about.
 */
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderPaths(catalogue, enrolledIds, onEnrol) {
  const list = document.getElementById('paths-list');
  if (!list) return;

  list.innerHTML = (catalogue.paths ?? []).map(p => `
    <div class="path-row">
      <span class="path-title">${esc(p.title)}</span>
      ${enrolledIds.has(p.id)
        ? `<a class="today-review-btn" href="#today">Continue</a>`
        : `<button class="today-review-btn path-enrol" data-path-id="${esc(p.id)}">Enrol</button>`}
    </div>`).join('');

  list.querySelectorAll('.path-enrol').forEach(btn => {
    btn.addEventListener('click', () => onEnrol(btn.dataset.pathId));
  });
}
```

- [ ] **Step 2: Add the styles**

Append to `style.css`:

```css
.path-row { display: flex; align-items: center; justify-content: space-between;
  padding: 12px 0; border-bottom: 1px solid var(--border); }
.path-row:last-child { border-bottom: none; }
.path-title { font-size: 14px; }
```

- [ ] **Step 3: Rewrite `src/main.js` with the boot branch**

```js
/**
 * Vite entry point. Boot resolves one of three states — signed out, signed in
 * without an enrolment, signed in and enrolled — and each renders a different
 * landing view. The path always renders; only writing is gated.
 */
import '../style.css';
import { loadPath, loadCatalogue } from './content.js';
import { indexPath, computeWeights } from './weights.js';
import { setProgressState } from './progress.js';
import { renderPath, renderNav } from './render-path.js';
import { initNav } from './nav.js';
import { initSidebar, CAPTURE_STATE } from './sidebar.js';
import { initToday } from './today.js';
import { renderPaths } from './paths-view.js';
import { setMe, renderHeader, isSignedIn } from './auth.js';
import { API } from './api.js';

const PATH_ID = 'frontier-lab';

function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function boot() {
  // A 401 anywhere flips the header back to signed out rather than leaving a
  // dead session that silently drops every write.
  API.onUnauthorized = () => {
    setMe({ user: null, enrollments: [] });
    renderHeader();
  };

  await API.flushOutbox();

  const me = await API.getMe();
  setMe(me);
  renderHeader();

  const path = await loadPath(PATH_ID);
  const ctx = {
    path,
    pathId: PATH_ID,
    index: indexPath(path),
    weights: computeWeights(path)
  };

  renderPath(path, document.getElementById('phase-views'));
  renderNav(path, document.querySelector('.nav'));
  initSidebar(ctx);

  if (isSignedIn()) {
    setProgressState(await API.getProgress(PATH_ID));
    CAPTURE_STATE.cards = await API.getCards(PATH_ID);
  }

  const enrolled = new Set((me.enrollments ?? []).map(e => e.pathId));
  const catalogue = await loadCatalogue();
  renderPaths(catalogue, enrolled, async pathId => {
    await API.enrol(pathId, localDate(new Date()));
    window.location.hash = '#today';
    window.location.reload();
  });

  initToday(ctx);

  if (!isSignedIn()) {
    window.location.hash = window.location.hash || '#today';
  } else if (!enrolled.has(PATH_ID)) {
    window.location.hash = '#paths';
  }

  initNav();
  await window.TODAY.render();
}

document.addEventListener('DOMContentLoaded', boot);
```

- [ ] **Step 4: Give Today a signed-out state in `src/today.js`**

At the top of `render()`, before anything else:

```js
  async function render() {
    if (!isSignedIn()) {
      el('today-covered').textContent = '—';
      el('today-retained').textContent = '—';
      el('today-due-count').textContent = '0';
      el('today-due-noun').textContent = 'cards';
      el('today-start-review').disabled = true;
      el('today-start-review').textContent = 'Sign in to review';
      el('today-week').innerHTML =
        `<span class="signed-out-note">Sign in with GitHub to track progress and write cards.</span>`;
      el('today-debt').innerHTML =
        `<span class="signed-out-note">Nothing tracked yet.</span>`;
      el('today-retention-pressure').textContent = '';
      el('today-offline').hidden = true;
      return;
    }
    // …existing body unchanged…
```

and add the import:

```js
import { isSignedIn } from './auth.js';
```

- [ ] **Step 5: Build and check it compiles**

```bash
pnpm build
```

Expected: a clean build. A missing export shows up here rather than at runtime.

- [ ] **Step 6: Commit**

```bash
git add src index.html style.css
git commit -m "Add the path picker and the three-state boot

Boot resolves signed out, signed in without an enrolment, and signed in
and enrolled, and each lands somewhere different. The curriculum renders
in every case.

The picker is a list. With one path it is a list of one — it exists now
because it was asked for now, but the richer design waits for a second
path to be honest about."
```

---

### Task 8: Two GitHub apps, and the end-to-end check

**Files:**
- Modify: `wrangler.jsonc`, `README.md`

**Interfaces:**
- Consumes: everything above.

**This task needs two things only you can do:** creating GitHub OAuth apps, and deciding to deploy. Neither should be automated.

- [ ] **Step 1: Create the development GitHub OAuth app**

At <https://github.com/settings/developers> → **New OAuth App**:

- Application name: `frontier-lab-plan (dev)`
- Homepage URL: `http://localhost:8787`
- Authorization callback URL: `http://localhost:8787/api/auth/callback`

Put the client id in `wrangler.jsonc` `vars.GITHUB_CLIENT_ID`, and both the id and a generated client secret in `.dev.vars`.

- [ ] **Step 2: Sign in locally, end to end**

```bash
pnpm db:migrate:local
pnpm validate
pnpm build
pnpm dev:worker
```

Open <http://localhost:8787> and check, in order:

- The curriculum renders **before** signing in, and step checkboxes are disabled
- **Sign in with GitHub** completes and the header shows your avatar and login
- You land on `#paths`; **Enrol** takes you to Today
- Ticking every step of a subtask raises the capture form; the card saves
- **Start review** runs it; grading `again` returns it within the session
- **Sign out** returns the header to signed-out and the checkboxes to disabled

```bash
pnpm wrangler d1 execute frontier-lab --local --json \
  --command "SELECT count(*) AS sessions FROM sessions; SELECT login FROM users WHERE github_id IS NOT NULL"
```

Expected: one session, and your GitHub login.

- [ ] **Step 3: Confirm a signed-out visitor cannot write**

With the browser signed out, in the console:

```js
await fetch('/api/progress', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ pathId: 'frontier-lab', nodeId: 'x', done: true })
}).then(r => r.status);
```

Expected: `401`.

- [ ] **Step 4: Create the production GitHub OAuth app**

Same as Step 1, with the deployed URL for both the homepage and
`…/api/auth/callback`. Then:

```bash
pnpm wrangler secret put GITHUB_CLIENT_SECRET
```

and set the production `GITHUB_CLIENT_ID` and `APP_URL` — either as a second
`env` block in `wrangler.jsonc` or by editing the vars before deploying.

- [ ] **Step 5: Migrate and deploy**

```bash
pnpm db:migrate
pnpm deploy
```

- [ ] **Step 6: Verify on the deployed URL**

Sign in with a **second** GitHub account and confirm it sees none of the first
account's progress or cards. This is the success criterion of the whole
sub-project, and it can only be checked with two real accounts.

- [ ] **Step 7: Update the README**

Replace the **Running it** section's first block with:

````markdown
```sh
pnpm install
cp .dev.vars.example .dev.vars   # then fill in your dev OAuth app credentials
pnpm db:migrate:local
pnpm validate
pnpm build
pnpm dev:worker                  # http://localhost:8787
```

Sign-in needs a GitHub OAuth app whose callback is
`http://localhost:8787/api/auth/callback`. Production needs a second app
pointing at the deployed URL — GitHub allows only one callback per app.
````

And add, under **The one thing to know before editing**:

````markdown
Sessions live in D1 and the table stores a SHA-256 of the cookie token, never
the token. Signing out deletes the row, so a cookie stops working immediately
rather than at expiry.
````

Create `.dev.vars.example` (committed, unlike `.dev.vars`):

```
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

- [ ] **Step 8: Commit**

```bash
git add README.md .dev.vars.example wrangler.jsonc
git commit -m "Document the OAuth setup and ship

Two GitHub apps because GitHub allows one callback URL each, and because
the flow most likely to break is the one you never exercise before
deploying."
```

---

## Verification checklist

- [ ] `pnpm test` — 96 tests: the previous 66 plus crypto, sessions, github, auth and session isolation
- [ ] A protected route 401s with no cookie, an unissued cookie, and an expired session
- [ ] `/api/me` answers `user: null` signed out and the user signed in
- [ ] The callback rejects a missing cookie, a missing parameter and a mismatch, creating no session in any case
- [ ] Signing out makes the same cookie stop working immediately
- [ ] Deleting an account kills its sessions and leaves another account untouched
- [ ] Signed out, the curriculum renders and every checkbox is disabled
- [ ] Two real GitHub accounts on the deployed URL see none of each other's data
