# Settings and Runner Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user download everything they own and delete their account, and let a review session be completed without touching the mouse.

**Architecture:** One protected `GET /api/export` returning every row the caller owns, with Markdown rendered in the browser from that same JSON. The entire keymap collapses into one pure function over `(event, state)` so it is a test table rather than DOM logic.

**Tech Stack:** Cloudflare Workers, D1, Vitest with `@cloudflare/vitest-pool-workers`, Vite 8, pnpm, Node 24.

## Global Constraints

- **`GET /api/export` is protected.** It is not in the public route list. An open export endpoint would hand over everything a person had written in one unauthenticated GET.
- **Export queries are not path-scoped.** `listCards` and `listProgress` take a `pathId`; the export must cross paths, and inheriting that scoping would produce a silently partial backup.
- **The exported `user` carries only `login`.** No internal id, no GitHub id.
- **Markdown is built in the browser** from the export JSON. One endpoint, one source of truth.
- **Deleting an account requires typing the GitHub login exactly.** Not a second click.
- **`keyAction` is pure** — no DOM access, no side effects. It takes `(event, { revealed, typing })` and returns an action string or `null`.
- **Digits do nothing before reveal.** You cannot grade a card you have not looked at.
- **The recall textarea is never autofocused**, and `Escape` leaves it before it closes the runner.
- Every query stays scoped by `user_id`.
- Package manager is pnpm. Node >= 24.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `worker/routes/export.js` | `GET /api/export`. |
| `src/export-markdown.js` | `buildMarkdown(data, path)` — pure. |
| `src/settings-view.js` | The settings panel: export buttons and account deletion. |
| `src/keys.js` | `keyAction(event, state)` — pure. |
| `test/worker/export.test.js` | Route and isolation tests. |
| `test/export-markdown.test.js` | Markdown builder tests. |
| `test/keys.test.js` | The keymap table. |

**Modified:** `worker/db.js` (three queries), `worker/index.js` (one route), `index.html` (header link, `#view-settings`, runner hint), `src/main.js` (mount settings), `src/today.js` (wire `keyAction`), `src/api.js` (`getExport`, `deleteAccount`), `style.css`.

---

### Task 1: Export queries

**Files:**
- Modify: `worker/db.js`
- Create: `test/worker/export-db.test.js`

**Interfaces:**
- Consumes: `resetDb`, `seedUsers` from `test/helpers.js`; `insertCard`, `insertReview`, `setProgress`, `upsertEnrollment` already in `worker/db.js`.
- Produces:
  - `listAllCards(env, userId) -> Promise<card[]>`
  - `listAllProgress(env, userId) -> Promise<{path_id, node_id}[]>`
  - `listUserReviews(env, userId) -> Promise<review[]>`

- [ ] **Step 1: Write the failing test**

Create `test/worker/export-db.test.js`:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../worker/db.js';
import { resetDb, seedUsers } from '../helpers.js';

const card = (id, userId, pathId) => ({
  id, user_id: userId, path_id: pathId, subtask_id: 's1',
  prompt: `prompt ${id}`, answer: `answer ${id}`,
  createdAt: 1, lastReviewedAt: null, dueAt: 1,
  stability: 0, reps: 0, lapses: 0
});

describe('export queries', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers('alice', 'bob');
  });

  it('returns cards across every path, not just one', async () => {
    await db.insertCard(env, card('a1', 'alice', 'frontier-lab'));
    await db.insertCard(env, card('a2', 'alice', 'other-path'));

    const cards = await db.listAllCards(env, 'alice');
    expect(cards.map(c => c.id).sort()).toEqual(['a1', 'a2']);
  });

  it("never returns another user's cards, because an export is the easiest place to leak everything at once", async () => {
    await db.insertCard(env, card('a1', 'alice', 'frontier-lab'));
    await db.insertCard(env, card('b1', 'bob', 'frontier-lab'));

    const cards = await db.listAllCards(env, 'alice');
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe('a1');
  });

  it('returns progress across every path', async () => {
    await db.setProgress(env, 'alice', 'frontier-lab', 'n1', true, 1);
    await db.setProgress(env, 'alice', 'other-path', 'n2', true, 1);
    await db.setProgress(env, 'bob', 'frontier-lab', 'n3', true, 1);

    const rows = await db.listAllProgress(env, 'alice');
    expect(rows.map(r => r.node_id).sort()).toEqual(['n1', 'n2']);
  });

  it('returns every review the user made, and nobody else', async () => {
    await db.insertCard(env, card('a1', 'alice', 'frontier-lab'));
    await db.insertCard(env, card('b1', 'bob', 'frontier-lab'));
    await db.insertReview(env, {
      id: 'r1', card_id: 'a1', user_id: 'alice', ts: 1, grade: 'good', latency_ms: 0
    });
    await db.insertReview(env, {
      id: 'r2', card_id: 'b1', user_id: 'bob', ts: 2, grade: 'hard', latency_ms: 0
    });

    const rows = await db.listUserReviews(env, 'alice');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('r1');
  });

  it('returns empty arrays rather than throwing for a user with nothing', async () => {
    expect(await db.listAllCards(env, 'alice')).toEqual([]);
    expect(await db.listAllProgress(env, 'alice')).toEqual([]);
    expect(await db.listUserReviews(env, 'alice')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/worker/export-db.test.js
```

Expected: FAIL — `listAllCards is not a function`.

- [ ] **Step 3: Append the queries to `worker/db.js`**

```js
/**
 * Export queries. Deliberately not path-scoped, unlike listCards and
 * listProgress: an export that inherited that scoping would omit every path
 * the user had enrolled in and left, and a silently partial backup is worse
 * than none because you find out when you need it.
 */
export async function listAllCards(env, userId) {
  const { results } = await env.DB
    .prepare('SELECT * FROM cards WHERE user_id = ? ORDER BY path_id, subtask_id, created_at')
    .bind(userId).all();
  return results;
}

export async function listAllProgress(env, userId) {
  const { results } = await env.DB
    .prepare('SELECT path_id, node_id, updated_at FROM progress WHERE user_id = ? ORDER BY path_id, node_id')
    .bind(userId).all();
  return results;
}

export async function listUserReviews(env, userId) {
  const { results } = await env.DB
    .prepare('SELECT * FROM reviews WHERE user_id = ? ORDER BY ts')
    .bind(userId).all();
  return results;
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run test/worker/export-db.test.js
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/db.js test/worker/export-db.test.js
git commit -m "Add export queries

These are new rather than reusing listCards and listProgress, which both
take a pathId because every screen is about one path at a time. An export
that inherited that scoping would omit every path the user had enrolled
in and left, and a silently partial backup is worse than none because you
find out when you need it."
```

---

### Task 2: The export route

**Files:**
- Create: `worker/routes/export.js`, `test/worker/export.test.js`
- Modify: `worker/index.js`

**Interfaces:**
- Consumes: the three queries from Task 1; `getEnrollments` already in `worker/db.js`; `json` from `worker/http.js`.
- Produces: `GET /api/export` → `{ exportedAt, user: { login }, enrollments, progress, cards, reviews }`. Protected: 401 without a session.

- [ ] **Step 1: Write the failing test**

Create `test/worker/export.test.js`:

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

describe('export route', () => {
  let A, B;

  beforeEach(async () => {
    await resetDb();
    A = await signIn('alice');
    B = await signIn('bob');
  });

  it('401s without a session, because an export is the worst route to leave open', async () => {
    expect((await SELF.fetch('https://x/api/export')).status).toBe(401);
  });

  it('returns all five collections', async () => {
    const body = await (await as(A, '/api/export')).json();
    expect(Object.keys(body).sort())
      .toEqual(['cards', 'enrollments', 'exportedAt', 'progress', 'reviews', 'user']);
  });

  it('carries only the login, not the internal or github id', async () => {
    const body = await (await as(A, '/api/export')).json();
    expect(body.user).toEqual({ login: 'alice' });
  });

  it('includes the cards, progress, enrolments and reviews the user owns', async () => {
    const card = (await (await makeCard(A, 'alice-card')).json()).card;
    await as(A, '/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ cardId: card.id, grade: 'good', latencyMs: 1 })
    });
    await as(A, '/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ pathId: 'frontier-lab', nodeId: 'n1', done: true })
    });
    await as(A, '/api/enrollments', {
      method: 'POST',
      body: JSON.stringify({ pathId: 'frontier-lab', startedOn: '2026-07-25' })
    });

    const body = await (await as(A, '/api/export')).json();
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].prompt).toBe('alice-card');
    expect(body.reviews).toHaveLength(1);
    expect(body.progress).toHaveLength(1);
    expect(body.enrollments).toHaveLength(1);
  });

  it("contains nothing belonging to another signed-in user", async () => {
    await makeCard(A, 'alice-card');
    await makeCard(B, 'bob-card');
    await as(B, '/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ pathId: 'frontier-lab', nodeId: 'bob-node', done: true })
    });

    const body = await (await as(A, '/api/export')).json();
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain('bob-card');
    expect(serialised).not.toContain('bob-node');
  });

  it('is empty but well-formed for a user who has done nothing', async () => {
    const body = await (await as(A, '/api/export')).json();
    expect(body.cards).toEqual([]);
    expect(body.reviews).toEqual([]);
    expect(body.progress).toEqual([]);
    expect(body.enrollments).toEqual([]);
    expect(body.exportedAt).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/worker/export.test.js
```

Expected: FAIL — 404, the route is not registered.

- [ ] **Step 3: Write `worker/routes/export.js`**

```js
import { json } from '../http.js';
import {
  listAllCards, listAllProgress, listUserReviews, getEnrollments
} from '../db.js';

/**
 * Everything the caller owns, in one object. Protected like every route but
 * the four public ones — an open export endpoint would hand over everything a
 * person had ever written in a single unauthenticated GET.
 */
export async function dump(request, env, user) {
  const [cards, progress, reviews, enrollments] = await Promise.all([
    listAllCards(env, user.id),
    listAllProgress(env, user.id),
    listUserReviews(env, user.id),
    getEnrollments(env, user.id)
  ]);

  return json({
    exportedAt: Date.now(),
    // Only the login. The internal id and the GitHub id are of no use to the
    // reader and there is no reason to write them into a downloaded file.
    user: { login: user.login },
    enrollments: enrollments.map(e => ({ pathId: e.path_id, startedOn: e.started_on })),
    progress: progress.map(p => ({ pathId: p.path_id, nodeId: p.node_id })),
    cards,
    reviews
  });
}
```

- [ ] **Step 4: Register the route in `worker/index.js`**

Add the import beside the others:

```js
import * as exportRoute from './routes/export.js';
```

and add to `ROUTES`, **without** a `true` fourth element — it must stay protected:

```js
  ['GET', '/api/export', exportRoute.dump],
```

- [ ] **Step 5: Run the tests**

```bash
pnpm vitest run test/worker/export.test.js
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add worker test
git commit -m "Add the export route

Protected, deliberately and explicitly: an open export endpoint would
hand over everything a person had ever written in one unauthenticated
GET, which makes it the worst possible route to add to the public list.

The cross-user test serialises the whole response and asserts the other
user's strings appear nowhere in it, rather than checking collection
lengths — a leak into an unexpected field would pass a length check."
```

---

### Task 3: The Markdown builder

**Files:**
- Create: `src/export-markdown.js`, `test/export-markdown.test.js`

**Interfaces:**
- Consumes: the export shape from Task 2; `indexPath` from `src/weights.js`.
- Produces: `buildMarkdown(data, path) -> string`.

- [ ] **Step 1: Write the failing test**

Create `test/export-markdown.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildMarkdown } from '../src/export-markdown.js';
import path from '../paths/frontier-lab.json';

const P0 = path.phases[0].tasks[0].subtasks[0].id;
const P2 = path.phases[2].tasks[0].subtasks[0].id;
const NOW = 1_800_000_000_000;

const data = {
  exportedAt: NOW,
  user: { login: 'ravi' },
  enrollments: [{ pathId: 'frontier-lab', startedOn: '2026-07-25' }],
  progress: [],
  reviews: [],
  cards: [
    { id: 'c2', subtask_id: P2, path_id: 'frontier-lab',
      prompt: 'second prompt', answer: 'second answer',
      due_at: NOW, reps: 2, lapses: 1 },
    { id: 'c1', subtask_id: P0, path_id: 'frontier-lab',
      prompt: 'first prompt', answer: 'first answer',
      due_at: NOW, reps: 0, lapses: 0 }
  ]
};

describe('buildMarkdown', () => {
  it('includes every card', () => {
    const md = buildMarkdown(data, path);
    expect(md).toContain('first prompt');
    expect(md).toContain('first answer');
    expect(md).toContain('second prompt');
    expect(md).toContain('second answer');
  });

  it('orders by the path rather than by the order the cards arrived', () => {
    const md = buildMarkdown(data, path);
    expect(md.indexOf('first prompt')).toBeLessThan(md.indexOf('second prompt'));
  });

  it('heads each group with its phase and subtask, so the file reads like the plan', () => {
    const md = buildMarkdown(data, path);
    expect(md).toContain(`## ${path.phases[0].title}`);
    expect(md).toContain(`### ${path.phases[0].tasks[0].subtasks[0].title}`);
  });

  it('records who exported it and when', () => {
    const md = buildMarkdown(data, path);
    expect(md).toContain('ravi');
    expect(md).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('leaves backticks alone, because this is Markdown and prompts discuss `vllm serve`', () => {
    const md = buildMarkdown({ ...data, cards: [
      { id: 'c', subtask_id: P0, prompt: 'What does `vllm serve` allocate?',
        answer: 'KV cache blocks', due_at: NOW, reps: 0, lapses: 0 }
    ] }, path);
    expect(md).toContain('`vllm serve`');
  });

  it('notes lapses so a struggling card is visible in the export too', () => {
    const md = buildMarkdown(data, path);
    expect(md).toMatch(/1 lapse/);
  });

  it('says so plainly when there are no cards', () => {
    const md = buildMarkdown({ ...data, cards: [] }, path);
    expect(md).toMatch(/no cards/i);
  });

  it('skips a card whose subtask is not in the path rather than throwing', () => {
    const md = buildMarkdown({ ...data, cards: [
      { id: 'ghost', subtask_id: 'no-such', prompt: 'ghost prompt',
        answer: 'a', due_at: NOW, reps: 0, lapses: 0 }
    ] }, path);
    expect(md).not.toContain('ghost prompt');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/export-markdown.test.js
```

Expected: FAIL — `src/export-markdown.js` does not exist.

- [ ] **Step 3: Write `src/export-markdown.js`**

```js
/**
 * Renders an export as a readable study document. Pure: it takes the export
 * object and the loaded path and returns a string, so it is testable without a
 * browser — the same split as cardsHtml and render-path.js.
 *
 * Nothing is escaped. This is Markdown, not HTML, and prompts in this
 * curriculum are full of backticks discussing `vllm serve` and `--max-num-seqs`.
 * Escaping them would mangle the very thing the file exists to preserve.
 */
import { indexPath } from './weights.js';

const day = ms => new Date(ms).toISOString().slice(0, 10);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function buildMarkdown(data, path) {
  const index = indexPath(path);

  const bySubtask = new Map();
  for (const c of data.cards ?? []) {
    if (!index.subtasks.has(c.subtask_id)) continue;   // stale id, skip
    if (!bySubtask.has(c.subtask_id)) bySubtask.set(c.subtask_id, []);
    bySubtask.get(c.subtask_id).push(c);
  }

  const lines = [
    `# ${path.title} — cards`,
    '',
    `Exported by **${data.user?.login ?? 'unknown'}** on ${day(data.exportedAt)}.`,
    ''
  ];

  if (bySubtask.size === 0) {
    lines.push('No cards yet.');
    return lines.join('\n') + '\n';
  }

  for (const ph of path.phases ?? []) {
    const groups = [];
    for (const t of ph.tasks ?? []) {
      for (const s of t.subtasks ?? []) {
        const cards = bySubtask.get(s.id);
        if (cards) groups.push({ subtask: s, cards });
      }
    }
    if (!groups.length) continue;

    lines.push(`## ${ph.title}`, '');
    for (const g of groups) {
      lines.push(`### ${g.subtask.title}`, '');
      for (const c of g.cards) {
        lines.push(`**Q.** ${c.prompt}`, '');
        lines.push(`**A.** ${c.answer}`, '');
        lines.push(`_due ${day(c.due_at)} · ${plural(c.reps ?? 0, 'review')} · ${plural(c.lapses ?? 0, 'lapse')}_`, '');
      }
    }
  }

  return lines.join('\n') + '\n';
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run test/export-markdown.test.js
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/export-markdown.js test/export-markdown.test.js
git commit -m "Add the Markdown export builder

Built in the browser from the export JSON, so there is one endpoint and
one thing to keep in step with the schema. Markdown is a rendering
concern.

Nothing is escaped, deliberately. This is Markdown rather than HTML and
the prompts in this curriculum are full of backticks discussing
vllm serve and --max-num-seqs; escaping them would mangle the exact
content the file exists to preserve."
```

---

### Task 4: The keymap

**Files:**
- Create: `src/keys.js`, `test/keys.test.js`

**Interfaces:**
- Produces: `keyAction(event, { revealed, typing }) -> 'reveal' | 'again' | 'hard' | 'good' | 'easy' | 'blur' | 'close' | null`
- `event` needs only `key`, `metaKey` and `ctrlKey`. It is not read from the DOM, so tests pass plain objects.

- [ ] **Step 1: Write the failing test**

Create `test/keys.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { keyAction } from '../src/keys.js';

const k = (key, mods = {}) => ({ key, metaKey: false, ctrlKey: false, ...mods });

describe('keyAction while not typing', () => {
  const hidden = { revealed: false, typing: false };
  const shown = { revealed: true, typing: false };

  it('reveals on space', () => {
    expect(keyAction(k(' '), hidden)).toBe('reveal');
  });

  it('reveals on enter', () => {
    expect(keyAction(k('Enter'), hidden)).toBe('reveal');
  });

  it('does nothing on space once already revealed', () => {
    expect(keyAction(k(' '), shown)).toBeNull();
  });

  it('grades one to four after reveal', () => {
    expect(keyAction(k('1'), shown)).toBe('again');
    expect(keyAction(k('2'), shown)).toBe('hard');
    expect(keyAction(k('3'), shown)).toBe('good');
    expect(keyAction(k('4'), shown)).toBe('easy');
  });

  it('ignores digits before reveal, so a stray key cannot mark a card easy and push it a week out', () => {
    expect(keyAction(k('1'), hidden)).toBeNull();
    expect(keyAction(k('4'), hidden)).toBeNull();
  });

  it('ignores digits outside one to four', () => {
    expect(keyAction(k('5'), shown)).toBeNull();
    expect(keyAction(k('0'), shown)).toBeNull();
  });

  it('closes on escape', () => {
    expect(keyAction(k('Escape'), hidden)).toBe('close');
    expect(keyAction(k('Escape'), shown)).toBe('close');
  });

  it('ignores unrelated keys', () => {
    expect(keyAction(k('a'), shown)).toBeNull();
    expect(keyAction(k('Tab'), shown)).toBeNull();
  });
});

describe('keyAction while typing', () => {
  const typing = { revealed: false, typing: true };

  it('lets a space through as a character, which is why any of this is careful', () => {
    expect(keyAction(k(' '), typing)).toBeNull();
  });

  it('lets digits through as characters', () => {
    expect(keyAction(k('1'), typing)).toBeNull();
    expect(keyAction(k('4'), { revealed: true, typing: true })).toBeNull();
  });

  it('lets a plain enter through, so the recall box can hold more than one line', () => {
    expect(keyAction(k('Enter'), typing)).toBeNull();
  });

  it('reveals on cmd or ctrl enter without leaving the box', () => {
    expect(keyAction(k('Enter', { metaKey: true }), typing)).toBe('reveal');
    expect(keyAction(k('Enter', { ctrlKey: true }), typing)).toBe('reveal');
  });

  it('blurs rather than closing on escape, so a half-typed recall is not lost to a reflex', () => {
    expect(keyAction(k('Escape'), typing)).toBe('blur');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/keys.test.js
```

Expected: FAIL — `src/keys.js` does not exist.

- [ ] **Step 3: Write `src/keys.js`**

```js
/**
 * The runner keymap, as one pure function. No DOM access and no side effects,
 * so the whole decision surface is a test table rather than logic buried in an
 * event handler.
 */
const GRADES = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };

export function keyAction(event, { revealed, typing }) {
  const { key } = event;

  if (typing) {
    // Cmd/Ctrl+Enter reveals without leaving the box.
    if (key === 'Enter' && (event.metaKey || event.ctrlKey)) return 'reveal';
    // Escape leaves the box. It does not close the runner: losing a
    // half-typed recall to a reflex Escape is a bad trade.
    if (key === 'Escape') return 'blur';
    // Everything else is a character the user is trying to type.
    return null;
  }

  if (key === 'Escape') return 'close';

  if (!revealed) {
    if (key === ' ' || key === 'Enter') return 'reveal';
    // Digits do nothing before reveal — you cannot grade a card you have not
    // looked at, and a stray keypress must not push one a week away.
    return null;
  }

  return GRADES[key] ?? null;
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run test/keys.test.js
```

Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/keys.js test/keys.test.js
git commit -m "Add the runner keymap as a pure function

The whole decision surface is one function over (event, state), so it is
a test table rather than branching buried in an event handler.

A space while the recall box has focus returns null. That is the case the
design exists for: a shortcut that swallowed a character would make the
box untrustworthy, and typing the recall is the stronger study act."
```

---

### Task 5: Wire the shortcuts into the runner

**Files:**
- Modify: `src/today.js`, `index.html`, `style.css`

**Interfaces:**
- Consumes: `keyAction` (Task 4).
- Produces: keyboard control of the runner, plus a visible hint.

- [ ] **Step 1: Add the hint to the runner markup**

In `index.html`, immediately after the closing `</div>` of
`<div class="runner-grades" id="runner-grades" hidden>`, add:

```html
    <div class="runner-hint">space reveal · 1–4 grade · esc close</div>
```

- [ ] **Step 2: Add the style**

Append to `style.css`:

```css
.runner-hint { margin-top: 14px; font-family: var(--mono); font-size: 10px;
  color: var(--muted2); letter-spacing: 0.04em; text-align: center; }
```

- [ ] **Step 3: Wire the listener in `src/today.js`**

Add the import at the top:

```js
import { keyAction } from './keys.js';
```

and, immediately before the line `window.TODAY = { render, dueCards, startReview, retained };`, add:

```js
  // One listener for the life of the page. It returns immediately when the
  // runner is hidden, so nothing fires while the plan is being read.
  document.addEventListener('keydown', (event) => {
    if (el('runner').hidden) return;

    const target = event.target;
    const typing = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT');
    const revealed = !el('runner-answer').hidden;

    const action = keyAction(event, { revealed, typing });
    if (!action) return;

    // Only once we are certain we are acting — otherwise space would scroll
    // the page underneath the runner.
    event.preventDefault();

    if (action === 'blur') { target.blur(); return; }
    if (action === 'close') { el('runner').hidden = true; render(); return; }
    if (action === 'reveal') { el('runner-reveal').click(); return; }

    grade(action);
  });
```

- [ ] **Step 4: Confirm the reveal button is what the shortcut drives**

`el('runner-reveal').click()` is used rather than duplicating the reveal logic,
so the keyboard and the mouse cannot drift apart. Verify the existing click
handler is still registered by reading `src/today.js` around the
`runner-reveal` listener; it should show the answer, show the grades, and hide
itself.

- [ ] **Step 5: Build and run everything**

```bash
pnpm build
pnpm test
```

Expected: clean build; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/today.js index.html style.css
git commit -m "Give the runner keyboard control

Reveal is driven by clicking the existing button rather than duplicating
its logic, so the keyboard and the mouse cannot drift apart.

preventDefault is called only once an action is certain. Calling it
earlier would stop space scrolling the page even when the runner was
ignoring the key.

The hint line is not decoration: a shortcut nobody knows about is not a
shortcut."
```

---

### Task 6: The settings view

**Files:**
- Create: `src/settings-view.js`
- Modify: `index.html`, `src/api.js`, `src/main.js`, `style.css`

**Interfaces:**
- Consumes: `buildMarkdown` (Task 3); `GET /api/export` (Task 2); `DELETE /api/me`, which has existed since sub-project one with nothing calling it.
- Produces:
  - `API.getExport() -> Promise<object>` — throws on failure rather than returning a cached fallback
  - `API.deleteAccount() -> Promise<object | null>`
  - `API.clearOutbox() -> void`
  - `renderSettings(ctx, me)` in `src/settings-view.js`.

- [ ] **Step 1: Add the panel and header link to `index.html`**

In `<nav class="nav">`, after the Cards link:

```html
    <a href="#settings">Settings</a>
```

Immediately before `<div id="view-cards" class="view-panel">`:

```html
<div id="view-settings" class="view-panel">
  <div class="container">
    <section class="today-block">
      <div class="today-block-title">Export your data</div>
      <p class="settings-note">JSON restores everything. Markdown is your cards
        as a readable document.</p>
      <div class="settings-actions">
        <button class="today-review-btn" id="export-json">Download JSON</button>
        <button class="today-review-btn" id="export-md">Download Markdown</button>
      </div>
      <span class="capture-status" id="export-status"></span>
    </section>

    <section class="today-block">
      <div class="today-block-title">Delete account</div>
      <p class="settings-note">This removes every card, every review, all
        progress and every signed-in session. It cannot be undone.</p>
      <label class="capture-label">Type your GitHub login to confirm</label>
      <input class="capture-input" id="delete-confirm" autocomplete="off">
      <div class="settings-actions">
        <button class="settings-danger" id="delete-account" disabled>Delete my account</button>
      </div>
    </section>
  </div>
</div>
```

- [ ] **Step 2: Add the API methods to `src/api.js`**

Beside `getCards`:

```js
    // A read, so it is not an outbox mutation: a failure must surface rather
    // than silently exporting the cache, which would produce a file that looks
    // like a backup and is not one.
    async getExport() {
      return API.request('GET', '/api/export');
    },

    async deleteAccount() {
      return API.mutate('DELETE', '/api/me');
    },

    clearOutbox() {
      write(OUTBOX, []);
    },
```

- [ ] **Step 3: Write `src/settings-view.js`**

```js
/**
 * Export and account deletion. Both files are produced in the browser from one
 * export response, so there is a single endpoint and a single shape to keep in
 * step with the schema.
 */
import { API } from './api.js';
import { buildMarkdown } from './export-markdown.js';

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function renderSettings(ctx, me) {
  const status = document.getElementById('export-status');

  async function grab() {
    status.textContent = 'Preparing…';
    try {
      const data = await API.getExport();
      status.textContent = '';
      return data;
    } catch {
      // Exporting the cache would produce a file that looks like a backup and
      // is not one, so this fails loudly instead.
      status.textContent = 'Could not reach the server. Nothing was downloaded.';
      return null;
    }
  }

  document.getElementById('export-json').addEventListener('click', async () => {
    const data = await grab();
    if (!data) return;
    download(`${ctx.pathId}-export-${stamp()}.json`,
      JSON.stringify(data, null, 2), 'application/json');
  });

  document.getElementById('export-md').addEventListener('click', async () => {
    const data = await grab();
    if (!data) return;
    download(`${ctx.pathId}-export-${stamp()}.md`,
      buildMarkdown(data, ctx.path), 'text/markdown');
  });

  // Typing the login rather than a second click. A two-step confirm is
  // proportionate for one card; for an action that destroys a year of
  // hand-written cards and cascades through four tables it is too cheap.
  const input = document.getElementById('delete-confirm');
  const button = document.getElementById('delete-account');
  const login = me.user?.login ?? '';

  input.addEventListener('input', () => {
    button.disabled = input.value !== login;
  });

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Deleting…';
    await API.deleteAccount();
    // Queued writes reference rows that no longer exist, so flushing them
    // later would only produce 404s against a stranger's session or none at
    // all. Drop them with the account.
    API.clearOutbox();
    // Sessions cascade from users, so the session is already gone.
    window.location.href = '/';
  });
}
```

- [ ] **Step 4: Mount it in `src/main.js`**

Add the import beside the others:

```js
import { renderSettings } from './settings-view.js';
```

and, immediately after the `paintCards();` call, add:

```js
  if (isSignedIn()) {
    renderSettings(ctx, me);
  } else {
    document.querySelector('#view-settings .container').innerHTML =
      `<section class="today-block"><span class="signed-out-note">Sign in with GitHub to export or delete your data.</span></section>`;
  }
```

- [ ] **Step 5: Add the styles**

Append to `style.css`:

```css
/* ── Settings ──────────────────────────────────────────────── */
.settings-note { font-size: 13px; color: var(--muted); margin-bottom: 12px; }
.settings-actions { display: flex; gap: 8px; margin-top: 12px; align-items: center; }
.settings-danger { font: inherit; font-size: 13px; padding: 7px 16px;
  border: 1px solid var(--red); border-radius: 2px;
  background: rgba(248,113,113,0.08); color: var(--red); cursor: pointer; }
.settings-danger:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 6: Build and verify against a real Worker**

```bash
pnpm build
pnpm dev:worker
```

In another terminal:

```bash
curl -s -o /dev/null -w 'export unauthed %{http_code}\n' localhost:8787/api/export
curl -s localhost:8787/ | grep -c 'view-settings'
```

Expected: `export unauthed 401` and `1`.

- [ ] **Step 7: Run everything and commit**

```bash
pnpm test
git add index.html src style.css
git commit -m "Add the settings view

Deleting requires typing the GitHub login rather than a second click. A
two-step confirm is proportionate for one card; for an action that
destroys a year of hand-written cards and cascades through four tables it
is too cheap.

Export failures surface rather than falling back to the cache. A file
built from the offline cache would look like a backup and would not be
one, which is the worst way for this feature to fail."
```

---

## Verification checklist

- [ ] `pnpm test` — 151 previous plus 32 new
- [ ] `GET /api/export` 401s without a session
- [ ] An export contains no string belonging to a second signed-in user
- [ ] The export crosses paths — a card in a second path appears
- [ ] `buildMarkdown` leaves backticks intact
- [ ] Space while the recall box has focus types a space and does not reveal
- [ ] `1`–`4` do nothing before the answer is revealed
- [ ] `Escape` leaves the recall box; a second `Escape` closes the runner
- [ ] The delete button stays disabled until the typed login matches exactly
- [ ] Deleting an account empties the outbox, so nothing is retried against a dead account
- [ ] The recall textarea is not autofocused — the first key on a fresh card reveals
