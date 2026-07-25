# Hosted platform, sub-project 1: foundation — design

Date: 2026-07-25
Status: approved, not yet planned

## Problem

The tracker is a single-user local app whose curriculum is compiled into its
own HTML. `tools/render.py` bakes `data/panels/*.json` into `index.html`,
`tools/build.js` generates `resources_db.js` and the `app.js` registries, and
`tools/check.js` exists to catch the three drifting apart. Progress keys embed
the literal subtask *title*.

None of that survives contact with the goal: a hosted app where strangers sign
in and follow one of several learning paths. Content has to become runtime
data, storage has to become per-user rows, and a title rename has to stop
being a data-loss event.

## Scope

This spec covers **sub-project 1 of three**. The full arc:

1. **Foundation** (this spec) — Cloudflare Workers, D1, content as data with
   stable IDs, a schema that carries `user_id` from day one, one seeded user.
   Ships a hosted app usable by exactly one person.
2. **Auth** — GitHub OAuth, sessions, real accounts. Additive, because the
   schema and every query are already multi-tenant.
3. **Path catalogue** — browse and enrol, plus a second authored path to prove
   the model generalises.

Sub-projects 1 and 2 are separated deliberately, but the *schema* is not
deferred: designing storage twice is the one thing worth avoiding here.

**Out of scope for this spec:** OAuth and sessions, a catalogue UI, a second
path, account settings, path authoring by users, offline-first local mode.

### Decisions taken before this spec

- **Public signup, GitHub OAuth only.** Open registration would normally mean
  email verification, password reset, and bot handling; OAuth-only is the one
  option that is both public and genuinely lightweight. The audience is
  engineers following an ML roadmap — they have GitHub accounts.
- **Only the maintainer authors paths, in git.** No authoring UI, no untrusted
  content, no per-user content storage.
- **Fixed four-level shape** — phase → task → subtask → step. Weighted
  bubble-up, the Covered/Retained maths and the whole UI assume fixed depth. A
  six-week path is a path with one phase. Arbitrary nesting buys flexibility
  that cannot yet be demonstrated and costs recursive weighting and rendering.
- **Local single-user mode is retired.** One code path. The cost is losing
  offline use of the daily driver, accepted knowingly.
- **No data migration.** The existing completions and cards are dummy data.

### Success criteria

- The hosted app is used for a week without touching local files.
- Two seeded users provably cannot read, modify or delete each other's data.

## Architecture

One Worker. `fetch(request, env)` handles `/api/*`; everything else falls
through to the static-assets binding serving the Vite build.

```
worker/
  index.js        fetch handler, routing, error envelope
  auth.js         getUser() — the seam sub-project 2 replaces
  db.js           D1 access; replaces server/store.js
  scheduler.js    moved verbatim from server/; still pure
  routes/         cards.js, reviews.js, progress.js, me.js
migrations/
  0001_init.sql   applied with wrangler d1 migrations apply
paths/
  frontier-lab.json
src/              the frontend (see below)
```

`server/index.js` and `server/store.js` are deleted. Workers is not Node:
`node:http`, `node:fs` and `node:path` all go, and D1 is a prepared-statement
API rather than a file. **The server layer is a rewrite, not a port.**
`server/scheduler.js` is the exception — it is pure and takes `now` as a
parameter, so it moves untouched, tests and all.

`tools/render.py` and `tools/build.js` are deleted outright.

### Content is a static asset

Path JSON ships as `dist/paths/<id>-<hash>.json` with a catalogue at
`dist/paths/index.json`, fetched by the browser and served off the CDN.

The hash is what makes immutable caching safe. Each path file is emitted with a
content hash in its name and cached forever; the catalogue maps `id` to the
current hashed URL and is served `no-cache`. A content edit produces a new
filename, so the browser cannot serve a stale path, and no cache purge is
needed on deploy. Only the small catalogue is revalidated per load.

Not in D1: content is identical for every user and already versioned by git, so
a database copy would need a seed-on-deploy step and would introduce a drift
problem for no benefit. Not bundled into the Worker either: the current
resource database alone is 364 KB, and the Worker has no reason to carry it.

The result is a clean split — **the Worker only ever touches user-owned data.**

### Local development

`wrangler dev` with a local D1 replaces `make serve`. Vite still runs on 5173
for UI work, proxying `/api` to `wrangler dev` instead of to Node.

## Content model

One file per path. `data/panels/*.json` and `data/resources/*.json` merge into
`paths/frontier-lab.json` — the entire purpose of `make build` refusing to
write when the two disagreed was keeping them in sync, and one file cannot
disagree with itself.

```json
{
  "id": "frontier-lab",
  "title": "Frontier Lab Learning Plan",
  "phases": [{
    "id": "p2",
    "title": "Evals & environments",
    "weeks": [21, 38],
    "weight": 5,
    "tasks": [{
      "id": "p2-serving",
      "title": "Stand up an endpoint",
      "weeks": [21, 22],
      "weight": 3,
      "subtasks": [{
        "id": "p2-serving-vllm",
        "title": "Stand up vLLM",
        "desc": "…",
        "steps": [{ "id": "p2-serving-vllm-s1", "text": "…" }],
        "resources": { "docs": [], "videos": [], "papers": [] }
      }]
    }]
  }]
}
```

IDs are slugs, unique within a path. Titles are display-only, so **renaming one
is free** — the single biggest win in this design.

Phase and task weights are explicit. Subtask weight is the task weight divided
by the subtask count. Step weight is derived from the leading verb —
build/verify verbs score 3, practice verbs 2, read verbs 1 — exactly as today.
Those rules move out of `tools/build.js` and into a runtime module; they are
arithmetic over a few hundred nodes and do not need precomputing.

### The validator that replaces `make check`

`tools/validate-path.js` replaces `tools/check.js`, runs in CI and locally as
`pnpm validate`, and also emits the hashed path files and the catalogue into
`dist/paths/`. Validation and emission live together so an invalid path cannot
be published. It checks:

- every ID is unique within its path
- week labels sit inside their phase range and never run backwards
- every subtask has at least one step, or is explicitly stepless
- **IDs are append-only**: the path is diffed against the last committed
  version and the check fails if an ID has changed or vanished

That last rule is the one that matters once other people have data. Today a
careless rename costs a blank sidebar. Hosted, it silently orphans every user's
cards at once. Changing an ID therefore requires an explicit, deliberate
migration rather than a passing build.

## Schema

```sql
CREATE TABLE users (
  id           TEXT PRIMARY KEY,      -- ulid
  github_id    INTEGER UNIQUE,        -- null until sub-project 2
  login        TEXT,
  avatar_url   TEXT,
  created_at   INTEGER NOT NULL
);

CREATE TABLE enrollments (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_id    TEXT NOT NULL,
  started_on TEXT NOT NULL,           -- local calendar date, YYYY-MM-DD
  PRIMARY KEY (user_id, path_id)
);

CREATE TABLE progress (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_id    TEXT NOT NULL,
  node_id    TEXT NOT NULL,           -- step id, or subtask id when stepless
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

Four decisions worth stating:

**Progress is presence, not a boolean.** A row means done; unticking deletes
it. This avoids a `done = 0` tombstone class and makes the write a plain upsert
or delete.

**`ON DELETE CASCADE` throughout.** Public signup makes "delete my account" a
real obligation, and a single `DELETE FROM users` has to actually remove
everything the person ever wrote.

**`grade` is CHECK-constrained.** The scheduler already throws on an unknown
grade; the database refuses it too.

**`reviews` is append-only and never updated**, so card scheduling state stays
replayable from the log. A scheduler bug remains a recomputation rather than a
data loss.

The single user of sub-project 1 is seeded by its own migration,
`0002_seed_dev_user.sql`, inserting a fixed ULID that `DEV_USER_ID` is set to.
Keeping it in a migration rather than a script means local, preview and
production all start from the same known row. Sub-project 2 drops that
migration's user once a real GitHub account exists.

Timestamps are epoch milliseconds stored as `INTEGER`, matching what the
scheduler already works in. `started_on` is the exception: it is a calendar day
in the user's own timezone, stored as text, because the plan-week calculation
is about days rather than instants.

## API

```
GET    /api/me                      → { user, enrollments }
DELETE /api/me                      → account deletion, cascades
POST   /api/enrollments             { pathId, startedOn }
GET    /api/progress?pathId=        → [nodeId]
PUT    /api/progress                { pathId, nodeId, done }
GET    /api/cards?pathId=           → [card + r + due]
POST   /api/cards                   { pathId, subtaskId, prompt, answer }
POST   /api/reviews                 { cardId, grade, latencyMs }
```

There are no content routes. The catalogue and each path are static assets
fetched directly from the CDN.

Retrievability and due-ness are computed server-side on `GET /api/cards`, as
they are today, so the scheduler lives in exactly one place and the browser
never reimplements it.

### The auth seam

```js
// worker/auth.js
export async function getUser(request, env) {
  // sub-project 1: the single seeded user
  return env.DB.prepare('SELECT * FROM users WHERE id = ?')
               .bind(env.DEV_USER_ID).first();
  // sub-project 2: verify the signed session cookie, look the user up,
  //                return null so the route can answer 401
}
```

Every route begins with `const user = await getUser(request, env)` and scopes
every query by `user.id`. Sub-project 2 replaces one function body and adds the
OAuth callback route; nothing else moves.

This is why the schema is not deferred. Writing every query multi-tenant from
the first commit avoids a later sweep hunting for the one that forgot its
`WHERE user_id = ?` — and it lets isolation be tested before auth exists.

**Card ownership is checked, not assumed.** `POST /api/reviews` matches the
card against the caller's `user_id` and returns 404 otherwise — the same
response as a card that does not exist, so the endpoint is not an existence
oracle.

## Frontend

`index.html` becomes a shell: header, nav, empty view containers, the
hand-written Today and runner markup, and one module script. Phase panels are
built at runtime from the fetched path.

`app.js` is 2,100 lines doing five jobs and this work touches all of them, so
it splits:

```
src/content.js      fetch + cache path JSON
src/render-path.js  build phase panels from JSON   (replaces render.py)
src/weights.js      derive weights from the tree   (rules move from build.js)
src/progress.js     completions + weighted rollup (Covered)
src/sidebar.js      reading pane + capture form
src/nav.js          hash routing
src/today.js        Today, runner, Retained
src/api.js          HTTP + outbox
```

`ALL_PHASES`, `STATIC_WEIGHTS`, `getPageForTask` and every progress-key helper
are deleted. All of them existed to bridge generated files that no longer
exist. The progress key becomes the tuple `(user_id, path_id, node_id)`, held
in the database rather than encoded into a string.

`today.js` keeps its structure; `retained()` walks the path tree instead of
`ALL_PHASES` plus `RESOURCES_DB`. The rule that Retained must use the same
hierarchical bubble-up as Covered carries over unchanged — a flat weighted mean
reads higher than Covered and makes the pair meaningless.

## Failure handling

**The write outbox survives unchanged.** Hosted networks fail more often than
localhost, not less. Mutations land in the outbox before the request and flush
on reconnect. Losing a just-written card remains the only unrecoverable failure
in the system.

**Content fetch failure** serves the last good copy from the Cache API.

**D1 write failure** returns 500 in a consistent error envelope; the outbox
retries.

**A 401** (from sub-project 2 onward) surfaces a sign-in prompt rather than an
empty page. In sub-project 1 it cannot occur, since `getUser` always resolves.

## Testing

Vitest with `@cloudflare/vitest-pool-workers`, running routes against a real
local D1. The scheduler's eleven assertions port across unchanged. Three new
groups:

- **Tenant isolation** — seed two users; assert A cannot read, grade or delete
  B's cards, and that `DELETE /api/me` removes A's rows and none of B's.
  Written before auth exists, which is the entire point of scoping queries from
  day one.
- **Path validator** — duplicate ID, vanished ID, week outside its phase range,
  weeks running backwards.
- **Replay** — card state rebuilt from the review log matches stored state.

No DOM test framework. The repo has never had one and this does not earn it;
UI behaviour is verified by driving a browser.

## Build order

1. `wrangler.jsonc`, D1 binding, `0001_init.sql`, seeded user. Nothing serves
   yet.
2. `worker/db.js` and `worker/auth.js` with the seam, plus isolation tests
   against two seeded users.
3. Routes, one at a time: progress, cards, reviews, me.
4. `paths/frontier-lab.json` authored from the existing panel and resource
   files, plus the validator.
5. Frontend split and runtime rendering.
6. Delete `server/`, `tools/render.py`, `tools/build.js`, `tools/check.js`, and
   the generated `resources_db.js`.
7. Deploy, and use it for a week.

Step 6 lands last on purpose. Until the runtime rendering works, the generated
files are the only thing that renders the plan at all.
