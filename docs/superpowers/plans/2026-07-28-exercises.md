# Exercises Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four graded exercises, run in Colab, whose result gates a step nobody can tick by hand.

**Architecture:** Exercise definitions are imported into the worker bundle. A per-user token, stored hashed, authorises one endpoint. `PUT /api/progress` refuses the graded node outright; only a passing attempt sets it.

**Tech Stack:** Node 24, pnpm, Vite 8, Cloudflare Workers + D1, Vitest, Google Colab. No new dependencies.

## Global Constraints

- **The gate lives in the route.** A disabled checkbox is a courtesy; `curl` is the threat model.
- **`PUT /api/progress` always refuses a graded node**, done true or false. It is set by `POST /api/attempts` and by nothing else.
- **Exercise definitions are imported, never fetched.** `import EXERCISES from '../exercises/index.json'`. Spiked: `env.ASSETS` is bound in the test pool but 404s without `dist/`, which would let an unrelated build failure decide which way the gate fails.
- **Tokens are stored as a SHA-256 hex digest, never in the clear.** A database dump must not hand over working credentials.
- **The token authorises `POST /api/attempts` and nothing else.**
- **Four exercises. No more.** Authoring exercises for the other 154 subtasks is the generated-content problem in a different hat.
- **Say what this proves.** The graded cell is editable; the interface claims "you ran it and it passed", not proof.
- Package manager is pnpm. Node >= 24.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `migrations/0007_exercises.sql` | `attempts` and `exercise_tokens`. |
| `exercises/index.json` | The four definitions. Imported by the worker. |
| `exercises/*.py` | Notebook sources in percent format. |
| `tools/build-notebooks.js` | `.py` → `.ipynb`. Run once, output committed. |
| `worker/routes/attempts.js` | Submission, with its own bearer authentication. |
| `worker/routes/tokens.js` | Mint and revoke. |
| `src/exercise-view.js` | `exerciseHtml` — pure. |
| `test/worker/attempts.test.js`, `test/worker/gate.test.js`, `test/exercise-view.test.js` | |

**Modified:** `worker/db.js`, `worker/routes/progress.js`, `worker/index.js`, `paths/frontier-lab.json`, `tools/validate-path.js`, `test/validate-path.test.js`, `src/api.js`, `src/sidebar.js`, `src/settings-view.js`, `index.html`, `style.css`, `test/dom/harness.js`.

---

### Task 1: Definitions, the graded step, and validation

**Files:**
- Create: `migrations/0007_exercises.sql`, `exercises/index.json`
- Modify: `paths/frontier-lab.json`, `tools/validate-path.js`, `test/validate-path.test.js`

**Interfaces:**
- Produces: `EXERCISES` — a map of exercise id to `{ subtaskId, gatedNodeId, tests, notebook, title }`.

- [ ] **Step 1: Write the migration**

Create `migrations/0007_exercises.sql`:

```sql
-- Every attempt is kept, not only the best. The failures are the interesting
-- record — the same reasoning that keeps the whole review log rather than
-- only the current card state.
CREATE TABLE attempts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  passed      INTEGER NOT NULL,
  total       INTEGER NOT NULL,
  ran_at      INTEGER NOT NULL
);

CREATE INDEX attempts_owner ON attempts(user_id, exercise_id, ran_at);

-- The digest is the primary key: the token itself is never stored, so a
-- database dump hands over no working credentials. One row per user, because
-- minting again replaces rather than accumulates.
CREATE TABLE exercise_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
```

- [ ] **Step 2: Apply it**

```bash
pnpm db:migrate:local
```

- [ ] **Step 3: Write the definitions**

Create `exercises/index.json`. The `gatedNodeId` is the seventh step, appended
in step 4 below:

```json
{
  "word-frequencies": {
    "title": "Word frequencies from an empty file",
    "pathId": "frontier-lab",
    "subtaskId": "p0-python-basics-s04",
    "gatedNodeId": "p0-python-basics-s04-07",
    "notebook": "word-frequencies.ipynb",
    "tests": 5
  },
  "lru-and-fetcher": {
    "title": "Typed LRU cache and a concurrent fetcher",
    "pathId": "frontier-lab",
    "subtaskId": "p0-python-fluency-s05",
    "gatedNodeId": "p0-python-fluency-s05-07",
    "notebook": "lru-and-fetcher.ipynb",
    "tests": 6
  },
  "attention-einsum": {
    "title": "Attention in einsum",
    "pathId": "frontier-lab",
    "subtaskId": "p0-numpy-s03",
    "gatedNodeId": "p0-numpy-s03-07",
    "notebook": "attention-einsum.ipynb",
    "tests": 5
  },
  "autograd-from-memory": {
    "title": "Scalar autograd from memory",
    "pathId": "frontier-lab",
    "subtaskId": "p1-karpathy-hero-s04",
    "gatedNodeId": "p1-karpathy-hero-s04-07",
    "notebook": "autograd-from-memory.ipynb",
    "tests": 6
  }
}
```

`pathId` is present from the start because Task 4 writes progress with it, and
progress rows are meaningless without one. `validateExercises` requires it in
step 7 below.

- [ ] **Step 4: Append the graded step to each of the four subtasks**

Write `/tmp/add-steps.mjs` and run it with `node`:

```js
import fs from 'node:fs';
const F = 'paths/frontier-lab.json';
const p = JSON.parse(fs.readFileSync(F, 'utf8'));
const EX = JSON.parse(fs.readFileSync('exercises/index.json', 'utf8'));

const bySubtask = new Map(
  Object.entries(EX).map(([id, e]) => [e.subtaskId, { id, ...e }]));

let added = 0;
for (const ph of p.phases) for (const t of ph.tasks) for (const s of t.subtasks ?? []) {
  const ex = bySubtask.get(s.id);
  if (!ex) continue;
  if (s.steps.some(st => st.id === ex.gatedNodeId)) continue;   // idempotent
  s.steps.push({
    id: ex.gatedNodeId,
    text: 'The graded suite passes. This one is not yours to tick — '
        + 'run the notebook and it ticks itself.'
  });
  added++;
}
fs.writeFileSync(F, JSON.stringify(p, null, 2) + '\n');
console.log('appended', added, 'graded steps');
```

Expected: `appended 4 graded steps`. Appending ids is safe — the validator's
append-only rule forbids removing ids, not adding them.

- [ ] **Step 5: Write the failing validator tests**

Append inside the existing `describe` in `test/validate-path.test.js`:

```js
  it('rejects an exercise whose gated step is not in the path', () => {
    const problems = validateExercises(valid(),
      { ghost: { subtaskId: 't1-s01', gatedNodeId: 'nope-07', tests: 1 } });
    expect(problems.join()).toMatch(/nope-07/);
  });

  it('rejects an exercise whose subtask is not in the path', () => {
    const problems = validateExercises(valid(),
      { ghost: { subtaskId: 'gone', gatedNodeId: 't1-s01-01', tests: 1 } });
    expect(problems.join()).toMatch(/gone/);
  });

  it('rejects a test count that is not a positive integer', () => {
    const problems = validateExercises(valid(),
      { ghost: { subtaskId: 't1-s01', gatedNodeId: 't1-s01-01', tests: 0 } });
    expect(problems.join()).toMatch(/tests/i);
  });

  it('rejects two exercises claiming the same gated step', () => {
    const problems = validateExercises(valid(), {
      a: { subtaskId: 't1-s01', gatedNodeId: 't1-s01-01', tests: 1 },
      b: { subtaskId: 't1-s01', gatedNodeId: 't1-s01-01', tests: 1 }
    });
    expect(problems.join()).toMatch(/twice|duplicate/i);
  });

  it('accepts a well-formed exercise', () => {
    expect(validateExercises(valid(),
      { ok: { subtaskId: 't1-s01', gatedNodeId: 't1-s01-01', tests: 3 } })).toEqual([]);
  });
```

Add `validateExercises` to the import at the top of that file.

- [ ] **Step 6: Run and watch them fail**

```bash
pnpm vitest run test/validate-path.test.js
```

Expected: FAIL — `validateExercises` is not exported.

- [ ] **Step 7: Implement it in `tools/validate-path.js`**

```js
/**
 * Cross-checks the exercise definitions against the path. Separate from
 * validatePath because exercises are a different file with a different
 * lifecycle, and a path without them stays valid.
 */
export function validateExercises(p, exercises) {
  const problems = [];
  const subtasks = new Set();
  const steps = new Set();

  for (const ph of p.phases ?? []) {
    for (const t of ph.tasks ?? []) {
      for (const s of t.subtasks ?? []) {
        subtasks.add(s.id);
        for (const st of s.steps ?? []) steps.add(st.id);
      }
    }
  }

  const claimed = new Map();
  for (const [id, e] of Object.entries(exercises ?? {})) {
    if (!subtasks.has(e.subtaskId)) {
      problems.push(`${id}: no such subtask "${e.subtaskId}"`);
    }
    // The gate hangs off this id. If it does not exist, the exercise silently
    // gates nothing at all and the whole feature is decoration.
    if (!steps.has(e.gatedNodeId)) {
      problems.push(`${id}: no such step "${e.gatedNodeId}"`);
    }
    if (!Number.isInteger(e.tests) || e.tests < 1) {
      problems.push(`${id}: tests must be a positive integer`);
    }
    // Progress rows are keyed by path. Without this the gate would write a
    // row nothing ever reads back.
    if (!e.pathId) problems.push(`${id}: pathId is required`);
    if (claimed.has(e.gatedNodeId)) {
      problems.push(
        `${e.gatedNodeId} is claimed twice: ${claimed.get(e.gatedNodeId)} and ${id}`);
    }
    claimed.set(e.gatedNodeId, id);
  }

  return problems;
}
```

Then call it from the CLI section of the same file, beside the existing
per-path validation, reading `exercises/index.json` if it is present. A missing
file is not an error — a path with no exercises is valid.

- [ ] **Step 8: Run everything**

```bash
pnpm vitest run test/validate-path.test.js && pnpm validate && pnpm build
```

Expected: PASS, `OK — 1 path(s)`, clean build.

- [ ] **Step 9: Commit**

```bash
git add migrations/0007_exercises.sql exercises/index.json paths/frontier-lab.json tools/validate-path.js test/validate-path.test.js
git commit -m "Define four exercises and the step each one gates

Each of the four subtasks gains a seventh step whose text is a verdict
rather than an instruction. Its six existing steps stay self-judged,
which is right — the app should not pretend to know whether you read
something.

The validator refuses an exercise whose gated step does not exist. That
is the failure that matters: an exercise pointing at a missing id gates
nothing and the whole feature becomes decoration that reads as working.

Tokens are stored as a digest. A database dump must hand over no working
credentials."
```

---

### Task 2: Queries and the token routes

**Files:**
- Modify: `worker/db.js`, `worker/index.js`
- Create: `worker/routes/tokens.js`, `test/worker/tokens.test.js`

**Interfaces:**
- Produces:
  - `hashToken(raw) -> Promise<string>` — SHA-256 hex, exported from `worker/routes/tokens.js`
  - `upsertToken(env, userId, hash, now)`, `deleteToken(env, userId)`
  - `userIdForToken(env, hash) -> string | null`
  - `insertAttempt(env, attempt)`, `listAttempts(env, userId)`, `hasPassingAttempt(env, userId, exerciseId) -> boolean`

- [ ] **Step 1: Add the queries to `worker/db.js`**

```js
export async function upsertToken(env, userId, hash, now) {
  // One token per user: minting again replaces rather than accumulates, so a
  // token you thought you rotated away cannot still be live.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM exercise_tokens WHERE user_id = ?').bind(userId),
    env.DB.prepare(
      'INSERT INTO exercise_tokens (token_hash, user_id, created_at) VALUES (?, ?, ?)'
    ).bind(hash, userId, now)
  ]);
}

export async function deleteToken(env, userId) {
  const { meta } = await env.DB
    .prepare('DELETE FROM exercise_tokens WHERE user_id = ?').bind(userId).run();
  return meta.changes > 0;
}

export async function userIdForToken(env, hash) {
  const row = await env.DB
    .prepare('SELECT user_id FROM exercise_tokens WHERE token_hash = ?')
    .bind(hash).first();
  return row?.user_id ?? null;
}

export async function insertAttempt(env, attempt) {
  await env.DB.prepare(
    `INSERT INTO attempts (id, user_id, exercise_id, passed, total, ran_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(attempt.id, attempt.user_id, attempt.exercise_id,
         attempt.passed, attempt.total, attempt.ran_at).run();
  return attempt;
}

export async function listAttempts(env, userId) {
  const { results } = await env.DB
    .prepare('SELECT * FROM attempts WHERE user_id = ? ORDER BY ran_at DESC')
    .bind(userId).all();
  return results;
}

export async function hasPassingAttempt(env, userId, exerciseId) {
  const row = await env.DB.prepare(
    `SELECT 1 AS ok FROM attempts
     WHERE user_id = ? AND exercise_id = ? AND passed >= total LIMIT 1`
  ).bind(userId, exerciseId).first();
  return Boolean(row);
}
```

D1 has no interactive transactions, so `upsertToken` uses `batch()` — the same
constraint Better Auth works under.

- [ ] **Step 2: Write the failing token tests**

Create `test/worker/tokens.test.js`:

```js
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, signUp } from '../helpers.js';

let COOKIE;
const api = (path, init = {}) => SELF.fetch(`https://x${path}`, {
  ...init, headers: { ...(init.headers ?? {}), cookie: COOKIE }
});

describe('exercise tokens', () => {
  beforeEach(async () => {
    await resetDb();
    COOKIE = await signUp();
  });

  it('mints a token and returns it exactly once', async () => {
    const res = await api('/api/exercise-token', { method: 'POST' });
    expect(res.status).toBe(200);

    const { token } = await res.json();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });

  it('never stores the token in the clear', async () => {
    const { token } = await (await api('/api/exercise-token', { method: 'POST' })).json();

    const { results } = await env.DB.prepare('SELECT * FROM exercise_tokens').all();
    expect(results).toHaveLength(1);
    // The digest, not the secret. A database dump must hand over nothing usable.
    expect(JSON.stringify(results)).not.toContain(token);
  });

  it('replaces rather than accumulates, so a rotated token cannot still be live', async () => {
    await api('/api/exercise-token', { method: 'POST' });
    await api('/api/exercise-token', { method: 'POST' });

    const { results } = await env.DB.prepare('SELECT * FROM exercise_tokens').all();
    expect(results).toHaveLength(1);
  });

  it('revokes', async () => {
    await api('/api/exercise-token', { method: 'POST' });
    expect((await api('/api/exercise-token', { method: 'DELETE' })).status).toBe(200);

    const { results } = await env.DB.prepare('SELECT * FROM exercise_tokens').all();
    expect(results).toHaveLength(0);
  });

  it('answers 401 to a stranger', async () => {
    const res = await SELF.fetch('https://x/api/exercise-token', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run and watch it fail**

```bash
pnpm vitest run test/worker/tokens.test.js
```

Expected: FAIL — no such route.

- [ ] **Step 4: Write `worker/routes/tokens.js`**

```js
import { json, error } from '../http.js';
import { upsertToken, deleteToken } from '../db.js';

const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * SHA-256 hex. The token is shown once and then only its digest exists, so
 * losing the database loses no working credential.
 */
export async function hashToken(raw) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function mint(request, env, user) {
  const raw = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await upsertToken(env, user.id, await hashToken(raw), Date.now());

  // Returned once and never again: there is nothing to return it from later.
  return json({ token: raw });
}

export async function revoke(request, env, user) {
  await deleteToken(env, user.id);
  return json({ ok: true });
}
```

- [ ] **Step 5: Mount them**

In `worker/index.js`, add the import and two route entries beside the others:

```js
import * as tokens from './routes/tokens.js';
```

```js
  ['POST', '/api/exercise-token', tokens.mint],
  ['DELETE', '/api/exercise-token', tokens.revoke],
```

- [ ] **Step 6: Run the tests**

```bash
pnpm vitest run test/worker/tokens.test.js
```

Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add worker/db.js worker/routes/tokens.js worker/index.js test/worker/tokens.test.js
git commit -m "Mint and revoke exercise tokens, stored as a digest

The token is returned once and only its SHA-256 survives, so losing the
database loses no working credential. A test asserts the raw token
appears nowhere in the table.

Minting replaces rather than accumulates: a token you believed you had
rotated away must not still be live."
```

---

### Task 3: Submission, with its own authentication

**Files:**
- Create: `worker/routes/attempts.js`, `test/worker/attempts.test.js`
- Modify: `worker/index.js`

**Interfaces:**
- Consumes: `hashToken` from Task 2, `userIdForToken`, `insertAttempt`, `listAttempts`.
- Produces: `POST /api/attempts` (bearer token), `GET /api/attempts` (session).
- Request body: `{ exerciseId, passed, total }`.

- [ ] **Step 1: Write the failing tests**

Create `test/worker/attempts.test.js`:

```js
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, signUp } from '../helpers.js';

let COOKIE, TOKEN;

const api = (path, init = {}) => SELF.fetch(`https://x${path}`, {
  ...init, headers: { ...(init.headers ?? {}), cookie: COOKIE }
});

const submit = (body, token = TOKEN) => SELF.fetch('https://x/api/attempts', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {})
  },
  body: JSON.stringify(body)
});

const RUN = { exerciseId: 'attention-einsum', passed: 5, total: 5 };

describe('attempts', () => {
  beforeEach(async () => {
    await resetDb();
    COOKIE = await signUp();
    TOKEN = (await (await api('/api/exercise-token', { method: 'POST' })).json()).token;
  });

  it('records a run and lists it back', async () => {
    expect((await submit(RUN)).status).toBe(201);

    const { attempts } = await (await api('/api/attempts')).json();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].passed).toBe(5);
  });

  it('records a failing run too, because the failures are the record', async () => {
    expect((await submit({ ...RUN, passed: 2 })).status).toBe(201);

    const { attempts } = await (await api('/api/attempts')).json();
    expect(attempts[0].passed).toBe(2);
  });

  it('refuses a missing token', async () => {
    expect((await submit(RUN, null)).status).toBe(401);
  });

  it('refuses an unknown token', async () => {
    expect((await submit(RUN, 'not-a-real-token')).status).toBe(401);
  });

  it('refuses after the token is revoked', async () => {
    await api('/api/exercise-token', { method: 'DELETE' });
    expect((await submit(RUN)).status).toBe(401);
  });

  it('refuses an unknown exercise id, rather than recording a phantom', async () => {
    expect((await submit({ ...RUN, exerciseId: 'no-such-exercise' })).status).toBe(400);
  });

  it('refuses a passed count above the total', async () => {
    expect((await submit({ ...RUN, passed: 99 })).status).toBe(400);
  });

  it('refuses a total that disagrees with the definition', async () => {
    // Otherwise a notebook reporting 1/1 would satisfy a five-test exercise.
    expect((await submit({ ...RUN, passed: 1, total: 1 })).status).toBe(400);
  });

  it('records against the token owner and nobody else', async () => {
    const otherCookie = await signUp('bob@example.com');
    await submit(RUN);

    const forBob = await (await SELF.fetch('https://x/api/attempts',
      { headers: { cookie: otherCookie } })).json();
    expect(forBob.attempts).toHaveLength(0);
  });

  it('answers 401 to a session-less list', async () => {
    expect((await SELF.fetch('https://x/api/attempts')).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
pnpm vitest run test/worker/attempts.test.js
```

Expected: FAIL — no such route.

- [ ] **Step 3: Write `worker/routes/attempts.js`**

```js
import { json, error } from '../http.js';
import { userIdForToken, insertAttempt, listAttempts, newId } from '../db.js';
import { hashToken } from './tokens.js';
import EXERCISES from '../../exercises/index.json';

/**
 * The only route in this app that authenticates by something other than a
 * session. It is registered as public so the router does not demand a cookie,
 * and then does its own bearer check here — which must be obvious rather than
 * incidental, because "public" in the route table would otherwise read as
 * "unauthenticated".
 */
export async function create(request, env) {
  const header = request.headers.get('authorization') ?? '';
  const raw = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!raw) return error('an exercise token is required', 401);

  const userId = await userIdForToken(env, await hashToken(raw));
  if (!userId) return error('unknown or revoked token', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('body is not valid JSON', 400);
  }

  const definition = EXERCISES[body.exerciseId];
  if (!definition) return error('no such exercise', 400);

  const { passed, total } = body;
  if (!Number.isInteger(passed) || !Number.isInteger(total)) {
    return error('passed and total must be integers', 400);
  }
  if (passed < 0 || passed > total) return error('passed must be within total', 400);
  // Without this a notebook reporting 1/1 would satisfy a five-test exercise.
  if (total !== definition.tests) {
    return error(`this exercise has ${definition.tests} tests`, 400);
  }

  const attempt = {
    id: newId(),
    user_id: userId,
    exercise_id: body.exerciseId,
    passed,
    total,
    ran_at: Date.now()
  };
  await insertAttempt(env, attempt);

  return json({ attempt }, 201);
}

export async function list(request, env, user) {
  return json({ attempts: await listAttempts(env, user.id) });
}
```

- [ ] **Step 4: Mount them**

In `worker/index.js`:

```js
import * as attempts from './routes/attempts.js';
```

```js
  // Public in this table only because it carries a bearer token instead of a
  // cookie. attempts.create does its own authentication.
  ['POST', '/api/attempts', attempts.create, true],
  ['GET', '/api/attempts', attempts.list],
```

- [ ] **Step 5: Run the tests**

```bash
pnpm vitest run test/worker/attempts.test.js
```

Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add worker/routes/attempts.js worker/index.js test/worker/attempts.test.js
git commit -m "Accept exercise submissions against a bearer token

The only route here that authenticates by something other than a
session. It is public in the route table purely so the router does not
demand a cookie, and the bearer check is the first thing in the handler
where nobody can miss it.

The reported total must match the definition. Without that check a
notebook reporting one test out of one would satisfy a five-test
exercise, which is the cheapest possible way to defeat the gate."
```

---

### Task 4: The gate

**Files:**
- Modify: `worker/routes/progress.js`
- Create: `test/worker/gate.test.js`

**Interfaces:**
- Consumes: `EXERCISES`, `hasPassingAttempt`.
- Produces: `PUT /api/progress` answers 409 for a graded node; `POST /api/attempts` sets it when `passed >= total`.

**This is the task that matters.** Everything before it is plumbing and
everything after it is display.

- [ ] **Step 1: Write the failing tests**

Create `test/worker/gate.test.js`:

```js
import { SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, signUp } from '../helpers.js';
import EXERCISES from '../../exercises/index.json';

const EX = 'attention-einsum';
const GATED = EXERCISES[EX].gatedNodeId;
const TESTS = EXERCISES[EX].tests;
const ORDINARY = 'p0-numpy-s03-01';

let COOKIE, TOKEN;

const api = (path, init = {}) => SELF.fetch(`https://x${path}`, {
  ...init,
  headers: { ...(init.headers ?? {}), cookie: COOKIE, 'content-type': 'application/json' }
});

const tick = (nodeId, done = true) => api('/api/progress', {
  method: 'PUT',
  body: JSON.stringify({ pathId: 'frontier-lab', nodeId, done })
});

const submit = (passed) => SELF.fetch('https://x/api/attempts', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({ exerciseId: EX, passed, total: TESTS })
});

const done = async () =>
  (await (await api('/api/progress?pathId=frontier-lab')).json()).nodeIds;

describe('the exercise gate', () => {
  beforeEach(async () => {
    await resetDb();
    COOKIE = await signUp();
    TOKEN = (await (await api('/api/exercise-token', { method: 'POST' })).json()).token;
  });

  it('refuses to tick a graded step, even from a valid signed-in session', async () => {
    // The whole point. The disabled checkbox is a courtesy; curl is the threat.
    expect((await tick(GATED)).status).toBe(409);
    expect(await done()).not.toContain(GATED);
  });

  it('refuses to untick it too, so it cannot be cleared by hand', async () => {
    expect((await tick(GATED, false)).status).toBe(409);
  });

  it('still accepts every ordinary step, which is 154 of 158 subtasks', async () => {
    expect((await tick(ORDINARY)).status).toBe(200);
    expect(await done()).toContain(ORDINARY);
  });

  it('does not tick the step on a failing attempt', async () => {
    expect((await submit(TESTS - 1)).status).toBe(201);
    expect(await done()).not.toContain(GATED);
  });

  it('ticks the step on a passing attempt', async () => {
    expect((await submit(TESTS)).status).toBe(201);
    expect(await done()).toContain(GATED);
  });

  it('leaves it ticked after a later failing attempt, because it was earned', async () => {
    await submit(TESTS);
    await submit(0);
    expect(await done()).toContain(GATED);
  });

  it('ticks it for the token owner and for nobody else', async () => {
    const bob = await signUp('bob@example.com');
    await submit(TESTS);

    const forBob = await (await SELF.fetch(
      'https://x/api/progress?pathId=frontier-lab', { headers: { cookie: bob } })).json();
    expect(forBob.nodeIds).not.toContain(GATED);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
pnpm vitest run test/worker/gate.test.js
```

Expected: FAIL — the first test gets 200; the route ticks whatever it is told.

- [ ] **Step 3: Add the refusal to `worker/routes/progress.js`**

Add the import:

```js
import EXERCISES from '../../exercises/index.json';
```

and a lookup beside `str`:

```js
// Imported, not fetched. env.ASSETS 404s without a build, which would let an
// unrelated build failure decide which way this gate fails.
const GATED = new Set(Object.values(EXERCISES).map(e => e.gatedNodeId));
```

Then, in `set`, immediately after the body validation:

```js
  // Refused in both directions. This node is set by a passing attempt and by
  // nothing else, so there is no legitimate request to allow through here.
  if (GATED.has(nodeId)) {
    return error('this step is set by the graded suite, not by hand', 409);
  }
```

- [ ] **Step 4: Make a passing attempt set it**

In `worker/routes/attempts.js`, add `setProgress` to the `../db.js` import, and
after `insertAttempt`:

```js
  // The only writer of a gated node. `passed >= total` rather than equality:
  // total is already pinned to the definition above.
  if (passed >= total) {
    await setProgress(env, userId, definition.pathId,
      definition.gatedNodeId, true, attempt.ran_at);
  }
```

`definition.pathId` with no fallback: the validator already refuses a
definition without one, so a default here would only hide a broken file.

- [ ] **Step 5: Run the tests**

```bash
pnpm vitest run test/worker/gate.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Run the whole suite**

```bash
pnpm test
```

Expected: everything passes. If an older progress test ticked one of the four
gated ids it will now 409 — that is the gate working, so change the test to use
an ordinary step.

- [ ] **Step 7: Commit**

```bash
git add worker/routes/progress.js worker/routes/attempts.js exercises/index.json tools/validate-path.js test/worker/gate.test.js
git commit -m "Gate the graded step in the route, not the interface

PUT /api/progress refuses a graded node in both directions. It is set by
a passing attempt and by nothing else, so there is no legitimate request
to let through.

The test that matters asserts the refusal for a well-formed, fully
authenticated session. A gate that only greys out a checkbox is theatre
when the app is hosted and curl still works.

Once earned it stays: a later failing attempt does not clear it."
```

---

### Task 5: The notebooks

**Files:**
- Create: `exercises/*.py`, `tools/build-notebooks.js`, `exercises/*.ipynb`

**Interfaces:**
- Produces: one `.ipynb` per exercise, committed, opened from GitHub by Colab.

- [ ] **Step 1: Write the builder**

Notebooks are JSON with escaped source arrays, which is unreadable and
unreviewable in a diff. The sources are written in the percent format — plain
Python, `# %%` between cells — and converted.

Create `tools/build-notebooks.js`:

```js
#!/usr/bin/env node
/**
 * exercises/<id>.py  ->  exercises/<id>.ipynb
 *
 * Notebooks are JSON holding arrays of escaped source lines: unreadable in a
 * diff and unpleasant to edit by hand. The real source is percent-format
 * Python, which is a normal file you can run and review.
 *
 * Run once after editing a source: node tools/build-notebooks.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'exercises');

const cellsOf = (text) => text
  .split(/^# %%/m)
  .map(chunk => chunk.trim())
  .filter(Boolean)
  .map(chunk => {
    const markdown = chunk.startsWith('[markdown]');
    const body = markdown ? chunk.slice('[markdown]'.length).trim() : chunk;
    const source = (markdown ? body.replace(/^# ?/gm, '') : body)
      .split('\n').map((l, i, a) => i === a.length - 1 ? l : l + '\n');
    return markdown
      ? { cell_type: 'markdown', metadata: {}, source }
      : { cell_type: 'code', metadata: {}, source, outputs: [], execution_count: null };
  });

let built = 0;
for (const file of fs.readdirSync(DIR).filter(f => f.endsWith('.py'))) {
  const cells = cellsOf(fs.readFileSync(path.join(DIR, file), 'utf8'));
  const nb = {
    cells,
    metadata: {
      kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
      language_info: { name: 'python' }
    },
    nbformat: 4,
    nbformat_minor: 5
  };
  fs.writeFileSync(
    path.join(DIR, file.replace(/\.py$/, '.ipynb')),
    JSON.stringify(nb, null, 1) + '\n');
  built++;
}
console.log(`built ${built} notebooks`);
```

- [ ] **Step 2: Write the first exercise source**

Create `exercises/attention-einsum.py`:

```python
# %% [markdown]
# # Attention in einsum
#
# Implement scaled dot-product attention with a causal mask, using only
# `np.einsum` and `np.exp`. It is checked against PyTorch to 1e-5.
#
# Passing requires that you can say aloud what every index letter denotes.
# Nothing here checks that, and it is still the point.

# %%
# Paste your token from Settings. It authorises this one endpoint and nothing
# else, so a shared notebook leaks nothing but the ability to record attempts.
TOKEN = ""
APP = "https://halflife.getravi.workers.dev"

# %%
import numpy as np

def attention(Q, K, V):
    """Q, K, V are (B, H, T, D). Return (B, H, T, D), causally masked."""
    raise NotImplementedError

# %%
# ---- graded cell: run it, do not edit it ----
import torch, requests, json

def _grade():
    results = []
    rng = np.random.default_rng(0)
    B, H, T, D = 2, 3, 5, 4
    q, k, v = (rng.standard_normal((B, H, T, D)).astype(np.float32) for _ in range(3))

    try:
        out = attention(q, k, v)
        results.append(("returns an array", isinstance(out, np.ndarray)))
        results.append(("keeps the shape", out.shape == (B, H, T, D)))
    except Exception:
        return [("runs at all", False)]

    ref = torch.nn.functional.scaled_dot_product_attention(
        torch.tensor(q), torch.tensor(k), torch.tensor(v), is_causal=True).numpy()
    results.append(("matches PyTorch to 1e-5", np.allclose(out, ref, atol=1e-5)))

    single = attention(q[:, :, :1], k[:, :, :1], v[:, :, :1])
    results.append(("row 0 is one-hot on position 0",
                    np.allclose(single, v[:, :, :1], atol=1e-5)))

    big = q * 50.0
    results.append(("stays finite on large inputs",
                    np.all(np.isfinite(attention(big, k, v)))))
    return results

_r = _grade()
for name, ok in _r:
    print(("PASS  " if ok else "FAIL  ") + name)

_passed = sum(1 for _, ok in _r if ok)
print(f"\n{_passed}/{len(_r)}")

if TOKEN:
    resp = requests.post(
        f"{APP}/api/attempts",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={"exerciseId": "attention-einsum", "passed": _passed, "total": len(_r)})
    print("submitted:", resp.status_code, resp.text[:200])
else:
    print("no TOKEN set — nothing was submitted")
```

- [ ] **Step 3: Write the other three sources**

**This step is a specification, not code, and that is a real gap in this plan.**
Each notebook is roughly eighty lines of Python. Step 2 above is a complete
worked template — same three-part shape, same graded-cell structure, same
submit block — and what follows fixes each assertion precisely. Whoever
implements this writes the Python; nothing here can be pasted.

The assertion counts must match `exercises/index.json` exactly, or every
submission is rejected by the total check from Task 3.

`exercises/word-frequencies.py` — 5 assertions on a `top_words(path, n)`:
returns a list of `(word, count)`; sorted by count descending; ties broken
alphabetically; case-folded; **raises a clear error on a missing path rather
than returning an empty list**, which is the case the subtask title names.

`exercises/lru-and-fetcher.py` — 6 assertions: the cache returns a hit without
recomputing; evicts least-recently-used at capacity; a `get` counts as a use;
`fetch_all` runs concurrently (elapsed well under the serial sum); it respects
its concurrency bound; and one failing item does not sink the batch.

`exercises/autograd-from-memory.py` — 6 assertions on `Value`: add, multiply
and `tanh` forward correctly; `backward()` matches PyTorch on a simple graph;
**`b = a * a` gives `db/da = 2a`**, the reused-node case the subtask calls the
whole test; a deeper graph with a node reused twice matches PyTorch; and
gradients accumulate rather than overwrite.

- [ ] **Step 4: Build and check the output opens**

```bash
node tools/build-notebooks.js
node -e "const n=require('./exercises/attention-einsum.ipynb'); console.log(n.nbformat, n.cells.length, n.cells.map(c=>c.cell_type).join(','))"
```

Expected: `built 4 notebooks`, then `4 4 markdown,code,code,code`.

- [ ] **Step 5: Commit**

```bash
git add tools/build-notebooks.js exercises/
git commit -m "Add the four exercise notebooks

Written as percent-format Python and converted, because a .ipynb is JSON
holding arrays of escaped source lines — unreadable in a diff and
unpleasant to edit. The .py file is the source you can actually run.

The graded cell says not to edit it and cannot stop you. That is the
honest position: this records that you ran it and it passed, which is
not proof, and the interface says so rather than implying more."
```

---

### Task 6: The interface

**Files:**
- Create: `src/exercise-view.js`, `test/exercise-view.test.js`
- Modify: `src/api.js`, `src/sidebar.js`, `src/settings-view.js`, `index.html`, `style.css`, `test/dom/harness.js`

**Interfaces:**
- Produces:
  - `exerciseHtml(exercise, attempts, ctx) -> string`
  - `ATTEMPTS_STATE = { attempts: [] }`
  - `API.getAttempts()`, `API.mintToken()`, `API.revokeToken()`

- [ ] **Step 1: Write the failing tests**

Create `test/exercise-view.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { exerciseHtml } from '../src/exercise-view.js';

const ex = {
  id: 'attention-einsum',
  title: 'Attention in einsum',
  notebook: 'attention-einsum.ipynb',
  tests: 5
};

describe('exerciseHtml', () => {
  it('links to Colab for this repository', () => {
    const html = exerciseHtml(ex, [], 1000);
    expect(html).toContain('colab.research.google.com/github/getravi/halflife');
    expect(html).toContain('attention-einsum.ipynb');
  });

  it('says it has never been run, rather than showing a blank score', () => {
    expect(exerciseHtml(ex, [], 1000)).toMatch(/not run yet/i);
  });

  it('shows the most recent attempt', () => {
    const attempts = [
      { exercise_id: 'attention-einsum', passed: 3, total: 5, ran_at: 900 },
      { exercise_id: 'attention-einsum', passed: 5, total: 5, ran_at: 500 }
    ];
    expect(exerciseHtml(ex, attempts, 1000)).toContain('3 / 5');
  });

  it('ignores attempts belonging to another exercise', () => {
    const attempts = [{ exercise_id: 'something-else', passed: 1, total: 1, ran_at: 900 }];
    expect(exerciseHtml(ex, attempts, 1000)).toMatch(/not run yet/i);
  });

  it('marks it passed once any attempt has passed', () => {
    const attempts = [
      { exercise_id: 'attention-einsum', passed: 2, total: 5, ran_at: 900 },
      { exercise_id: 'attention-einsum', passed: 5, total: 5, ran_at: 500 }
    ];
    // Earned is earned: the newest attempt failing does not un-pass it.
    expect(exerciseHtml(ex, attempts, 1000)).toMatch(/passed/i);
  });

  it('states what a pass actually proves', () => {
    const attempts = [{ exercise_id: 'attention-einsum', passed: 5, total: 5, ran_at: 900 }];
    expect(exerciseHtml(ex, attempts, 1000)).toMatch(/you ran it/i);
  });

  it('escapes markup in a title', () => {
    const evil = { ...ex, title: '<img src=x onerror=alert(1)>' };
    expect(exerciseHtml(evil, [], 1000)).not.toContain('<img src=x');
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
pnpm vitest run test/exercise-view.test.js
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write `src/exercise-view.js`**

```js
/**
 * The exercise panel. Pure string builder, mounted by the sidebar.
 */
const REPO = 'getravi/halflife';

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const ago = (ms, now) => {
  const days = Math.floor((now - ms) / 86400000);
  if (days <= 0) return 'today';
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

export function exerciseHtml(exercise, attempts, now) {
  const mine = (attempts ?? [])
    .filter(a => a.exercise_id === exercise.id)
    .sort((a, b) => b.ran_at - a.ran_at);

  const latest = mine[0];
  const passed = mine.some(a => a.passed >= a.total);

  const url = `https://colab.research.google.com/github/${REPO}`
    + `/blob/main/exercises/${encodeURIComponent(exercise.notebook)}`;

  const status = !latest
    ? `<span class="exercise-pending">Not run yet</span>`
    : `<span class="${passed ? 'exercise-passed' : 'exercise-failed'}">${
        latest.passed} / ${latest.total}${passed ? ' · passed' : ''}</span>
       <span class="exercise-when">${esc(ago(latest.ran_at, now))}</span>`;

  return `<div class="sidebar-section exercise-block">
    <div class="sidebar-section-title">Graded exercise</div>
    <div class="exercise-name">${esc(exercise.title)}</div>
    <div class="exercise-status">${status}</div>
    <a class="today-review-btn" href="${url}" target="_blank" rel="noopener">
      Open in Colab</a>
    <p class="settings-note">The graded cell is editable, so a pass records
      that you ran it and it passed. It is not proof, and pretending otherwise
      would make it worth less than nothing.</p>
  </div>`;
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run test/exercise-view.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Add the API methods**

In `src/api.js`, beside the note methods:

```js
    async getAttempts() {
      try {
        const { attempts } = await API.request('GET', '/api/attempts');
        API.online = true;
        write(CACHE_ATTEMPTS, attempts);
        return attempts;
      } catch {
        API.online = false;
        return read(CACHE_ATTEMPTS, []);
      }
    },

    // Not an outbox mutation: a token you never saw is worse than an error,
    // and there is nothing to replay.
    async mintToken() {
      return API.request('POST', '/api/exercise-token');
    },

    async revokeToken() {
      return API.request('DELETE', '/api/exercise-token');
    },
```

with `const CACHE_ATTEMPTS = 'flp_cache_attempts';` beside the other keys.

- [ ] **Step 6: Wire the sidebar**

In `src/sidebar.js`, import the view and the definitions:

```js
import { exerciseHtml } from './exercise-view.js';
import EXERCISES from '../exercises/index.json';

export const ATTEMPTS_STATE = { attempts: [] };

const EXERCISE_FOR = new Map(
  Object.entries(EXERCISES).map(([id, e]) => [e.subtaskId, { id, ...e }]));
```

In `openSidebar`, after the prerequisites and before the steps:

```js
  const exercise = EXERCISE_FOR.get(s.id);
  if (exercise && isSignedIn()) {
    html += exerciseHtml(exercise, ATTEMPTS_STATE.attempts, Date.now());
  }
```

The graded step's checkbox must also refuse the click. In the step loop, add
`disabled` when the step is gated:

```js
      const gated = exercise?.gatedNodeId === st.id;
```

and render `${isSignedIn() && !gated ? '' : 'disabled'}` in place of the
existing disabled expression for that input. A gated box that is ticked still
shows ticked — it is disabled, not hidden.

In `src/main.js`, extend the existing sidebar import and load the attempts
inside the signed-in branch, clearing them in the `else` beside the cards and
notes:

```js
import { initSidebar, CAPTURE_STATE, ATTEMPTS_STATE } from './sidebar.js';
```

```js
    ATTEMPTS_STATE.attempts = await API.getAttempts();
```

```js
    ATTEMPTS_STATE.attempts = [];   // in the else, for the reason the others are cleared
```

- [ ] **Step 7: Add the token panel to Settings**

In `index.html`, inside the account view above the export block:

```html
<section class="today-block">
  <div class="today-block-title">Exercise token</div>
  <p class="settings-note">Paste this into an exercise notebook. It can record
    attempts and do nothing else — a notebook is a document you might share.</p>
  <div class="settings-actions">
    <button class="capture-skip" id="token-mint">Create a new token</button>
    <button class="capture-skip" id="token-revoke">Revoke</button>
    <span class="capture-status" id="token-status"></span>
  </div>
  <input class="capture-input" id="token-value" readonly hidden>
</section>
```

In `src/settings-view.js`, inside `renderSettings`:

```js
  // Shown once. Only its digest is stored, so there is nothing to show later.
  document.getElementById('token-mint').addEventListener('click', async () => {
    const status = document.getElementById('token-status');
    const field = document.getElementById('token-value');
    status.textContent = 'Creating…';
    try {
      const { token } = await API.mintToken();
      field.value = token;
      field.hidden = false;
      status.textContent = 'Copy it now — it is not shown again.';
    } catch {
      status.textContent = 'Could not create a token.';
    }
  });

  document.getElementById('token-revoke').addEventListener('click', async () => {
    const field = document.getElementById('token-value');
    await API.revokeToken().catch(() => {});
    field.value = '';
    field.hidden = true;
    document.getElementById('token-status').textContent = 'Revoked.';
  });
```

- [ ] **Step 8: Add the styles**

```css
/* ── Exercises ─────────────────────────────────────────────── */
.exercise-name { font-size: 13px; margin-bottom: 4px; }
.exercise-status { font-size: 12px; margin-bottom: 10px; }
.exercise-passed { color: var(--accent); }
.exercise-failed { color: var(--amber); }
.exercise-pending { color: var(--muted); }
.exercise-when { color: var(--muted); margin-left: 6px; }
#token-value { font-family: var(--mono); font-size: 12px; margin-top: 10px; }
```

- [ ] **Step 9: Teach the harness about attempts**

In `test/dom/harness.js`, add `attempts = []` to the destructured state and one
line to the fetch stub, before the catch-all:

```js
    if (u.includes('/api/attempts')) return json({ attempts });
```

- [ ] **Step 10: Run everything**

```bash
pnpm test && pnpm build && pnpm validate
```

Expected: all green.

- [ ] **Step 11: Commit**

```bash
git add src/exercise-view.js test/exercise-view.test.js src/api.js src/sidebar.js src/settings-view.js src/main.js index.html style.css test/dom/harness.js
git commit -m "Show the exercise, its last result, and the token

The panel states what a pass proves: you ran it and it passed. The
graded cell is editable and saying so plainly is worth more than a badge
implying a guarantee nobody can make.

The token is shown once, because only its digest is stored and there is
nothing to show later."
```

---

## Verification checklist

- [ ] `pnpm test` — 300 before, roughly 40 new
- [ ] `PUT /api/progress` on a graded node is 409 from a valid session, in both directions
- [ ] Every ordinary step still ticks
- [ ] A passing attempt ticks the graded step; a failing one does not; a later failure does not clear it
- [ ] An attempt with a missing, unknown or revoked token is 401
- [ ] A `total` disagreeing with the definition is 400
- [ ] The token never appears in `exercise_tokens` in the clear
- [ ] Attempts and tokens both vanish with the account
- [ ] `pnpm validate` fails if an exercise names a step that does not exist
- [ ] The sidebar shows the Colab link, the last result, and a disabled graded checkbox
- [ ] Settings mints a token once and revokes it

## Prerequisite the author must do

Colab opens notebooks only from a public GitHub repository, a gist, or Drive.
The Colab URLs in Task 6 assume `github.com/getravi/halflife` exists and is
public:

```
gh repo create halflife --public --source=. --remote=origin --push
```

Until that is done, everything in this plan is implementable and testable — the
tests never contact Colab — but the "Open in Colab" link 404s.
