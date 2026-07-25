# Hosted Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the tracker onto Cloudflare Workers + D1, turn the curriculum into runtime data with stable IDs, and make every query multi-tenant before auth exists.

**Architecture:** One Worker serves `/api/*` and falls through to the Vite build for everything else. Curriculum ships as content-hashed static JSON fetched by the browser — the Worker only ever touches user-owned data. A single `getUser()` seam returns a seeded user now and reads a session cookie in sub-project 2.

**Tech Stack:** Cloudflare Workers, D1 (SQLite), Wrangler, Vite 8, Vitest with `@cloudflare/vitest-pool-workers`, pnpm, Node 24 LTS. No frontend framework.

## Global Constraints

- **Fixed four-level shape:** phase → task → subtask → step. No arbitrary nesting.
- **IDs are slugs, unique within a path. Titles are display-only.** Renaming a title must never affect stored data.
- **IDs are append-only.** An ID that changes or vanishes fails validation.
- **Every query is scoped by `user_id`** from the first commit, including before auth exists.
- **`reviews` is append-only** — never updated, so card state stays replayable.
- **Progress is presence, not a boolean.** A row means done; unticking deletes it.
- **Grades are exactly** `again`, `hard`, `good`, `easy`.
- **Retention target is 0.9.** `R = 0.9 ^ (Δdays / stability)`. No second tunable.
- **A lapse resets stability to 1 day.** Never multiply it down.
- **Retained uses the same hierarchical bubble-up as Covered** — subtask → task → phase → overall, normalising at each level. A flat weighted mean reads higher than Covered and makes the pair meaningless.
- Timestamps are epoch milliseconds as `INTEGER`. `started_on` is the exception: a local calendar date as `YYYY-MM-DD` text.
- **No DOM test framework.** UI is verified by driving a browser.
- Package manager is pnpm. Node >= 24.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `wrangler.jsonc` | Worker config: D1 binding, assets binding, vars. |
| `migrations/0001_init.sql` | The five tables and two indexes. |
| `migrations/0002_seed_dev_user.sql` | The fixed-ULID user that `DEV_USER_ID` points at. |
| `worker/index.js` | `fetch` handler: routing, JSON envelope, error mapping. No business logic. |
| `worker/auth.js` | `getUser(request, env)` — the seam sub-project 2 replaces. |
| `worker/db.js` | Every D1 statement. The only file that knows SQL. |
| `worker/scheduler.js` | Moved verbatim from `server/scheduler.js`. Pure. |
| `worker/routes/progress.js` | `GET /api/progress`, `PUT /api/progress`. |
| `worker/routes/cards.js` | `GET /api/cards`, `POST /api/cards`. |
| `worker/routes/reviews.js` | `POST /api/reviews`. |
| `worker/routes/me.js` | `GET /api/me`, `DELETE /api/me`, `POST /api/enrollments`. |
| `tools/convert-path.js` | One-shot: panels + resources → `paths/frontier-lab.json`. Deleted after use. |
| `tools/validate-path.js` | Validates paths and emits hashed files + catalogue into `public/paths/`. |
| `src/content.js` | Fetch + cache path JSON via the catalogue. |
| `src/weights.js` | Derive weights from the path tree. |
| `src/progress.js` | Completion state and the weighted Covered rollup. |
| `src/render-path.js` | Build phase panels into the DOM from a path. |
| `src/nav.js` | Hash routing between views. |
| `test/worker/*.test.js` | Route and isolation tests against a real local D1. |
| `test/validate-path.test.js` | Validator tests. |

**Modified:** `package.json`, `vite.config.js`, `index.html`, `src/api.js` (moved from `api.js`), `src/today.js` (moved from `today.js`), `src/sidebar.js` (extracted from `app.js`).

**Deleted at the end:** `server/`, `tools/render.py`, `tools/build.js`, `tools/check.js`, `resources_db.js`, `app.js`, `main.js` (replaced by `src/main.js`), `data/panels/`, `data/resources/`, `data/weights.json`, `Makefile`.

---

### Task 1: Wrangler, D1 and the schema

**Files:**
- Create: `wrangler.jsonc`, `migrations/0001_init.sql`, `migrations/0002_seed_dev_user.sql`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Produces: a D1 binding named `DB`; env var `DEV_USER_ID = "01JQZX000000000000000USER"`; scripts `pnpm dev:worker`, `pnpm db:migrate`, `pnpm db:migrate:local`.
- Table and column names exactly as in `0001_init.sql` below. Every later task depends on these.

- [ ] **Step 1: Install the toolchain**

```bash
pnpm add -D wrangler vitest @cloudflare/vitest-pool-workers
```

- [ ] **Step 2: Write `migrations/0001_init.sql`**

```sql
CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  github_id    INTEGER UNIQUE,
  login        TEXT,
  avatar_url   TEXT,
  created_at   INTEGER NOT NULL
);

CREATE TABLE enrollments (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_id    TEXT NOT NULL,
  started_on TEXT NOT NULL,
  PRIMARY KEY (user_id, path_id)
);

CREATE TABLE progress (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_id    TEXT NOT NULL,
  node_id    TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, path_id, node_id)
);

CREATE TABLE cards (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ts         INTEGER NOT NULL,
  grade      TEXT NOT NULL CHECK (grade IN ('again','hard','good','easy')),
  latency_ms INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX cards_due    ON cards(user_id, path_id, due_at);
CREATE INDEX reviews_card ON reviews(card_id, ts);
```

- [ ] **Step 3: Write `migrations/0002_seed_dev_user.sql`**

Keeping the seed in a migration rather than a script means local, preview and production all start from the same known row.

```sql
INSERT INTO users (id, github_id, login, avatar_url, created_at)
VALUES ('01JQZX000000000000000USER', NULL, 'dev', NULL, 0);
```

- [ ] **Step 4: Write `wrangler.jsonc`**

`database_id` is filled in by Step 5. Leave the placeholder string exactly as written until then.

```jsonc
{
  "name": "frontier-lab-plan",
  "main": "worker/index.js",
  "compatibility_date": "2026-07-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "vars": {
    "DEV_USER_ID": "01JQZX000000000000000USER"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "frontier-lab",
      "database_id": "REPLACE_AFTER_CREATE"
    }
  ]
}
```

- [ ] **Step 5: Create the database and paste its id**

```bash
pnpm wrangler d1 create frontier-lab
```

Copy the printed `database_id` into `wrangler.jsonc`, replacing `REPLACE_AFTER_CREATE`.

- [ ] **Step 6: Add scripts to `package.json`**

```json
"dev:worker": "wrangler dev",
"db:migrate:local": "wrangler d1 migrations apply frontier-lab --local",
"db:migrate": "wrangler d1 migrations apply frontier-lab --remote",
"deploy": "vite build && wrangler deploy"
```

- [ ] **Step 7: Ignore wrangler's local state**

Append to `.gitignore`:

```
.wrangler/
```

- [ ] **Step 8: Apply the migrations locally and verify the seed**

```bash
pnpm db:migrate:local
pnpm wrangler d1 execute frontier-lab --local --command "SELECT id, login FROM users"
```

Expected: one row, `01JQZX000000000000000USER | dev`.

- [ ] **Step 9: Verify the grade constraint actually bites**

```bash
pnpm wrangler d1 execute frontier-lab --local --command \
  "INSERT INTO reviews (id,card_id,user_id,ts,grade) VALUES ('r','c','u',0,'ok')"
```

Expected: an error mentioning the CHECK constraint. If this succeeds, the constraint is wrong and every later task is built on sand.

- [ ] **Step 10: Commit**

```bash
git add wrangler.jsonc migrations package.json pnpm-lock.yaml .gitignore
git commit -m "Add the Workers config, D1 schema and the seeded user

Progress is presence rather than a boolean, so unticking deletes the row
and there is no tombstone class to filter. Cascades are on every user
reference because public signup makes account deletion an obligation
rather than a feature."
```

---

### Task 2: The database layer and the auth seam

**Files:**
- Create: `worker/db.js`, `worker/auth.js`, `test/worker/isolation.test.js`
- Create: `vitest.config.js`
- Move: `server/scheduler.js` → `worker/scheduler.js` (content unchanged)

**Interfaces:**
- Consumes: the tables from Task 1.
- Produces:
  - `getUser(request, env) -> Promise<user|null>`
  - `listProgress(env, userId, pathId) -> Promise<string[]>` (node ids)
  - `setProgress(env, userId, pathId, nodeId, done, now) -> Promise<void>`
  - `listCards(env, userId, pathId) -> Promise<card[]>`
  - `insertCard(env, card) -> Promise<card>` where `card` is the scheduler's shape plus `user_id` and `path_id`
  - `getOwnedCard(env, userId, cardId) -> Promise<card|undefined>`
  - `updateCardSchedule(env, card) -> Promise<void>`
  - `insertReview(env, review) -> Promise<void>`
  - `getEnrollments(env, userId) -> Promise<{path_id, started_on}[]>`
  - `upsertEnrollment(env, userId, pathId, startedOn) -> Promise<void>`
  - `deleteUser(env, userId) -> Promise<void>`
  - `newId() -> string` (ULID-ish, monotonic, no dependency)

- [ ] **Step 1: Write `vitest.config.js`**

```js
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    include: ['test/**/*.test.js'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          d1Databases: ['DB']
        }
      }
    }
  }
});
```

- [ ] **Step 2: Write the failing isolation test**

This is the most important test in the plan. It asserts multi-tenancy *before* auth exists, which is the entire reason the schema carries `user_id` from day one.

Create `test/worker/isolation.test.js`:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../worker/db.js';
import { newCard } from '../../worker/scheduler.js';

const A = 'user-a';
const B = 'user-b';
const PATH = 'frontier-lab';

async function migrate() {
  // vitest-pool-workers gives each test file a fresh in-memory D1, so the
  // schema is applied here rather than assumed.
  const sql = await import('node:fs').then(fs =>
    fs.readFileSync('migrations/0001_init.sql', 'utf8'));
  for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
    await env.DB.prepare(stmt).run();
  }
}

async function seedUsers() {
  for (const id of [A, B]) {
    await env.DB.prepare(
      'INSERT INTO users (id, login, created_at) VALUES (?, ?, ?)'
    ).bind(id, id, 0).run();
  }
}

function card(userId, prompt) {
  return {
    ...newCard({
      page: null, taskId: null,
      subtaskTitle: null,
      prompt, answer: 'answer'
    }, 1000),
    user_id: userId,
    path_id: PATH,
    subtask_id: 'p2-serving-vllm'
  };
}

describe('tenant isolation', () => {
  beforeEach(async () => {
    await migrate();
    await seedUsers();
  });

  it("does not show one user another user's cards", async () => {
    await db.insertCard(env, card(A, 'a-prompt'));
    await db.insertCard(env, card(B, 'b-prompt'));

    const forA = await db.listCards(env, A, PATH);
    expect(forA).toHaveLength(1);
    expect(forA[0].prompt).toBe('a-prompt');
  });

  it("refuses to hand over a card the caller does not own, because that is what guards every review", async () => {
    const bCard = await db.insertCard(env, card(B, 'b-prompt'));
    expect(await db.getOwnedCard(env, A, bCard.id)).toBeUndefined();
    expect(await db.getOwnedCard(env, B, bCard.id)).toBeDefined();
  });

  it('keeps progress separate per user', async () => {
    await db.setProgress(env, A, PATH, 'node-1', true, 1);
    expect(await db.listProgress(env, A, PATH)).toEqual(['node-1']);
    expect(await db.listProgress(env, B, PATH)).toEqual([]);
  });

  it('keeps progress separate per path, so enrolling in a second path starts empty', async () => {
    await db.setProgress(env, A, PATH, 'node-1', true, 1);
    expect(await db.listProgress(env, A, 'other-path')).toEqual([]);
  });

  it('deletes a row rather than storing done=false, so unticking leaves no tombstone', async () => {
    await db.setProgress(env, A, PATH, 'node-1', true, 1);
    await db.setProgress(env, A, PATH, 'node-1', false, 2);
    expect(await db.listProgress(env, A, PATH)).toEqual([]);
  });

  it("deleting an account removes that user's data and touches nobody else's", async () => {
    const aCard = await db.insertCard(env, card(A, 'a-prompt'));
    await db.insertReview(env, {
      id: 'r1', card_id: aCard.id, user_id: A, ts: 1, grade: 'good', latency_ms: 0
    });
    await db.setProgress(env, A, PATH, 'node-1', true, 1);
    await db.insertCard(env, card(B, 'b-prompt'));
    await db.setProgress(env, B, PATH, 'node-2', true, 1);

    await db.deleteUser(env, A);

    expect(await db.listCards(env, A, PATH)).toEqual([]);
    expect(await db.listProgress(env, A, PATH)).toEqual([]);
    const reviews = await env.DB.prepare('SELECT * FROM reviews').all();
    expect(reviews.results).toHaveLength(0);

    expect(await db.listCards(env, B, PATH)).toHaveLength(1);
    expect(await db.listProgress(env, B, PATH)).toEqual(['node-2']);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
pnpm vitest run test/worker/isolation.test.js
```

Expected: FAIL — `worker/db.js` does not exist.

- [ ] **Step 4: Move the scheduler**

```bash
mkdir -p worker
git mv server/scheduler.js worker/scheduler.js
```

Then update the import at the top of `test/scheduler.test.js`:

```js
import * as S from '../worker/scheduler.js';
```

The file's contents do not change. It is pure and takes `now` as a parameter, so it does not care what runtime it is in.

- [ ] **Step 5: Write `worker/db.js`**

```js
/**
 * Every D1 statement in the application. Nothing else knows SQL.
 *
 * Every function that touches user-owned data takes a userId and puts it in
 * the WHERE clause. That is not defence in depth — it is the only thing
 * standing between two accounts, and it is written this way before auth
 * exists so there is never a sweep later hunting for the query that forgot.
 */

let counter = 0;

/** Monotonic, sortable, dependency-free. Not a real ULID; close enough. */
export function newId() {
  counter = (counter + 1) % 0xffff;
  return Date.now().toString(36).padStart(9, '0')
       + counter.toString(36).padStart(4, '0')
       + Math.floor(Math.random() * 0xffffff).toString(36).padStart(5, '0');
}

export async function listProgress(env, userId, pathId) {
  const { results } = await env.DB
    .prepare('SELECT node_id FROM progress WHERE user_id = ? AND path_id = ?')
    .bind(userId, pathId).all();
  return results.map(r => r.node_id);
}

export async function setProgress(env, userId, pathId, nodeId, done, now) {
  if (done) {
    await env.DB.prepare(
      `INSERT INTO progress (user_id, path_id, node_id, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, path_id, node_id) DO UPDATE SET updated_at = ?`
    ).bind(userId, pathId, nodeId, now, now).run();
  } else {
    await env.DB.prepare(
      'DELETE FROM progress WHERE user_id = ? AND path_id = ? AND node_id = ?'
    ).bind(userId, pathId, nodeId).run();
  }
}

export async function listCards(env, userId, pathId) {
  const { results } = await env.DB
    .prepare('SELECT * FROM cards WHERE user_id = ? AND path_id = ? ORDER BY due_at')
    .bind(userId, pathId).all();
  return results;
}

export async function insertCard(env, card) {
  await env.DB.prepare(
    `INSERT INTO cards
       (id, user_id, path_id, subtask_id, prompt, answer,
        created_at, last_reviewed_at, due_at, stability, reps, lapses)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    card.id, card.user_id, card.path_id, card.subtask_id,
    card.prompt, card.answer, card.createdAt, card.lastReviewedAt,
    card.dueAt, card.stability, card.reps, card.lapses
  ).run();
  return card;
}

export async function getOwnedCard(env, userId, cardId) {
  const row = await env.DB
    .prepare('SELECT * FROM cards WHERE id = ? AND user_id = ?')
    .bind(cardId, userId).first();
  return row ?? undefined;
}

export async function updateCardSchedule(env, card) {
  await env.DB.prepare(
    `UPDATE cards
        SET last_reviewed_at = ?, due_at = ?, stability = ?, reps = ?, lapses = ?
      WHERE id = ? AND user_id = ?`
  ).bind(
    card.lastReviewedAt, card.dueAt, card.stability,
    card.reps, card.lapses, card.id, card.user_id
  ).run();
}

export async function insertReview(env, review) {
  await env.DB.prepare(
    `INSERT INTO reviews (id, card_id, user_id, ts, grade, latency_ms)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    review.id, review.card_id, review.user_id,
    review.ts, review.grade, review.latency_ms
  ).run();
}

export async function getEnrollments(env, userId) {
  const { results } = await env.DB
    .prepare('SELECT path_id, started_on FROM enrollments WHERE user_id = ?')
    .bind(userId).all();
  return results;
}

export async function upsertEnrollment(env, userId, pathId, startedOn) {
  await env.DB.prepare(
    `INSERT INTO enrollments (user_id, path_id, started_on)
     VALUES (?, ?, ?)
     ON CONFLICT (user_id, path_id) DO UPDATE SET started_on = ?`
  ).bind(userId, pathId, startedOn, startedOn).run();
}

export async function deleteUser(env, userId) {
  // The cascades do the rest. D1 has foreign keys on by default.
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}
```

- [ ] **Step 6: Write `worker/auth.js`**

```js
/**
 * The seam. Sub-project 1 always resolves to the seeded user; sub-project 2
 * replaces this body with a signed-session-cookie lookup and returns null so
 * routes can answer 401. Nothing else in the Worker changes.
 */
export async function getUser(request, env) {
  return env.DB
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(env.DEV_USER_ID)
    .first();
}
```

- [ ] **Step 7: Run the isolation tests**

```bash
pnpm vitest run test/worker/isolation.test.js
```

Expected: PASS, 6 tests.

- [ ] **Step 8: Confirm the scheduler still passes under Vitest**

```bash
pnpm vitest run test/scheduler.test.js
```

Expected: PASS, 11 tests. The file was moved, not edited; if any fail, the move was not clean.

- [ ] **Step 9: Point `pnpm test` at Vitest**

In `package.json`, replace the `test` script:

```json
"test": "vitest run"
```

- [ ] **Step 10: Commit**

```bash
git add worker test vitest.config.js package.json
git rm -r --cached server/scheduler.js 2>/dev/null || true
git commit -m "Add the D1 layer and the auth seam

Every query is scoped by user_id before there is anything to log into,
so sub-project 2 replaces one function body rather than sweeping the
codebase for the query that forgot its WHERE clause. The isolation tests
prove that now, with two seeded users, instead of after auth ships."
```

---

### Task 3: The Worker router and the progress routes

**Files:**
- Create: `worker/http.js`, `worker/index.js`, `worker/routes/progress.js`, `test/worker/progress.test.js`

**Interfaces:**
- Consumes: `getUser` (Task 2), `listProgress`/`setProgress` (Task 2).
- Produces:
  - `json(body, status)` and `error(message, status)` exported from `worker/http.js`. They live in their own module rather than in `index.js` because every route imports them and `index.js` imports every route — a cycle that ESM tolerates but that breaks the moment one is called at module scope.
  - Route signature: every handler is `async (request, env, user, url) => Response`.
  - `GET /api/progress?pathId=X` → `{ nodeIds: string[] }`
  - `PUT /api/progress` body `{ pathId, nodeId, done }` → `{ ok: true }`. `400` when `pathId` or `nodeId` is missing or empty, or `done` is not a boolean.

- [ ] **Step 1: Write the failing test**

Create `test/worker/progress.test.js`:

```js
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';

async function migrate() {
  const sql = fs.readFileSync('migrations/0001_init.sql', 'utf8');
  for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
    await env.DB.prepare(stmt).run();
  }
  await env.DB.prepare(
    'INSERT INTO users (id, login, created_at) VALUES (?, ?, ?)'
  ).bind(env.DEV_USER_ID, 'dev', 0).run();
}

const put = (body) => SELF.fetch('https://x/api/progress', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

describe('progress routes', () => {
  beforeEach(migrate);

  it('round-trips a tick', async () => {
    expect((await put({ pathId: 'p', nodeId: 'n1', done: true })).status).toBe(200);
    const res = await SELF.fetch('https://x/api/progress?pathId=p');
    expect(await res.json()).toEqual({ nodeIds: ['n1'] });
  });

  it('unticking removes it, because progress is presence rather than a flag', async () => {
    await put({ pathId: 'p', nodeId: 'n1', done: true });
    await put({ pathId: 'p', nodeId: 'n1', done: false });
    const res = await SELF.fetch('https://x/api/progress?pathId=p');
    expect(await res.json()).toEqual({ nodeIds: [] });
  });

  it('ticking twice is idempotent rather than a constraint error', async () => {
    await put({ pathId: 'p', nodeId: 'n1', done: true });
    expect((await put({ pathId: 'p', nodeId: 'n1', done: true })).status).toBe(200);
    const res = await SELF.fetch('https://x/api/progress?pathId=p');
    expect(await res.json()).toEqual({ nodeIds: ['n1'] });
  });

  it('scopes reads by path, so two paths cannot bleed into each other', async () => {
    await put({ pathId: 'p', nodeId: 'n1', done: true });
    const res = await SELF.fetch('https://x/api/progress?pathId=other');
    expect(await res.json()).toEqual({ nodeIds: [] });
  });

  it('rejects a missing pathId rather than writing an orphan row', async () => {
    expect((await put({ nodeId: 'n1', done: true })).status).toBe(400);
  });

  it('rejects a non-boolean done, because a string "false" is truthy and would tick it', async () => {
    expect((await put({ pathId: 'p', nodeId: 'n1', done: 'false' })).status).toBe(400);
  });

  it('404s an unknown api route instead of falling through to assets', async () => {
    expect((await SELF.fetch('https://x/api/nope')).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/worker/progress.test.js
```

Expected: FAIL — no `worker/index.js` export, or 404 on every request.

- [ ] **Step 3: Write `worker/http.js`**

```js
/**
 * Response helpers. Their own module because every route imports them and
 * index.js imports every route; putting them in index.js is an import cycle.
 */
export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export function error(message, status) {
  return json({ error: message }, status);
}
```

- [ ] **Step 4: Write `worker/index.js`**

```js
/**
 * The Worker. Routing, a JSON envelope, and error mapping — no business
 * logic. Anything not under /api/ is handed to the assets binding, which
 * serves the Vite build.
 */
import { getUser } from './auth.js';
import { error } from './http.js';
import * as progress from './routes/progress.js';

const ROUTES = [
  ['GET', '/api/progress', progress.list],
  ['PUT', '/api/progress', progress.set]
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    const match = ROUTES.find(
      ([method, path]) => method === request.method && path === url.pathname
    );
    if (!match) return error('no such route', 404);

    const user = await getUser(request, env);
    if (!user) return error('not signed in', 401);

    try {
      return await match[2](request, env, user, url);
    } catch (e) {
      return error(e.message, 500);
    }
  }
};
```

- [ ] **Step 5: Write `worker/routes/progress.js`**

```js
import { json, error } from '../http.js';
import { listProgress, setProgress } from '../db.js';

const str = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

export async function list(request, env, user, url) {
  const pathId = str(url.searchParams.get('pathId'));
  if (!pathId) return error('pathId is required', 400);
  return json({ nodeIds: await listProgress(env, user.id, pathId) });
}

export async function set(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error('body is not valid JSON', 400);
  }

  const pathId = str(body.pathId);
  const nodeId = str(body.nodeId);
  // Explicitly boolean: the string "false" is truthy, and accepting it would
  // silently tick a step the user was trying to untick.
  if (!pathId || !nodeId || typeof body.done !== 'boolean') {
    return error('pathId, nodeId and a boolean done are required', 400);
  }

  await setProgress(env, user.id, pathId, nodeId, body.done, Date.now());
  return json({ ok: true });
}
```

- [ ] **Step 6: Run the tests**

```bash
pnpm vitest run test/worker/progress.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add worker test
git commit -m "Add the Worker router and the progress routes

done must be an actual boolean. Accepting the string \"false\" would tick
the step the user was trying to untick, which is the kind of bug that
only shows up as mysteriously reappearing progress."
```

---

### Task 4: The cards routes

**Files:**
- Create: `worker/routes/cards.js`, `test/worker/cards.test.js`
- Modify: `worker/index.js` (register two routes)

**Interfaces:**
- Consumes: `json`/`error` (Task 3), `listCards`/`insertCard`/`newId` (Task 2), `newCard`/`retrievability`/`isDue` (Task 2's moved scheduler).
- Produces:
  - `GET /api/cards?pathId=X` → `{ cards: [...] }` where each card is the database row plus computed `r` and `due`.
  - `POST /api/cards` body `{ pathId, subtaskId, prompt, answer }` → `201 { card }`. `400` on any missing or blank field.
  - Card rows carry snake_case columns (`last_reviewed_at`, `due_at`) but the scheduler works in camelCase (`lastReviewedAt`, `dueAt`). `toScheduler(row)` and `fromScheduler(card, userId, pathId, subtaskId)` in `cards.js` convert between them, and both are exported because Task 5 needs them.

- [ ] **Step 1: Write the failing test**

Create `test/worker/cards.test.js`:

```js
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';

async function migrate() {
  const sql = fs.readFileSync('migrations/0001_init.sql', 'utf8');
  for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
    await env.DB.prepare(stmt).run();
  }
  await env.DB.prepare(
    'INSERT INTO users (id, login, created_at) VALUES (?, ?, ?)'
  ).bind(env.DEV_USER_ID, 'dev', 0).run();
}

const BODY = {
  pathId: 'frontier-lab',
  subtaskId: 'p2-serving-vllm',
  prompt: 'Why does a paired bootstrap beat two independent ones?',
  answer: 'Pairing removes item-level variance.'
};

const post = (body) => SELF.fetch('https://x/api/cards', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

describe('cards routes', () => {
  beforeEach(migrate);

  it('creates and lists a card', async () => {
    const res = await post(BODY);
    expect(res.status).toBe(201);
    const { card } = await res.json();
    expect(card.id).toBeTruthy();

    const list = await (await SELF.fetch('https://x/api/cards?pathId=frontier-lab')).json();
    expect(list.cards).toHaveLength(1);
    expect(list.cards[0].prompt).toBe(BODY.prompt);
  });

  it('computes retrievability server-side, so the browser never reimplements the scheduler', async () => {
    await post(BODY);
    const { cards } = await (await SELF.fetch('https://x/api/cards?pathId=frontier-lab')).json();
    expect(cards[0].r).toBe(0);
    expect(cards[0].due).toBe(true);
  });

  it('a brand-new card is due immediately, because unreviewed is not the same as known', async () => {
    await post(BODY);
    const { cards } = await (await SELF.fetch('https://x/api/cards?pathId=frontier-lab')).json();
    expect(cards[0].reps).toBe(0);
    expect(cards[0].due_at).toBeLessThanOrEqual(Date.now());
  });

  it('rejects a blank prompt, because a blank card is unreviewable', async () => {
    expect((await post({ ...BODY, prompt: '   ' })).status).toBe(400);
  });

  it('rejects a missing subtaskId, because a card with no anchor cannot count toward Retained', async () => {
    const { subtaskId, ...rest } = BODY;
    expect((await post(rest)).status).toBe(400);
  });

  it('scopes the list by path', async () => {
    await post(BODY);
    const { cards } = await (await SELF.fetch('https://x/api/cards?pathId=other')).json();
    expect(cards).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/worker/cards.test.js
```

Expected: FAIL — 404, the routes are not registered.

- [ ] **Step 3: Write `worker/routes/cards.js`**

```js
import { json, error } from '../http.js';
import { listCards, insertCard, newId } from '../db.js';
import { newCard, retrievability, isDue } from '../scheduler.js';

const str = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Database rows are snake_case; the scheduler works in camelCase. */
export function toScheduler(row) {
  return {
    id: row.id,
    prompt: row.prompt,
    answer: row.answer,
    createdAt: row.created_at,
    lastReviewedAt: row.last_reviewed_at,
    dueAt: row.due_at,
    stability: row.stability,
    reps: row.reps,
    lapses: row.lapses
  };
}

export function fromScheduler(card, userId, pathId, subtaskId) {
  return {
    id: card.id,
    user_id: userId,
    path_id: pathId,
    subtask_id: subtaskId,
    prompt: card.prompt,
    answer: card.answer,
    createdAt: card.createdAt,
    lastReviewedAt: card.lastReviewedAt,
    dueAt: card.dueAt,
    stability: card.stability,
    reps: card.reps,
    lapses: card.lapses
  };
}

export async function list(request, env, user, url) {
  const pathId = str(url.searchParams.get('pathId'));
  if (!pathId) return error('pathId is required', 400);

  const now = Date.now();
  const rows = await listCards(env, user.id, pathId);
  return json({
    cards: rows.map(row => {
      const c = toScheduler(row);
      return { ...row, r: retrievability(c, now), due: isDue(c, now) };
    })
  });
}

export async function create(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error('body is not valid JSON', 400);
  }

  const pathId = str(body.pathId);
  const subtaskId = str(body.subtaskId);
  const prompt = str(body.prompt);
  const answer = str(body.answer);
  if (!pathId || !subtaskId || !prompt || !answer) {
    return error('pathId, subtaskId, prompt and answer are all required', 400);
  }

  const card = newCard({ prompt, answer }, Date.now());
  card.id = newId();
  await insertCard(env, fromScheduler(card, user.id, pathId, subtaskId));

  return json({ card: fromScheduler(card, user.id, pathId, subtaskId) }, 201);
}
```

- [ ] **Step 4: Register the routes in `worker/index.js`**

Add the import beside the progress one:

```js
import * as cards from './routes/cards.js';
```

and extend `ROUTES`:

```js
const ROUTES = [
  ['GET', '/api/progress', progress.list],
  ['PUT', '/api/progress', progress.set],
  ['GET', '/api/cards', cards.list],
  ['POST', '/api/cards', cards.create]
];
```

- [ ] **Step 5: Run the tests**

```bash
pnpm vitest run test/worker/cards.test.js
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add worker test
git commit -m "Add the cards routes

Retrievability is computed on read rather than stored, so the scheduler
stays in exactly one place. The snake_case rows and the scheduler's
camelCase meet in two conversion functions rather than leaking either
convention across the boundary."
```

---

### Task 5: The reviews route

**Files:**
- Create: `worker/routes/reviews.js`, `test/worker/reviews.test.js`
- Modify: `worker/index.js` (register one route)

**Interfaces:**
- Consumes: `json`/`error` (`worker/http.js`), `getOwnedCard`/`updateCardSchedule`/`insertReview`/`newId` (Task 2), `review` from the scheduler, `toScheduler`/`fromScheduler` (Task 4).
- Produces: `POST /api/reviews` body `{ cardId, grade, latencyMs }` → `{ card }` with the updated schedule. `400` on an unknown grade, `404` when the card is absent **or belongs to someone else**.

- [ ] **Step 1: Write the failing test**

Create `test/worker/reviews.test.js`:

```js
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';

const DAY = 86400000;

async function migrate() {
  const sql = fs.readFileSync('migrations/0001_init.sql', 'utf8');
  for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
    await env.DB.prepare(stmt).run();
  }
  for (const id of [env.DEV_USER_ID, 'someone-else']) {
    await env.DB.prepare(
      'INSERT INTO users (id, login, created_at) VALUES (?, ?, ?)'
    ).bind(id, id, 0).run();
  }
}

async function makeCard() {
  const res = await SELF.fetch('https://x/api/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      pathId: 'frontier-lab', subtaskId: 'p2-serving-vllm',
      prompt: 'p', answer: 'a'
    })
  });
  return (await res.json()).card;
}

const grade = (cardId, g) => SELF.fetch('https://x/api/reviews', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ cardId, grade: g, latencyMs: 3300 })
});

describe('reviews route', () => {
  beforeEach(migrate);

  it('grading good schedules four days out on the first review', async () => {
    const created = await makeCard();
    const { card } = await (await grade(created.id, 'good')).json();
    expect(card.reps).toBe(1);
    expect(card.stability).toBe(4);
    expect(card.dueAt - Date.now()).toBeGreaterThan(3.9 * DAY);
  });

  it('a lapse returns the card inside a day, because the memory is gone rather than weak', async () => {
    const created = await makeCard();
    await grade(created.id, 'good');
    const { card } = await (await grade(created.id, 'again')).json();
    expect(card.stability).toBe(1);
    expect(card.lapses).toBe(1);
    expect(card.dueAt - Date.now()).toBeLessThanOrEqual(DAY + 1000);
  });

  it('writes exactly one review row per grade and never updates one', async () => {
    const created = await makeCard();
    await grade(created.id, 'good');
    await grade(created.id, 'again');
    const { results } = await env.DB
      .prepare('SELECT grade FROM reviews WHERE card_id = ? ORDER BY ts')
      .bind(created.id).all();
    expect(results.map(r => r.grade)).toEqual(['good', 'again']);
  });

  it('rejects an unknown grade rather than scheduling something wrong', async () => {
    const created = await makeCard();
    expect((await grade(created.id, 'ok')).status).toBe(400);
  });

  it('404s an unknown card', async () => {
    expect((await grade('nope', 'good')).status).toBe(404);
  });

  it("404s another user's card with the same response as a missing one, so the endpoint is not an existence oracle", async () => {
    await env.DB.prepare(
      `INSERT INTO cards (id,user_id,path_id,subtask_id,prompt,answer,created_at,due_at)
       VALUES ('theirs','someone-else','frontier-lab','s','p','a',0,0)`
    ).run();

    const mine = await grade('nope', 'good');
    const theirs = await grade('theirs', 'good');
    expect(theirs.status).toBe(404);
    expect(await theirs.json()).toEqual(await mine.json());

    const { results } = await env.DB
      .prepare("SELECT reps FROM cards WHERE id = 'theirs'").all();
    expect(results[0].reps).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/worker/reviews.test.js
```

Expected: FAIL — 404 on every review, the route is not registered.

- [ ] **Step 3: Write `worker/routes/reviews.js`**

```js
import { json, error } from '../http.js';
import { getOwnedCard, updateCardSchedule, insertReview, newId } from '../db.js';
import { review as applyGrade } from '../scheduler.js';
import { toScheduler, fromScheduler } from './cards.js';

export async function create(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error('body is not valid JSON', 400);
  }

  // Ownership is checked, not assumed. A card that belongs to someone else
  // gets the same answer as a card that does not exist — otherwise this
  // endpoint reports which ids are real.
  const row = await getOwnedCard(env, user.id, body.cardId);
  if (!row) return error('no such card', 404);

  const now = Date.now();
  let updated;
  try {
    updated = applyGrade(toScheduler(row), body.grade, now);
  } catch (e) {
    return error(e.message, 400);
  }

  const next = fromScheduler(updated, user.id, row.path_id, row.subtask_id);
  await updateCardSchedule(env, next);
  await insertReview(env, {
    id: newId(),
    card_id: row.id,
    user_id: user.id,
    ts: now,
    grade: body.grade,
    latency_ms: Number(body.latencyMs) || 0
  });

  return json({ card: updated });
}
```

- [ ] **Step 4: Add the replay test**

The spec requires card state to be reconstructible from the review log. That
property is why `reviews` is append-only, and it only holds if the stored
schedule matches what replaying the grades produces. Append to
`test/worker/reviews.test.js`:

```js
import { newCard, review as applyGrade } from '../../worker/scheduler.js';

it('card state can be rebuilt from the review log, which is what append-only buys', async () => {
  const created = await makeCard();
  await grade(created.id, 'good');
  await grade(created.id, 'again');
  await grade(created.id, 'hard');

  const stored = await env.DB.prepare('SELECT * FROM cards WHERE id = ?')
    .bind(created.id).first();
  const log = (await env.DB
    .prepare('SELECT grade, ts FROM reviews WHERE card_id = ? ORDER BY ts, rowid')
    .bind(created.id).all()).results;

  let replayed = newCard({ prompt: 'p', answer: 'a' }, stored.created_at);
  for (const r of log) replayed = applyGrade(replayed, r.grade, r.ts);

  expect(replayed.stability).toBe(stored.stability);
  expect(replayed.reps).toBe(stored.reps);
  expect(replayed.lapses).toBe(stored.lapses);
  expect(replayed.dueAt).toBe(stored.due_at);
});
```

- [ ] **Step 5: Register the route in `worker/index.js`**

```js
import * as reviews from './routes/reviews.js';
```

and add to `ROUTES`:

```js
  ['POST', '/api/reviews', reviews.create],
```

- [ ] **Step 6: Run the tests**

```bash
pnpm vitest run test/worker/reviews.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add worker test
git commit -m "Add the reviews route

A card belonging to another account answers exactly as a card that does
not exist. Distinguishing the two would let anyone enumerate which card
ids are real, and the test asserts the two responses are byte-identical
rather than merely both 404."
```

---

### Task 6: Identity and enrolment

**Files:**
- Create: `worker/routes/me.js`, `test/worker/me.test.js`
- Modify: `worker/index.js` (register three routes)

**Interfaces:**
- Consumes: `getEnrollments`/`upsertEnrollment`/`deleteUser` (Task 2).
- Produces:
  - `GET /api/me` → `{ user: { id, login, avatarUrl }, enrollments: [{ pathId, startedOn }] }`
  - `POST /api/enrollments` body `{ pathId, startedOn }` → `{ ok: true }`. `400` unless `startedOn` matches `YYYY-MM-DD`.
  - `DELETE /api/me` → `{ ok: true }`, cascading to every owned row.

- [ ] **Step 1: Write the failing test**

Create `test/worker/me.test.js`:

```js
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';

async function migrate() {
  const sql = fs.readFileSync('migrations/0001_init.sql', 'utf8');
  for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
    await env.DB.prepare(stmt).run();
  }
  await env.DB.prepare(
    'INSERT INTO users (id, login, created_at) VALUES (?, ?, ?)'
  ).bind(env.DEV_USER_ID, 'dev', 0).run();
}

const enrol = (body) => SELF.fetch('https://x/api/enrollments', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

describe('me and enrolment', () => {
  beforeEach(migrate);

  it('reports the signed-in user with no enrolments initially', async () => {
    const body = await (await SELF.fetch('https://x/api/me')).json();
    expect(body.user.login).toBe('dev');
    expect(body.enrollments).toEqual([]);
  });

  it('enrolling records the start date the plan week is derived from', async () => {
    expect((await enrol({ pathId: 'frontier-lab', startedOn: '2026-07-25' })).status).toBe(200);
    const body = await (await SELF.fetch('https://x/api/me')).json();
    expect(body.enrollments).toEqual([{ pathId: 'frontier-lab', startedOn: '2026-07-25' }]);
  });

  it('re-enrolling updates the date rather than erroring on the primary key', async () => {
    await enrol({ pathId: 'frontier-lab', startedOn: '2026-07-25' });
    await enrol({ pathId: 'frontier-lab', startedOn: '2026-08-01' });
    const body = await (await SELF.fetch('https://x/api/me')).json();
    expect(body.enrollments).toEqual([{ pathId: 'frontier-lab', startedOn: '2026-08-01' }]);
  });

  it('rejects a timestamp where a calendar date belongs, because week maths is in local days', async () => {
    expect((await enrol({ pathId: 'p', startedOn: '2026-07-25T00:00:00Z' })).status).toBe(400);
    expect((await enrol({ pathId: 'p', startedOn: '25/07/2026' })).status).toBe(400);
  });

  it('deleting the account removes everything the user wrote', async () => {
    await enrol({ pathId: 'frontier-lab', startedOn: '2026-07-25' });
    await SELF.fetch('https://x/api/progress', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pathId: 'frontier-lab', nodeId: 'n1', done: true })
    });

    expect((await SELF.fetch('https://x/api/me', { method: 'DELETE' })).status).toBe(200);

    for (const table of ['users', 'enrollments', 'progress', 'cards', 'reviews']) {
      const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
      expect(results, `${table} should be empty`).toHaveLength(0);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/worker/me.test.js
```

Expected: FAIL — 404, the routes are not registered.

- [ ] **Step 3: Write `worker/routes/me.js`**

```js
import { json, error } from '../http.js';
import { getEnrollments, upsertEnrollment, deleteUser } from '../db.js';

// A calendar day, not an instant. The plan-week calculation counts local days,
// so accepting an ISO timestamp here would silently shift the start by one day
// for anyone west of UTC.
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function me(request, env, user) {
  const rows = await getEnrollments(env, user.id);
  return json({
    user: { id: user.id, login: user.login, avatarUrl: user.avatar_url },
    enrollments: rows.map(r => ({ pathId: r.path_id, startedOn: r.started_on }))
  });
}

export async function enrol(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error('body is not valid JSON', 400);
  }

  const pathId = typeof body.pathId === 'string' ? body.pathId.trim() : '';
  const startedOn = typeof body.startedOn === 'string' ? body.startedOn.trim() : '';
  if (!pathId) return error('pathId is required', 400);
  if (!DATE.test(startedOn)) return error('startedOn must be YYYY-MM-DD', 400);

  await upsertEnrollment(env, user.id, pathId, startedOn);
  return json({ ok: true });
}

export async function destroy(request, env, user) {
  await deleteUser(env, user.id);
  return json({ ok: true });
}
```

- [ ] **Step 4: Register the routes in `worker/index.js`**

```js
import * as meRoutes from './routes/me.js';
```

and add to `ROUTES`:

```js
  ['GET', '/api/me', meRoutes.me],
  ['DELETE', '/api/me', meRoutes.destroy],
  ['POST', '/api/enrollments', meRoutes.enrol],
```

- [ ] **Step 5: Run the whole Worker suite**

```bash
pnpm vitest run
```

Expected: PASS — 11 scheduler, 6 isolation, 7 progress, 6 cards, 7 reviews, 5 me.

- [ ] **Step 6: Commit**

```bash
git add worker test
git commit -m "Add identity, enrolment and account deletion

startedOn is a calendar date and the route refuses an ISO timestamp.
Accepting one would shift the plan start by a day for anyone west of
UTC, which is the same bug the local-date fix already caught once in the
browser.

Deletion is asserted by emptying every table rather than by trusting the
cascade declaration."
```

---

### Task 7: Convert the curriculum into one path file

**Files:**
- Create: `tools/convert-path.js`, `paths/frontier-lab.json`
- Reads: `data/panels/panel_p*.json`, `data/resources/rdb_p*.json`, `data/weights.json`

**Interfaces:**
- Produces `paths/frontier-lab.json` in exactly this shape, which every later task reads:

```json
{
  "id": "frontier-lab",
  "title": "Frontier Lab Learning Plan",
  "phases": [{
    "id": "p2", "title": "Evals & environments", "num": "Phase 02",
    "weeks": [21, 38], "weight": 18, "intro": "…", "callouts": [],
    "tasks": [{
      "id": "p2-serving", "title": "Stand up a served endpoint",
      "badge": "Task 01", "tag": "exercise", "weeks": [21, 22], "weight": 8,
      "subtasks": [{
        "id": "p2-serving-s01", "title": "Stand up vLLM", "desc": "…",
        "time": "Week 21",
        "steps": [{ "id": "p2-serving-s01-01", "text": "…" }],
        "resources": { "docs": [], "videos": [], "papers": [],
                       "courses": [], "lectures": [], "podcasts": [] }
      }]
    }]
  }]
}
```

**Source shapes this reads.** Panels are `{ phases: [{ id: "phase2", num, weeks, title, intro, callouts, tasks: [{ id, badge, title, tag, items: [{ title, desc, time, resource }] }], milestone }] }`. Resources are `page → taskId → subtaskTitle → { desc, steps[], docs[], courses[], videos[], papers[], lectures[], podcasts[] }`. Weights are `{ phases: { p0: 11, … }, tasks: { "p2-serving": 8, … } }`.

**Subtask IDs are positional** — `<taskId>-s01`, `-s02` — because the existing subtasks have no ids and their titles are exactly what we are trying to stop depending on. Positional ids are stable as long as order is stable, and from this point the validator forbids them changing.

- [ ] **Step 1: Write `tools/convert-path.js`**

```js
#!/usr/bin/env node
/**
 * One-shot conversion: the generated panel/resource split becomes one path
 * file with stable ids. Run once, commit the output, then delete this file.
 *
 * Subtask ids are positional rather than slugified from titles. Slugs would
 * be prettier and would change the moment a title is edited, which is the
 * entire failure mode this migration exists to end.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const weights = read('data/weights.json');

const panels = fs.readdirSync(path.join(ROOT, 'data/panels'))
  .filter(f => f.startsWith('panel_p'))
  .sort()
  .flatMap(f => read(`data/panels/${f}`).phases ?? read(`data/panels/${f}`));

const resources = {};
for (const f of fs.readdirSync(path.join(ROOT, 'data/resources'))) {
  Object.assign(resources, read(`data/resources/${f}`));
}

const decode = s => String(s ?? '')
  .replace(/<br\s*\/?>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

const weeksOf = label => {
  const n = String(label ?? '').match(/\d+/g)?.map(Number) ?? [];
  return n.length ? [n[0], n[n.length - 1]] : null;
};

const KINDS = ['docs', 'courses', 'videos', 'papers', 'lectures', 'podcasts'];
const pad = n => String(n).padStart(2, '0');

const phases = panels.sort((a, b) => a.id.localeCompare(b.id)).map(ph => {
  const short = 'p' + ph.id.slice(-1);
  const page = `${ph.id}.html`;

  const tasks = ph.tasks.map(t => {
    const entry = resources[page]?.[t.id] ?? {};

    const subtasks = t.items.map((item, i) => {
      const title = decode(item.title);
      const body = entry[title] ?? {};
      const id = `${t.id}-s${pad(i + 1)}`;

      const res = {};
      for (const k of KINDS) if (body[k]?.length) res[k] = body[k];
      // The panel carries a single inline resource link the resource db does not.
      if (item.resource?.url) {
        (res.docs = res.docs ?? []).push({
          name: decode(item.resource.label), url: item.resource.url
        });
      }

      return {
        id,
        title,
        desc: body.desc ?? decode(item.desc),
        time: decode(item.time),
        steps: (body.steps ?? []).map((text, j) => ({
          id: `${id}-${pad(j + 1)}`, text
        })),
        resources: res
      };
    });

    return {
      id: t.id,
      title: decode(t.title),
      badge: decode(t.badge),
      tag: t.tag ?? null,
      weeks: weeksOf(t.items.map(i => i.time).join(' ')),
      weight: weights.tasks[t.id] ?? 1,
      subtasks
    };
  });

  return {
    id: short,
    title: decode(ph.title),
    num: decode(ph.num),
    weeks: weeksOf(ph.weeks),
    weight: weights.phases[short] ?? 1,
    intro: decode(ph.intro),
    callouts: ph.callouts ?? [],
    tasks
  };
});

const out = { id: 'frontier-lab', title: 'Frontier Lab Learning Plan', phases };

fs.mkdirSync(path.join(ROOT, 'paths'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'paths/frontier-lab.json'),
                 JSON.stringify(out, null, 2) + '\n');

const counts = phases.reduce((a, p) => {
  a.tasks += p.tasks.length;
  for (const t of p.tasks) {
    a.subtasks += t.subtasks.length;
    for (const s of t.subtasks) a.steps += s.steps.length;
  }
  return a;
}, { tasks: 0, subtasks: 0, steps: 0 });

console.log(`converted: ${phases.length} phases, ${counts.tasks} tasks, `
          + `${counts.subtasks} subtasks, ${counts.steps} steps`);
```

- [ ] **Step 2: Run it**

```bash
node tools/convert-path.js
```

Expected: `converted: 5 phases, 36 tasks, 158 subtasks, 924 steps`. Those four numbers must match what `make check` reports today — 36 tasks, 158 subtasks, 924 step weights. **If any differ, content was lost; stop and find out which.**

- [ ] **Step 3: Verify no content was silently dropped**

```bash
node -e '
const p = JSON.parse(require("fs").readFileSync("paths/frontier-lab.json","utf8"));
let noDesc = 0, noSteps = 0, noRes = 0, ids = new Set(), dupes = 0;
for (const ph of p.phases) for (const t of ph.tasks) for (const s of t.subtasks) {
  if (!s.desc) noDesc++;
  if (!s.steps.length) noSteps++;
  if (!Object.keys(s.resources).length) noRes++;
  for (const id of [s.id, ...s.steps.map(x=>x.id)]) {
    if (ids.has(id)) dupes++; ids.add(id);
  }
}
console.log({ noDesc, noSteps, noRes, dupes, totalIds: ids.size });'
```

Expected: `dupes: 0`. A non-zero `noDesc` means the title join failed for that subtask — investigate before continuing. `noSteps` and `noRes` may legitimately be non-zero; note the counts.

- [ ] **Step 4: Commit the path, and the converter with it**

Commit the converter even though it is deleted later — it is the only record of how the ids were assigned, and anyone auditing a stale id will want it.

```bash
git add tools/convert-path.js paths/frontier-lab.json
git commit -m "Convert the curriculum into one path file with stable ids

The panel and resource split existed so make build could refuse to write
when the two disagreed. One file cannot disagree with itself.

Subtask ids are positional rather than slugified from titles. A slug
changes when the title is edited, which is precisely the failure this
migration exists to end."
```

---

### Task 8: The path validator

**Files:**
- Create: `tools/validate-path.js`, `test/validate-path.test.js`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Consumes: `paths/*.json` (Task 7).
- Produces:
  - `validatePath(path, previous) -> string[]` — a list of problems, empty when valid. `previous` may be `null` on first run.
  - `emit(paths, outDir) -> catalogue` — writes `public/paths/<id>-<hash>.json` plus `public/paths/index.json`, returning the catalogue object `{ paths: [{ id, title, url }] }`.
  - `pnpm validate` runs both.
  - `public/paths/` is generated and git-ignored; Vite copies `public/` into `dist/` verbatim.

- [ ] **Step 1: Write the failing test**

Create `test/validate-path.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { validatePath } from '../tools/validate-path.js';

const valid = () => ({
  id: 'p', title: 'P',
  phases: [{
    id: 'ph1', title: 'One', weeks: [1, 4], weight: 1,
    tasks: [{
      id: 't1', title: 'T', weeks: [1, 2], weight: 1,
      subtasks: [{
        id: 't1-s01', title: 'S', desc: 'd',
        steps: [{ id: 't1-s01-01', text: 'do it' }], resources: {}
      }]
    }]
  }]
});

describe('validatePath', () => {
  it('accepts a well-formed path', () => {
    expect(validatePath(valid(), null)).toEqual([]);
  });

  it('rejects a duplicate id anywhere in the tree', () => {
    const p = valid();
    p.phases[0].tasks[0].subtasks.push({
      id: 't1-s01', title: 'dup', desc: 'd', steps: [], resources: {}
    });
    expect(validatePath(p, null).join()).toMatch(/duplicate id/i);
  });

  it('rejects a week outside its phase range', () => {
    const p = valid();
    p.phases[0].tasks[0].weeks = [1, 9];
    expect(validatePath(p, null).join()).toMatch(/outside/i);
  });

  it('rejects weeks running backwards across tasks', () => {
    const p = valid();
    p.phases[0].tasks.push({
      id: 't2', title: 'T2', weeks: [1, 1], weight: 1,
      subtasks: [{ id: 't2-s01', title: 'S', desc: 'd', steps: [], resources: {} }]
    });
    expect(validatePath(p, null).join()).toMatch(/backwards|before/i);
  });

  it('rejects a subtask with no description, because the sidebar would open blank', () => {
    const p = valid();
    p.phases[0].tasks[0].subtasks[0].desc = '';
    expect(validatePath(p, null).join()).toMatch(/desc/i);
  });

  it('fails when an id present in the previous version has vanished — that orphans every user card keyed to it', () => {
    const previous = valid();
    const next = valid();
    next.phases[0].tasks[0].subtasks[0].id = 't1-s99';
    const problems = validatePath(next, previous).join();
    expect(problems).toMatch(/t1-s01/);
    expect(problems).toMatch(/removed|vanished/i);
  });

  it('allows adding new ids, because a path must be able to grow', () => {
    const previous = valid();
    const next = valid();
    next.phases[0].tasks[0].subtasks.push({
      id: 't1-s02', title: 'New', desc: 'd', steps: [], resources: {}
    });
    expect(validatePath(next, previous)).toEqual([]);
  });

  it('allows renaming a title freely, which is the whole point of stable ids', () => {
    const previous = valid();
    const next = valid();
    next.phases[0].tasks[0].subtasks[0].title = 'Completely different wording';
    expect(validatePath(next, previous)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/validate-path.test.js
```

Expected: FAIL — `tools/validate-path.js` does not exist.

- [ ] **Step 3: Write `tools/validate-path.js`**

```js
#!/usr/bin/env node
/**
 * Replaces tools/check.js. Validates every path and emits the hashed files
 * the browser fetches. Validation and emission live together so an invalid
 * path cannot be published.
 *
 * The rule that matters most is append-only ids. Locally, a careless rename
 * used to cost a blank sidebar. Hosted, changing an id silently orphans every
 * user's cards at once — so it fails the build instead.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function collectIds(p) {
  const ids = [];
  for (const ph of p.phases ?? []) {
    ids.push(ph.id);
    for (const t of ph.tasks ?? []) {
      ids.push(t.id);
      for (const s of t.subtasks ?? []) {
        ids.push(s.id);
        for (const st of s.steps ?? []) ids.push(st.id);
      }
    }
  }
  return ids;
}

export function validatePath(p, previous) {
  const problems = [];

  const seen = new Set();
  for (const id of collectIds(p)) {
    if (!id) problems.push('a node has no id');
    else if (seen.has(id)) problems.push(`duplicate id: ${id}`);
    seen.add(id);
  }

  let prevStart = 0;
  for (const ph of p.phases ?? []) {
    const [lo, hi] = ph.weeks ?? [];
    for (const t of ph.tasks ?? []) {
      if (t.weeks) {
        const [a, b] = t.weeks;
        if (a < lo || b > hi) {
          problems.push(`${t.id}: weeks ${a}-${b} outside phase range ${lo}-${hi}`);
        }
        if (a < prevStart) {
          problems.push(`${t.id}: week ${a} starts before an earlier task (week ${prevStart})`);
        }
        prevStart = Math.max(prevStart, a);
      }
      for (const s of t.subtasks ?? []) {
        if (!s.desc) problems.push(`${s.id}: no desc — the sidebar would open blank`);
      }
    }
  }

  if (previous) {
    const now = new Set(collectIds(p));
    for (const id of collectIds(previous)) {
      if (!now.has(id)) {
        problems.push(`id removed: ${id} — user cards and progress reference it`);
      }
    }
  }

  return problems;
}

export function emit(paths, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const catalogue = { paths: [] };

  for (const p of paths) {
    const body = JSON.stringify(p);
    const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 8);
    const file = `${p.id}-${hash}.json`;
    fs.writeFileSync(path.join(outDir, file), body);
    catalogue.paths.push({ id: p.id, title: p.title, url: `/paths/${file}` });
  }

  fs.writeFileSync(path.join(outDir, 'index.json'),
                   JSON.stringify(catalogue, null, 2) + '\n');
  return catalogue;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.join(ROOT, 'paths');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const failures = [];
  const loaded = [];

  for (const f of files) {
    const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    // The previous committed version, for the append-only check.
    let previous = null;
    try {
      const { execFileSync } = await import('node:child_process');
      previous = JSON.parse(
        execFileSync('git', ['show', `HEAD:paths/${f}`], { encoding: 'utf8' })
      );
    } catch {
      // First commit of this path — nothing to diff against.
    }
    const problems = validatePath(p, previous);
    if (problems.length) failures.push([f, problems]);
    loaded.push(p);
  }

  if (failures.length) {
    for (const [f, problems] of failures) {
      console.error(`FAIL ${f} — ${problems.length} problem(s):`);
      problems.slice(0, 20).forEach(x => console.error('  ' + x));
    }
    process.exit(1);
  }

  const catalogue = emit(loaded, path.join(ROOT, 'public', 'paths'));
  console.log(`OK — ${loaded.length} path(s): `
            + catalogue.paths.map(p => p.id).join(', '));
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run test/validate-path.test.js
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Validate the real path and emit it**

```bash
node tools/validate-path.js
ls public/paths/
```

Expected: `OK — 1 path(s): frontier-lab`, and two files — `frontier-lab-<hash>.json` and `index.json`. If validation fails, Task 7's conversion produced something malformed; fix it there rather than loosening the validator.

- [ ] **Step 6: Wire it into the scripts and ignore the output**

In `package.json`:

```json
"validate": "node tools/validate-path.js",
"build": "node tools/validate-path.js && vite build",
```

Append to `.gitignore`:

```
public/paths/
```

The emitted files are generated from `paths/*.json` on every build, so committing them would only create a second thing that can drift.

- [ ] **Step 7: Commit**

```bash
git add tools/validate-path.js test/validate-path.test.js package.json .gitignore
git commit -m "Add the path validator that replaces make check

Ids are append-only and the check diffs against the committed version to
enforce it. Renaming a title is now free; removing an id fails the build,
because hosted it would orphan every user's cards at once rather than
just one person's.

Validation and emission live in one tool so an invalid path cannot be
published. Path files carry a content hash so they can be cached
immutably and a content edit produces a new filename instead of needing
a purge."
```

---

### Task 9: Content loading and weights

**Files:**
- Create: `src/content.js`, `src/weights.js`, `test/weights.test.js`
- Move: `api.js` → `src/api.js`, `today.js` → `src/today.js`, `main.js` → `src/main.js`

**Interfaces:**
- Consumes: `/paths/index.json` and the hashed path files (Task 8).
- Produces:
  - `loadCatalogue() -> Promise<{paths:[{id,title,url}]}>`
  - `loadPath(pathId) -> Promise<path>` — resolves via the catalogue, caches in the Cache API, falls back to the cached copy when the network fails
  - `indexPath(path) -> { phases, tasks, subtasks, steps, taskOf, subtaskOf }` — flat `Map`s from id to node, plus parent lookups
  - `computeWeights(path) -> { phases: {id: n}, tasks: {id: n}, subtasks: {id: n}, steps: {id: n} }`
- Weight rules, carried over from `tools/build.js` unchanged: phase and task weights are explicit in the path; subtask weight is `taskWeight / subtaskCount`; step weight is 3 for build/verify verbs, 2 for practice verbs, 1 otherwise.

- [ ] **Step 1: Write the failing test**

Create `test/weights.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeWeights, indexPath } from '../src/weights.js';

const path = {
  id: 'p', title: 'P',
  phases: [{
    id: 'ph1', title: 'One', weeks: [1, 4], weight: 10,
    tasks: [{
      id: 't1', title: 'T', weeks: [1, 2], weight: 8,
      subtasks: [
        { id: 't1-s01', title: 'A', desc: 'd', resources: {},
          steps: [
            { id: 't1-s01-01', text: 'Implement the tokenizer' },
            { id: 't1-s01-02', text: 'Run the benchmark suite' },
            { id: 't1-s01-03', text: 'Read the paper' }
          ] },
        { id: 't1-s02', title: 'B', desc: 'd', resources: {}, steps: [] }
      ]
    }]
  }]
};

describe('computeWeights', () => {
  it('takes phase and task weights straight from the path', () => {
    const w = computeWeights(path);
    expect(w.phases.ph1).toBe(10);
    expect(w.tasks.t1).toBe(8);
  });

  it('divides a task weight evenly across its subtasks', () => {
    const w = computeWeights(path);
    expect(w.subtasks['t1-s01']).toBe(4);
    expect(w.subtasks['t1-s02']).toBe(4);
  });

  it('scores a build verb above a practice verb above a read verb, because effort is not uniform', () => {
    const w = computeWeights(path);
    expect(w.steps['t1-s01-01']).toBe(3);   // implement
    expect(w.steps['t1-s01-02']).toBe(2);   // run
    expect(w.steps['t1-s01-03']).toBe(1);   // read
  });

  it('never divides by zero when a task has no subtasks', () => {
    const empty = { id: 'p', phases: [{ id: 'ph', weeks: [1,1], weight: 1,
      tasks: [{ id: 't', weeks: [1,1], weight: 4, subtasks: [] }] }] };
    expect(() => computeWeights(empty)).not.toThrow();
  });
});

describe('indexPath', () => {
  it('maps every id to its node and every child to its parent', () => {
    const ix = indexPath(path);
    expect(ix.subtasks.get('t1-s01').title).toBe('A');
    expect(ix.steps.get('t1-s01-02').text).toMatch(/benchmark/);
    expect(ix.taskOf.get('t1-s01')).toBe('t1');
    expect(ix.subtaskOf.get('t1-s01-01')).toBe('t1-s01');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/weights.test.js
```

Expected: FAIL — `src/weights.js` does not exist.

- [ ] **Step 3: Write `src/weights.js`**

```js
/**
 * Weight derivation, moved out of tools/build.js. Phase and task weights are
 * authored; subtask and step weights are derived, so adding a step never
 * requires editing a weights file.
 *
 * These regexes are carried over unchanged. A step that builds something
 * costs more than a step that reads something, and the progress bar should
 * say so.
 */
const BUILD = /\b(implement|build|write|derive|train|construct|create|port|rewrite|reproduce|fit|profile|benchmark|verify|prove|measure|publish|submit|ship|instrument|harden)\b/i;
const PRACTICE = /\b(practice|solve|work through|run|configure|set up|experiment|debug|trace|compare|classify|annotate|refactor|test|audit|inspect)\b/i;

export const stepWeight = text => (BUILD.test(text) ? 3 : PRACTICE.test(text) ? 2 : 1);

export function indexPath(path) {
  const phases = new Map(), tasks = new Map(), subtasks = new Map(), steps = new Map();
  const taskOf = new Map(), subtaskOf = new Map(), phaseOf = new Map();

  for (const ph of path.phases ?? []) {
    phases.set(ph.id, ph);
    for (const t of ph.tasks ?? []) {
      tasks.set(t.id, t);
      phaseOf.set(t.id, ph.id);
      for (const s of t.subtasks ?? []) {
        subtasks.set(s.id, s);
        taskOf.set(s.id, t.id);
        for (const st of s.steps ?? []) {
          steps.set(st.id, st);
          subtaskOf.set(st.id, s.id);
        }
      }
    }
  }
  return { phases, tasks, subtasks, steps, taskOf, subtaskOf, phaseOf };
}

export function computeWeights(path) {
  const w = { phases: {}, tasks: {}, subtasks: {}, steps: {} };

  for (const ph of path.phases ?? []) {
    w.phases[ph.id] = ph.weight ?? 1;
    for (const t of ph.tasks ?? []) {
      w.tasks[t.id] = t.weight ?? 1;
      const subs = t.subtasks ?? [];
      const each = subs.length ? (t.weight ?? 1) / subs.length : 0;
      for (const s of subs) {
        w.subtasks[s.id] = each;
        for (const st of s.steps ?? []) w.steps[st.id] = stepWeight(st.text);
      }
    }
  }
  return w;
}
```

- [ ] **Step 4: Write `src/content.js`**

```js
/**
 * Path loading. The catalogue is revalidated on every load and maps an id to
 * a content-hashed URL; the path file itself is immutable, so it is cached
 * forever and a content edit simply produces a different filename.
 */
const CACHE = 'flp-paths-v1';

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url} — ${res.status}`);
  return res.json();
}

export async function loadCatalogue() {
  return fetchJSON('/paths/index.json', { cache: 'no-cache' });
}

export async function loadPath(pathId) {
  const catalogue = await loadCatalogue();
  const entry = catalogue.paths.find(p => p.id === pathId);
  if (!entry) throw new Error(`unknown path "${pathId}"`);

  // Hashed filename means a hit is always the right content.
  const cache = await caches.open(CACHE);
  const hit = await cache.match(entry.url);
  if (hit) return hit.json();

  const res = await fetch(entry.url);
  if (!res.ok) throw new Error(`${entry.url} — ${res.status}`);
  await cache.put(entry.url, res.clone());
  return res.json();
}
```

- [ ] **Step 5: Move the surviving frontend modules**

```bash
mkdir -p src
git mv api.js src/api.js
git mv today.js src/today.js
git mv main.js src/main.js
```

- [ ] **Step 6: Run the tests**

```bash
pnpm vitest run test/weights.test.js
```

Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add src test
git commit -m "Add path loading and runtime weight derivation

Subtask and step weights are derived rather than stored, so adding a step
never means editing a weights file that can drift from the content it
describes. The verb regexes move across from tools/build.js unchanged.

Path files are cached by hashed filename, so a cache hit is always the
right content and an edit needs no purge."
```

---

### Task 10: Render the plan from data

**Files:**
- Create: `src/render-path.js`, `src/nav.js`, `src/progress.js`
- Modify: `index.html` (strip the generated panels down to a shell)

**Interfaces:**
- Consumes: `indexPath`/`computeWeights` (Task 9), `API` (`src/api.js`).
- Produces:
  - `renderPath(path, root)` — builds one `.view-panel` per phase, with the same class names the existing CSS already targets: `day-section`, `day-header`, `task-grid`, `task-item`, `task-item-title`, `task-item-desc`, `task-item-time`.
  - `setProgressState(nodeIds)` / `isDone(nodeId)` / `toggle(nodeId, done)` in `src/progress.js`
  - `rollup(path, weights, doneSet) -> { subtasks: {id: pct}, tasks, phases, overall }` — the Covered calculation, hierarchical
  - `initNav()` in `src/nav.js`, defaulting to `#today`

- [ ] **Step 1: Write the failing test for the rollup**

The rollup is the one piece of this task that is pure and worth testing directly; rendering is verified in a browser.

Create `test/rollup.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeWeights } from '../src/weights.js';
import { rollup } from '../src/progress.js';

const path = {
  id: 'p',
  phases: [{
    id: 'ph1', weeks: [1, 4], weight: 1,
    tasks: [{
      id: 't1', weeks: [1, 2], weight: 2,
      subtasks: [
        { id: 's1', desc: 'd', resources: {},
          steps: [{ id: 's1-01', text: 'Read it' }, { id: 's1-02', text: 'Read it again' }] },
        { id: 's2', desc: 'd', resources: {}, steps: [] }
      ]
    }]
  }]
};

const w = computeWeights(path);

describe('rollup', () => {
  it('is zero with nothing done', () => {
    expect(rollup(path, w, new Set()).overall).toBe(0);
  });

  it('is one hundred with everything done', () => {
    const all = new Set(['s1-01', 's1-02', 's2']);
    expect(Math.round(rollup(path, w, all).overall)).toBe(100);
  });

  it('treats a stepless subtask as its own single checkbox', () => {
    const r = rollup(path, w, new Set(['s2']));
    expect(r.subtasks.s2).toBe(100);
    expect(r.subtasks.s1).toBe(0);
  });

  it('weights a half-done subtask by step weight rather than step count', () => {
    const r = rollup(path, w, new Set(['s1-01']));
    expect(r.subtasks.s1).toBe(50);   // both steps are read verbs, weight 1 each
  });

  it('normalises at each level, so one finished subtask of two is half the task', () => {
    const r = rollup(path, w, new Set(['s2']));
    expect(Math.round(r.tasks.t1)).toBe(50);
    expect(Math.round(r.phases.ph1)).toBe(50);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/rollup.test.js
```

Expected: FAIL — `src/progress.js` does not exist.

- [ ] **Step 3: Write `src/progress.js`**

```js
/**
 * Completion state and the Covered rollup.
 *
 * Progress is a set of done node ids — presence, not flags — matching how the
 * database stores it. A step id is present when that step is done; for a
 * subtask with no steps, the subtask's own id stands in.
 */
import { API } from './api.js';

let done = new Set();

export function setProgressState(nodeIds) {
  done = new Set(nodeIds);
}

export function isDone(nodeId) {
  return done.has(nodeId);
}

export function allDone() {
  return done;
}

export async function toggle(pathId, nodeId, want) {
  if (want) done.add(nodeId); else done.delete(nodeId);
  await API.setProgress(pathId, nodeId, want);
}

/**
 * Hierarchical, normalising at every level: steps into a subtask, subtasks
 * into a task, tasks into a phase, phases into the overall number. Retained
 * must use this same shape — a flat weighted mean over subtasks reads higher
 * than Covered and makes the pair meaningless.
 */
export function rollup(path, weights, doneSet) {
  const out = { subtasks: {}, tasks: {}, phases: {}, overall: 0 };
  let overallSum = 0, overallTotal = 0;

  for (const ph of path.phases ?? []) {
    let phaseSum = 0, phaseTotal = 0;

    for (const t of ph.tasks ?? []) {
      let taskSum = 0, taskTotal = 0;

      for (const s of t.subtasks ?? []) {
        const steps = s.steps ?? [];
        let sSum = 0, sTotal = 0;

        if (steps.length) {
          for (const st of steps) {
            const w = weights.steps[st.id] ?? 1;
            sSum += (doneSet.has(st.id) ? 1 : 0) * w;
            sTotal += w;
          }
        } else {
          sSum = doneSet.has(s.id) ? 1 : 0;
          sTotal = 1;
        }

        const pct = sTotal > 0 ? (sSum / sTotal) * 100 : 0;
        out.subtasks[s.id] = pct;

        const sw = weights.subtasks[s.id] ?? 1;
        taskSum += pct * sw;
        taskTotal += sw;
      }

      const taskPct = taskTotal > 0 ? taskSum / taskTotal : 0;
      out.tasks[t.id] = taskPct;

      const tw = weights.tasks[t.id] ?? 1;
      phaseSum += taskPct * tw;
      phaseTotal += tw;
    }

    const phasePct = phaseTotal > 0 ? phaseSum / phaseTotal : 0;
    out.phases[ph.id] = phasePct;

    const pw = weights.phases[ph.id] ?? 1;
    overallSum += phasePct * pw;
    overallTotal += pw;
  }

  out.overall = overallTotal > 0 ? overallSum / overallTotal : 0;
  return out;
}
```

- [ ] **Step 4: Run the rollup tests**

```bash
pnpm vitest run test/rollup.test.js
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Write `src/render-path.js`**

The class names below are the ones `style.css` already styles, so no CSS changes are needed.

```js
/**
 * Builds the phase views from a path. This replaces tools/render.py: the same
 * markup, produced in the browser from data instead of baked into index.html
 * at build time.
 */
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function subtaskCard(s) {
  return `
    <div class="task-item" data-subtask-id="${esc(s.id)}">
      <div class="task-item-header">
        <div class="task-item-title">${esc(s.title)}</div>
      </div>
      <div class="task-item-desc">${esc(s.desc)}</div>
      <div class="task-item-time">${esc(s.time ?? '')}</div>
    </div>`;
}

function taskSection(t) {
  return `
    <div class="day-section" id="sec-${esc(t.id)}">
      <div class="day-header">
        <span class="day-num-badge">${esc(t.badge ?? '')}</span>
        <span class="day-title-text">${esc(t.title)}</span>
        <label class="day-check">
          <input type="checkbox" data-id="${esc(t.id)}">
        </label>
      </div>
      <div class="task-grid">
        ${(t.subtasks ?? []).map(subtaskCard).join('')}
      </div>
    </div>`;
}

function phasePanel(ph) {
  return `
    <div id="view-${esc(ph.id)}" class="view-panel">
      <div class="container">
        <div class="page-hero">
          <div class="page-hero-eyebrow">${esc(ph.num)} · Weeks ${ph.weeks?.[0]}–${ph.weeks?.[1]}</div>
          <h1>${esc(ph.title)}</h1>
          <p>${esc(ph.intro)}</p>
        </div>
        ${(ph.tasks ?? []).map(taskSection).join('')}
      </div>
    </div>`;
}

export function renderPath(path, root) {
  root.insertAdjacentHTML('beforeend',
    (path.phases ?? []).map(phasePanel).join(''));
}

export function renderNav(path, nav) {
  nav.insertAdjacentHTML('beforeend',
    (path.phases ?? []).map(ph =>
      `<a href="#${esc(ph.id)}">${esc(ph.num || ph.id)}</a>`).join(''));
}
```

- [ ] **Step 6: Write `src/nav.js`**

```js
/**
 * Hash routing. Today is the default: the app opens on what is due, not on
 * an overview of what exists.
 */
export function initNav() {
  const apply = () => {
    const hash = window.location.hash || '#today';
    const id = 'view-' + hash.slice(1);
    document.querySelectorAll('.view-panel').forEach(v =>
      v.classList.toggle('active', v.id === id));
    document.querySelectorAll('.nav a').forEach(a =>
      a.classList.toggle('active', a.getAttribute('href') === hash));
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', apply);
  apply();
}
```

- [ ] **Step 7: Strip `index.html` to a shell**

Delete every `<div id="view-phase*">` panel and the `<div id="view-overview">` panel. Keep: the `<head>`, the `<header>` with its `<nav>` (leaving only the `Today` link — phase links are appended at runtime by `renderNav`), the `view-today` panel, the `runner` overlay, and the `<!-- SCRIPTS -->` marker with its module tag.

Add an empty mount point immediately before the `<!-- SCRIPTS -->` marker:

```html
<div id="phase-views"></div>
```

- [ ] **Step 8: Commit**

```bash
git add src index.html test
git commit -m "Render the plan from data instead of baking it into the HTML

The markup and class names are the ones style.css already targets, so
this is the same page produced at runtime rather than by render.py at
build time. index.html drops from 2,100 lines to a shell.

The rollup is extracted and tested directly, because Covered and
Retained have to normalise identically at every level and that is far
easier to assert here than through the DOM."
```

---

### Task 11: Rewire the app — sidebar, capture, Today

**Files:**
- Create: `src/sidebar.js`
- Modify: `src/api.js`, `src/today.js`, `src/main.js`

**Interfaces:**
- Consumes: everything from Tasks 9 and 10.
- Produces:
  - `src/api.js` gains `getMe()`, `enrol(pathId, startedOn)`, `getProgress(pathId)`, `setProgress(pathId, nodeId, done)`, `getCards(pathId)`, `createCard({pathId, subtaskId, prompt, answer})`, `review(cardId, grade, latencyMs)`. The outbox is unchanged.
  - `src/sidebar.js` exports `openSidebar(subtaskId)` and `initSidebar(ctx)`, where `ctx = { path, index, weights, pathId }`.
  - `src/today.js` exports `initToday(ctx)`, which wires the DOM listeners and sets `window.TODAY = { render, dueCards, startReview, retained }`. The four methods are unchanged in shape; only their data sources move.
  - `window.TODAY` and `window.CAPTURE_STATE` remain for console access. Nothing else goes on `window`.

- [ ] **Step 1: Rewrite the API surface in `src/api.js`**

Keep the outbox, `pendingCount`, `flushOutbox`, `dequeue` and the `nextId` collision fix exactly as they are. Replace only the endpoint methods:

```js
  async getMe() {
    return API.request('GET', '/api/me');
  },

  async enrol(pathId, startedOn) {
    return API.mutate('POST', '/api/enrollments', { pathId, startedOn });
  },

  async getProgress(pathId) {
    try {
      const { nodeIds } = await API.request('GET', `/api/progress?pathId=${encodeURIComponent(pathId)}`);
      API.online = true;
      write(CACHE_PROGRESS, nodeIds);
      return nodeIds;
    } catch {
      API.online = false;
      return read(CACHE_PROGRESS, []);
    }
  },

  async setProgress(pathId, nodeId, done) {
    return API.mutate('PUT', '/api/progress', { pathId, nodeId, done });
  },

  async getCards(pathId) {
    try {
      const { cards } = await API.request('GET', `/api/cards?pathId=${encodeURIComponent(pathId)}`);
      API.online = true;
      write(CACHE_CARDS, cards);
      return cards;
    } catch {
      API.online = false;
      return read(CACHE_CARDS, []);
    }
  },

  async createCard(fields) {
    const res = await API.mutate('POST', '/api/cards', fields);
    return res ? res.card : null;
  },

  async review(cardId, grade, latencyMs) {
    const res = await API.mutate('POST', '/api/reviews', { cardId, grade, latencyMs });
    return res ? res.card : null;
  },
```

Add `const CACHE_PROGRESS = 'flp_cache_progress';` beside the other cache keys.

- [ ] **Step 2: Write `src/sidebar.js`**

Lift `injectSidebar`, `openSidebar`, `closeSidebar`, `hasCardFor` and `renderCaptureForm` out of the old `app.js`, changing three things: resources come from the path node rather than `RESOURCES_DB`; step checkboxes carry `data-node-id` instead of the four-part key; and capture posts `subtaskId`.

```js
import { API } from './api.js';
import { isDone, toggle, rollup, allDone } from './progress.js';

let ctx = null;                       // { path, index, weights, pathId }
export const CAPTURE_STATE = { cards: [] };
window.CAPTURE_STATE = CAPTURE_STATE;

export function initSidebar(context) {
  ctx = context;
  if (document.getElementById('resources-sidebar')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'sidebar-backdrop';
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  const sidebar = document.createElement('div');
  sidebar.id = 'resources-sidebar';
  sidebar.className = 'resources-sidebar';
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-title" id="sidebar-title"></div>
      <button class="sidebar-close-btn" id="sidebar-close-btn">&times;</button>
    </div>
    <div class="sidebar-body" id="sidebar-body"></div>`;
  document.body.appendChild(sidebar);

  document.getElementById('sidebar-close-btn').addEventListener('click', closeSidebar);
  backdrop.addEventListener('click', closeSidebar);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

  document.addEventListener('click', e => {
    const item = e.target.closest('.task-item');
    if (item && !e.target.closest('a') && !e.target.closest('input')) {
      openSidebar(item.dataset.subtaskId);
    }
  });
}

export function hasCardFor(subtaskId) {
  return CAPTURE_STATE.cards.some(c => c.subtask_id === subtaskId);
}

export function closeSidebar() {
  document.getElementById('sidebar-backdrop')?.classList.remove('active');
  document.getElementById('resources-sidebar')?.classList.remove('active');
}

const KINDS = [
  ['courses', 'Courses & Tutorials', 'name'],
  ['papers', 'Research Papers', 'name'],
  ['lectures', 'Lecture Notes', 'name'],
  ['docs', 'Documentation', 'name'],
  ['videos', 'Videos', 'title'],
  ['podcasts', 'Podcasts', 'title']
];

export function openSidebar(subtaskId) {
  const s = ctx.index.subtasks.get(subtaskId);
  if (!s) return;

  document.getElementById('sidebar-title').innerHTML =
    `<div style="font-size:14px">${s.title}</div>
     <div class="sidebar-subtask-weight"><span>Subtask Weight: ${
       (ctx.weights.subtasks[s.id] ?? 0).toFixed(1)}</span></div>`;

  const steps = s.steps ?? [];
  let html = `<div class="sidebar-section">
      <div class="sidebar-section-title">Overview &amp; Goal</div>
      <p class="sidebar-desc">${s.desc}</p></div>`;

  html += `<div class="sidebar-section">
     <div class="sidebar-section-title">${steps.length ? 'Step-by-Step Guide' : 'Status'}</div>
     <ul class="sidebar-steps" style="list-style:none">`;

  if (steps.length) {
    for (const st of steps) {
      html += `<li class="sidebar-step-item">
        <label class="step-check-label">
          <input type="checkbox" class="step-checkbox" data-node-id="${st.id}"
                 data-subtask-id="${s.id}" ${isDone(st.id) ? 'checked' : ''}>
          <span class="step-text">${st.text}</span>
        </label>
        <div class="weight-input-container"><span>w: ${ctx.weights.steps[st.id]}</span></div>
      </li>`;
    }
  } else {
    html += `<li class="sidebar-step-item">
      <label class="step-check-label">
        <input type="checkbox" class="step-checkbox" data-node-id="${s.id}"
               data-subtask-id="${s.id}" ${isDone(s.id) ? 'checked' : ''}>
        <span class="step-text">Mark this subtask as completed</span>
      </label></li>`;
  }
  html += '</ul></div>';

  for (const [key, heading, nameField] of KINDS) {
    const list = s.resources?.[key];
    if (!list?.length) continue;
    html += `<div class="sidebar-section">
      <div class="sidebar-section-title">${heading}</div>
      ${list.map(r => `<div class="sidebar-resource-card">
        <div class="sidebar-resource-name">${r[nameField] ?? r.name ?? r.title}</div>
        <a class="sidebar-resource-link" href="${r.url}" target="_blank">Open ↗</a>
      </div>`).join('')}</div>`;
  }

  const body = document.getElementById('sidebar-body');
  body.innerHTML = html;

  body.querySelectorAll('.step-checkbox').forEach(cb => {
    cb.addEventListener('change', async () => {
      await toggle(ctx.pathId, cb.dataset.nodeId, cb.checked);
      const calc = rollup(ctx.path, ctx.weights, allDone());
      window.TODAY?.render();

      const sid = cb.dataset.subtaskId;
      if (cb.checked && calc.subtasks[sid] === 100 && !hasCardFor(sid)) {
        renderCaptureForm(sid);
      }
    });
  });

  document.getElementById('sidebar-backdrop').classList.add('active');
  document.getElementById('resources-sidebar').classList.add('active');
}

// Writing the card is itself the strongest available study act, which is why
// it happens at the moment the work is finished rather than being authored up
// front against material not yet learned.
export function renderCaptureForm(subtaskId) {
  const body = document.getElementById('sidebar-body');
  if (!body || body.querySelector('.capture-form')) return;

  const form = document.createElement('div');
  form.className = 'capture-form sidebar-section';
  form.innerHTML = `
    <div class="sidebar-section-title">Capture what stuck</div>
    <p class="sidebar-desc">Finished. Write it down now, in your own words —
      this is the part that makes it survive.</p>
    <label class="capture-label">What do you now know?</label>
    <textarea class="capture-input" id="capture-answer" rows="4"></textarea>
    <label class="capture-label">One question that would catch you if you forgot it</label>
    <textarea class="capture-input" id="capture-prompt" rows="2"></textarea>
    <div class="capture-actions">
      <button class="capture-save" id="capture-save">Save card</button>
      <button class="capture-skip" id="capture-skip">Skip</button>
      <span class="capture-status" id="capture-status"></span>
    </div>`;
  body.prepend(form);

  document.getElementById('capture-skip').addEventListener('click', () => form.remove());
  document.getElementById('capture-save').addEventListener('click', async () => {
    const answer = document.getElementById('capture-answer').value.trim();
    const prompt = document.getElementById('capture-prompt').value.trim();
    const status = document.getElementById('capture-status');
    if (!answer || !prompt) {
      status.textContent = 'Both fields, or it is not reviewable.';
      return;
    }
    status.textContent = 'Saving…';
    const card = await API.createCard({ pathId: ctx.pathId, subtaskId, prompt, answer });
    CAPTURE_STATE.cards = await API.getCards(ctx.pathId);
    status.textContent = card ? 'Saved.' : 'Queued — you are offline.';
    window.TODAY?.render();
    setTimeout(() => form.remove(), 1200);
  });
}
```

- [ ] **Step 3: Rewire `src/today.js`**

Four changes; everything else stays:

1. Imports become `import { CAPTURE_STATE, hasCardFor } from './sidebar.js'`, `import { rollup, allDone } from './progress.js'`, `import * as SCHEDULER from '../worker/scheduler.js'`, plus the module `ctx` passed in from `main.js`.
2. `weightOf(card)` becomes `ctx.weights.subtasks[card.subtask_id] ?? 1`.
3. `renderWeek` reads `startedOn` from `API.getMe()`'s enrolments rather than `/api/state`, and calls `API.enrol(ctx.pathId, localDate(new Date()))`. `localDate` and `parseLocalDate` are unchanged — they exist because `toISOString` returns the UTC day and would shift the plan start for anyone west of UTC.
4. `retained()` walks `ctx.path` instead of `ALL_PHASES` and groups cards by `subtask_id`. It keeps the identical hierarchical shape as `rollup` — subtask mean retrievability, then task, then phase, then overall, normalising at each level. A flat weighted mean over subtasks reads higher than Covered and makes the pair meaningless.

- [ ] **Step 4: Write `src/main.js`**

```js
import './style.css';
import { loadPath } from './content.js';
import { indexPath, computeWeights } from './weights.js';
import { setProgressState, rollup, allDone } from './progress.js';
import { renderPath, renderNav } from './render-path.js';
import { initNav } from './nav.js';
import { initSidebar, CAPTURE_STATE } from './sidebar.js';
import { initToday } from './today.js';
import { API } from './api.js';

const PATH_ID = 'frontier-lab';

async function boot() {
  await API.flushOutbox();

  const path = await loadPath(PATH_ID);
  const ctx = {
    path, pathId: PATH_ID,
    index: indexPath(path),
    weights: computeWeights(path)
  };

  renderPath(path, document.getElementById('phase-views'));
  renderNav(path, document.querySelector('.nav'));
  initSidebar(ctx);
  initNav();

  setProgressState(await API.getProgress(PATH_ID));
  CAPTURE_STATE.cards = await API.getCards(PATH_ID);

  initToday(ctx);
  window.TODAY.render();
}

document.addEventListener('DOMContentLoaded', boot);
```

- [ ] **Step 5: Point the Vite proxy at the Worker**

In `vite.config.js`, change the proxy target from `http://localhost:8000` to `http://localhost:8787` — wrangler's default port.

- [ ] **Step 6: Verify in a browser**

```bash
pnpm db:migrate:local
pnpm validate
pnpm dev:worker &
pnpm dev
```

Open `http://localhost:5173`. Check each of these:

- Today is the landing view, with a **Set plan start date** button
- Phase links appear in the nav and each phase renders its tasks and subtasks
- Clicking a subtask opens the sidebar with description, steps and resources
- Ticking every step of a subtask raises the capture form; saving it makes the due count go to 1
- **Start review** runs the card; grading `again` returns it within the session
- Covered and Retained both appear, and Retained never exceeds Covered

```bash
pnpm wrangler d1 execute frontier-lab --local --command \
  "SELECT count(*) AS cards FROM cards; SELECT count(*) AS reviews FROM reviews"
```

Expected: counts matching what you did in the UI.

- [ ] **Step 7: Commit**

```bash
git add src vite.config.js
git commit -m "Rewire the frontend onto the path model and the Worker API

Step checkboxes carry a node id rather than a four-part key built from
page, task id, subtask title and index. That string was the reason a
rename destroyed progress; it no longer exists.

localDate survives the move unchanged. toISOString returns the UTC day
and would shift the plan start by one for anyone west of UTC — a bug
this already hit once."
```

---

### Task 12: Delete the old world and deploy

**Files:**
- Delete: `server/`, `tools/render.py`, `tools/build.js`, `tools/check.js`, `tools/convert-path.js`, `resources_db.js`, `app.js`, `Makefile`, `data/panels/`, `data/resources/`, `data/weights.json`, `data/cards.json`, `data/reviews.jsonl`, `data/state.json`
- Modify: `package.json`, `README.md`

**Interfaces:**
- Consumes: everything. Nothing depends on this task.

This lands last on purpose: until runtime rendering works, the generated files are the only thing that renders the plan at all.

- [ ] **Step 1: Confirm nothing still references the old files**

```bash
grep -rn "resources_db\|RESOURCES_DB\|ALL_PHASES\|STATIC_WEIGHTS\|getPageForTask\|server/index\|server/store" \
  --include=*.js --include=*.html --include=*.json . \
  | grep -v node_modules | grep -v '^./docs/' | grep -v '^./dist/'
```

Expected: no output. Any hit is a live reference — fix it before deleting.

- [ ] **Step 2: Delete**

```bash
git rm -r server data/panels data/resources tools/render.py tools/build.js \
        tools/check.js tools/convert-path.js resources_db.js app.js Makefile \
        data/weights.json
git rm --cached data/cards.json data/reviews.jsonl data/state.json 2>/dev/null || true
rm -f data/cards.json data/reviews.jsonl data/state.json
```

The three `data/*.json` state files were the file-backed store. Their contents were dummy data and D1 holds this now.

- [ ] **Step 3: Prune `package.json`**

Remove `serve`, `render`, `gen` and `check`. The script list becomes:

```json
"dev": "vite",
"dev:worker": "wrangler dev",
"build": "node tools/validate-path.js && vite build",
"validate": "node tools/validate-path.js",
"preview": "vite preview",
"test": "vitest run",
"db:migrate:local": "wrangler d1 migrations apply frontier-lab --local",
"db:migrate": "wrangler d1 migrations apply frontier-lab --remote",
"deploy": "vite build && wrangler deploy"
```

- [ ] **Step 4: Rewrite the README's running instructions**

Replace the **Running it**, **Working on the UI** and **Commands** sections with:

````markdown
## Running it

Node 24 and pnpm. Cloudflare Wrangler handles the rest.

```sh
pnpm install
pnpm db:migrate:local     # create the local D1 schema and seed the dev user
pnpm validate             # check the paths and emit them into public/paths/
pnpm dev:worker           # terminal 1 — the Worker and D1 on :8787
pnpm dev                  # terminal 2 — Vite on :5173, proxying /api
```

Open <http://localhost:5173>. **Today** is the landing view; press
**Set plan start date** first, since the plan-week reading depends on it.

Deploy with `pnpm deploy`, and apply migrations to the real database with
`pnpm db:migrate`.

## Commands

```
pnpm validate     validate paths/*.json and emit public/paths/
pnpm test         vitest — scheduler, worker routes, isolation, validator
pnpm build        validate, then bundle into dist/
pnpm deploy       build and push the Worker
pnpm db:migrate   apply migrations to the remote D1
```
````

Also delete the "The one thing to know before editing" section describing the
three-file agreement — those three files no longer exist. Replace it with:

````markdown
## The one thing to know before editing

Node **ids** in `paths/*.json` are load-bearing: user progress rows and cards
reference them. `pnpm validate` diffs each path against its last committed
version and fails if an id has changed or vanished.

Titles are display-only. **Rename them freely.**
````

- [ ] **Step 5: Run everything**

```bash
pnpm test
pnpm validate
pnpm build
```

Expected: all tests pass, validation passes, the bundle builds.

- [ ] **Step 6: Deploy and migrate the real database**

```bash
pnpm db:migrate
pnpm deploy
```

Open the deployed URL. Set the plan start date, tick a subtask, capture a card,
review it. Then confirm it reached the real database:

```bash
pnpm wrangler d1 execute frontier-lab --remote --command \
  "SELECT count(*) FROM cards"
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Delete the build pipeline and ship the hosted app

render.py, build.js, check.js, resources_db.js and the 2,100-line app.js
all existed to compile a curriculum into a page. The curriculum is data
now, so they have nothing left to do.

This lands last because until runtime rendering worked, the generated
files were the only thing that rendered the plan at all."
```

---

## Verification checklist

Run after Task 12:

- [ ] `pnpm test` — scheduler, isolation, progress, cards, reviews, me, validator, weights, rollup
- [ ] `pnpm validate` — passes, and fails if you rename an id by hand
- [ ] Renaming a subtask **title** changes the display and nothing else
- [ ] Today is the landing view on the deployed URL
- [ ] Finishing a subtask raises the capture form; the card reaches D1
- [ ] Grading `again` returns the card within the session and schedules it one day out
- [ ] Retained is strictly below Covered while any finished subtask lacks a card
- [ ] With the Worker stopped, the page still renders from cache and ticks queue
- [ ] Seeding a second user in the remote D1 shows neither user the other's cards
- [ ] `DELETE /api/me` empties every table for that user and no other
