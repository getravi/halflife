# Card Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a card be found, corrected and deleted, so the cards the whole design rests on can be made good after they are written.

**Architecture:** Two routes on the existing exact-path router, two `user_id`-scoped queries, and a `#cards` view built from a pure string builder so it is testable without a browser.

**Tech Stack:** Cloudflare Workers, D1, Vitest with `@cloudflare/vitest-pool-workers`, Vite 8, pnpm, Node 24.

## Global Constraints

- **Editing never touches the schedule.** `updateCardText`'s `SET` clause names only `prompt` and `answer`. `stability`, `reps`, `lapses`, `due_at` and `last_reviewed_at` must be unreachable by construction, not preserved by care.
- **A card belonging to someone else answers exactly as one that does not exist** — same status, same body. No existence oracle.
- **Every query is scoped by `user_id`.**
- **Delete is hard.** `reviews.card_id` cascades; the study history goes with the card. No `deleted_at` column.
- **A blank prompt or answer is a 400**, matching `POST /api/cards`.
- **`DELETE` takes a query parameter, not a body.** Bodies on DELETE are inconsistently supported, and a dropped body would delete nothing while reporting success.
- **Cards render grouped by phase then subtask, in path order** — not due order.
- **No `window.confirm`.** A modal blocks the page; deletion uses a two-step inline confirm.
- **Offline edits apply optimistically.** The outbox guarantees delivery; never refetch after a mutation.
- Package manager is pnpm. Node >= 24.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/cards-view.js` | `cardsHtml(ctx, cards)` — a pure string builder — plus `renderCards` which mounts it and wires listeners. |
| `test/cards-view.test.js` | Tests the string builder without a browser. |

**Modified:** `worker/db.js` (two queries), `worker/routes/cards.js` (two handlers), `worker/index.js` (two route entries), `test/worker/cards.test.js` (route tests), `src/api.js` (two methods), `src/main.js` (mount the view), `index.html` (nav link, panel), `style.css`.

---

### Task 1: The queries

**Files:**
- Modify: `worker/db.js`
- Create: `test/worker/cards-db.test.js`

**Interfaces:**
- Consumes: `resetDb`, `seedUsers` from `test/helpers.js`; `insertCard` and `getOwnedCard` already in `worker/db.js`.
- Produces:
  - `updateCardText(env, userId, cardId, prompt, answer) -> Promise<card | null>` — returns the updated row, or `null` when the card does not exist or is not owned by `userId`.
  - `deleteCard(env, userId, cardId) -> Promise<boolean>` — `true` when a row was removed.

- [ ] **Step 1: Write the failing test**

Create `test/worker/cards-db.test.js`:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../worker/db.js';
import { resetDb, seedUsers } from '../helpers.js';

const PATH = 'frontier-lab';

async function makeCard(userId, id, overrides = {}) {
  const card = {
    id,
    user_id: userId,
    path_id: PATH,
    subtask_id: 'p2-serving-s01',
    prompt: 'original prompt',
    answer: 'original answer',
    createdAt: 1000,
    lastReviewedAt: 5000,
    dueAt: 9000,
    stability: 4,
    reps: 3,
    lapses: 1,
    ...overrides
  };
  await db.insertCard(env, card);
  return card;
}

describe('updateCardText', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers('alice', 'bob');
  });

  it('changes the prompt and the answer', async () => {
    await makeCard('alice', 'c1');
    const updated = await db.updateCardText(env, 'alice', 'c1', 'new prompt', 'new answer');
    expect(updated.prompt).toBe('new prompt');
    expect(updated.answer).toBe('new answer');
  });

  it('leaves every scheduling field untouched, which is the whole point of editing', async () => {
    await makeCard('alice', 'c1');
    const updated = await db.updateCardText(env, 'alice', 'c1', 'new prompt', 'new answer');

    expect(updated.stability).toBe(4);
    expect(updated.reps).toBe(3);
    expect(updated.lapses).toBe(1);
    expect(updated.due_at).toBe(9000);
    expect(updated.last_reviewed_at).toBe(5000);
    expect(updated.created_at).toBe(1000);
  });

  it('returns null for a card that does not exist', async () => {
    expect(await db.updateCardText(env, 'alice', 'nope', 'p', 'a')).toBeNull();
  });

  it("returns null for another user's card AND leaves it unchanged", async () => {
    await makeCard('bob', 'c-bob');

    expect(await db.updateCardText(env, 'alice', 'c-bob', 'hijacked', 'hijacked')).toBeNull();

    const row = await db.getOwnedCard(env, 'bob', 'c-bob');
    expect(row.prompt).toBe('original prompt');
    expect(row.answer).toBe('original answer');
  });
});

describe('deleteCard', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers('alice', 'bob');
  });

  it('removes the card and reports that it did', async () => {
    await makeCard('alice', 'c1');
    expect(await db.deleteCard(env, 'alice', 'c1')).toBe(true);
    expect(await db.getOwnedCard(env, 'alice', 'c1')).toBeUndefined();
  });

  it('takes the review history with it, because the cascade is the design', async () => {
    await makeCard('alice', 'c1');
    await db.insertReview(env, {
      id: 'r1', card_id: 'c1', user_id: 'alice', ts: 1, grade: 'good', latency_ms: 0
    });

    await db.deleteCard(env, 'alice', 'c1');

    const { results } = await env.DB.prepare('SELECT * FROM reviews').all();
    expect(results).toHaveLength(0);
  });

  it('reports false for a card that does not exist', async () => {
    expect(await db.deleteCard(env, 'alice', 'nope')).toBe(false);
  });

  it("refuses another user's card AND leaves it in place", async () => {
    await makeCard('bob', 'c-bob');

    expect(await db.deleteCard(env, 'alice', 'c-bob')).toBe(false);
    expect(await db.getOwnedCard(env, 'bob', 'c-bob')).toBeDefined();
  });

  it('leaves the owner other cards alone', async () => {
    await makeCard('alice', 'c1');
    await makeCard('alice', 'c2');
    await db.deleteCard(env, 'alice', 'c1');
    expect(await db.listCards(env, 'alice', PATH)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/worker/cards-db.test.js
```

Expected: FAIL — `updateCardText is not a function`.

- [ ] **Step 3: Append the queries to `worker/db.js`**

```js
/**
 * Only prompt and answer appear in the SET clause. The scheduling columns are
 * not preserved by care — they are unreachable from here, so fixing a typo
 * cannot silently reschedule a card reviewed for six months.
 *
 * Returns null rather than throwing when the card is absent or owned by
 * somebody else, so the route can answer 404 identically in both cases.
 */
export async function updateCardText(env, userId, cardId, prompt, answer) {
  const { meta } = await env.DB.prepare(
    'UPDATE cards SET prompt = ?, answer = ? WHERE id = ? AND user_id = ?'
  ).bind(prompt, answer, cardId, userId).run();

  if (!meta.changes) return null;
  return env.DB.prepare('SELECT * FROM cards WHERE id = ?').bind(cardId).first();
}

export async function deleteCard(env, userId, cardId) {
  const { meta } = await env.DB
    .prepare('DELETE FROM cards WHERE id = ? AND user_id = ?')
    .bind(cardId, userId).run();
  return meta.changes > 0;
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run test/worker/cards-db.test.js
```

Expected: PASS, 9 tests.

If `meta.changes` is undefined on this D1 version, fall back to checking
ownership first with `getOwnedCard` and returning `null`/`false` when it is
absent — but do **not** drop `AND user_id = ?` from the statement itself. The
`WHERE` clause is the guarantee; a prior read is only how the result is
reported.

- [ ] **Step 5: Commit**

```bash
git add worker/db.js test/worker/cards-db.test.js
git commit -m "Add card update and delete queries

updateCardText names only prompt and answer in its SET clause, so
rescheduling a card by editing it is unreachable rather than merely
avoided.

Both tests for another user's card assert the card is unchanged
afterwards, not merely that the call returned null. Asserting the return
value alone would not catch a query that wrote first and checked
ownership second."
```

---

### Task 2: The routes

**Files:**
- Modify: `worker/routes/cards.js`, `worker/index.js`, `test/worker/cards.test.js`

**Interfaces:**
- Consumes: `updateCardText`, `deleteCard` (Task 1); `json`, `error` from `worker/http.js`.
- Produces:
  - `PATCH /api/cards` body `{ cardId, prompt, answer }` → `200 { card }`; `400` on a blank field; `404` when absent or not owned.
  - `DELETE /api/cards?cardId=X` → `200 { ok: true }`; `400` without `cardId`; `404` when absent or not owned.
  - Exported handlers `update` and `destroy` in `worker/routes/cards.js`.

- [ ] **Step 1: Write the failing test**

Append to `test/worker/cards.test.js`, inside the file but after the existing
`describe`:

```js
describe('editing and deleting cards', () => {
  beforeEach(async () => {
    await resetDb();
    COOKIE = await signInAs();
  });

  const patch = (body) => api('/api/cards', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  async function created() {
    return (await (await post(BODY)).json()).card;
  }

  it('rewrites a card', async () => {
    const card = await created();
    const res = await patch({ cardId: card.id, prompt: 'sharper', answer: 'clearer' });
    expect(res.status).toBe(200);

    const { cards } = await (await api('/api/cards?pathId=frontier-lab')).json();
    expect(cards[0].prompt).toBe('sharper');
    expect(cards[0].answer).toBe('clearer');
  });

  it('does not reschedule the card it just rewrote', async () => {
    const card = await created();
    await api('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cardId: card.id, grade: 'good', latencyMs: 1 })
    });

    const before = (await (await api('/api/cards?pathId=frontier-lab')).json()).cards[0];
    await patch({ cardId: card.id, prompt: 'sharper', answer: 'clearer' });
    const after = (await (await api('/api/cards?pathId=frontier-lab')).json()).cards[0];

    expect(after.due_at).toBe(before.due_at);
    expect(after.stability).toBe(before.stability);
    expect(after.reps).toBe(before.reps);
    expect(after.lapses).toBe(before.lapses);
  });

  it('rejects a blank prompt, because a blank card is unreviewable', async () => {
    const card = await created();
    expect((await patch({ cardId: card.id, prompt: '  ', answer: 'a' })).status).toBe(400);
  });

  it('rejects a blank answer', async () => {
    const card = await created();
    expect((await patch({ cardId: card.id, prompt: 'p', answer: '' })).status).toBe(400);
  });

  it('404s an unknown card', async () => {
    expect((await patch({ cardId: 'nope', prompt: 'p', answer: 'a' })).status).toBe(404);
  });

  it('deletes a card', async () => {
    const card = await created();
    const res = await api(`/api/cards?cardId=${card.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);

    const { cards } = await (await api('/api/cards?pathId=frontier-lab')).json();
    expect(cards).toEqual([]);
  });

  it('404s deleting a card that is already gone', async () => {
    const card = await created();
    await api(`/api/cards?cardId=${card.id}`, { method: 'DELETE' });
    expect((await api(`/api/cards?cardId=${card.id}`, { method: 'DELETE' })).status).toBe(404);
  });

  it('400s a delete with no cardId, rather than deleting nothing and reporting success', async () => {
    expect((await api('/api/cards', { method: 'DELETE' })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/worker/cards.test.js
```

Expected: FAIL — the PATCH and DELETE requests 404 because no route matches.

- [ ] **Step 3: Add the handlers to `worker/routes/cards.js`**

Add the import at the top, beside the existing ones:

```js
import { listCards, insertCard, newId, updateCardText, deleteCard } from '../db.js';
```

(replacing the existing `import { listCards, insertCard, newId } from '../db.js';`)

and append:

```js
export async function update(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error('body is not valid JSON', 400);
  }

  const cardId = str(body.cardId);
  const prompt = str(body.prompt);
  const answer = str(body.answer);
  if (!cardId) return error('cardId is required', 400);
  if (!prompt || !answer) return error('prompt and answer are both required', 400);

  // Absent and not-yours are the same answer, so this endpoint cannot be used
  // to discover which card ids exist.
  const card = await updateCardText(env, user.id, cardId, prompt, answer);
  if (!card) return error('no such card', 404);

  return json({ card });
}

export async function destroy(request, env, user, url) {
  const cardId = str(url.searchParams.get('cardId'));
  // A missing id must not read as "delete nothing, report success".
  if (!cardId) return error('cardId is required', 400);

  const removed = await deleteCard(env, user.id, cardId);
  if (!removed) return error('no such card', 404);

  return json({ ok: true });
}
```

- [ ] **Step 4: Register the routes in `worker/index.js`**

Add to `ROUTES`, beside the other card entries:

```js
  ['PATCH', '/api/cards', cards.update],
  ['DELETE', '/api/cards', cards.destroy],
```

- [ ] **Step 5: Run the tests**

```bash
pnpm vitest run test/worker/cards.test.js
```

Expected: PASS — the original 6 plus 8 new.

- [ ] **Step 6: Add the cross-user route tests**

Append to `test/worker/session-isolation.test.js`, inside the existing
`describe`:

```js
  it("refuses to rewrite another user's card, and leaves its text alone", async () => {
    const bob = (await (await makeCard(B, 'bob-card')).json()).card;

    const res = await as(A, '/api/cards', {
      method: 'PATCH',
      body: JSON.stringify({ cardId: bob.id, prompt: 'hijacked', answer: 'hijacked' })
    });
    expect(res.status).toBe(404);

    const row = await env.DB.prepare('SELECT prompt FROM cards WHERE id = ?')
      .bind(bob.id).first();
    expect(row.prompt).toBe('bob-card');
  });

  it("refuses to delete another user's card, and leaves it in place", async () => {
    const bob = (await (await makeCard(B, 'bob-card')).json()).card;

    const res = await as(A, `/api/cards?cardId=${bob.id}`, { method: 'DELETE' });
    expect(res.status).toBe(404);

    const row = await env.DB.prepare('SELECT id FROM cards WHERE id = ?')
      .bind(bob.id).first();
    expect(row).toBeTruthy();
  });
```

- [ ] **Step 7: Run the whole suite**

```bash
pnpm vitest run
```

Expected: PASS — 123 previous, plus 9 from Task 1, plus 8, plus 2.

- [ ] **Step 8: Commit**

```bash
git add worker test
git commit -m "Add PATCH and DELETE for cards

DELETE takes its id as a query parameter rather than a body. Bodies on
DELETE are inconsistently supported, and a dropped one would mean
deleting nothing while answering 200.

A missing cardId is a 400 for the same reason: silently deleting nothing
and reporting success is the worst available behaviour.

The cross-user tests assert the target card is unchanged afterwards, not
merely that the response was 404."
```

---

### Task 3: The card list markup

**Files:**
- Create: `src/cards-view.js`, `test/cards-view.test.js`

**Interfaces:**
- Consumes: `ctx` — `{ path, index, weights, pathId }` as built in `src/main.js`.
- Produces:
  - `cardsHtml(ctx, cards, now) -> string` — pure; no DOM access.
  - `renderCards(ctx, cards, handlers)` — mounts into `#cards-list` and wires listeners. `handlers` is `{ onSave(cardId, prompt, answer), onDelete(cardId) }`.
  - Card rows carry `data-card-id`. Buttons carry `data-action` of `edit`, `save`, `cancel`, `delete`, `confirm-delete` or `cancel-delete`.

- [ ] **Step 1: Write the failing test**

Create `test/cards-view.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { cardsHtml } from '../src/cards-view.js';
import { indexPath, computeWeights } from '../src/weights.js';
import path from '../paths/frontier-lab.json';

const ctx = { path, pathId: 'frontier-lab', index: indexPath(path), weights: computeWeights(path) };
const NOW = 1_800_000_000_000;
const DAY = 86400000;

// Two subtasks from different phases, chosen so path order is observable.
const P0 = path.phases[0].tasks[0].subtasks[0].id;
const P2 = path.phases[2].tasks[0].subtasks[0].id;

const card = (id, subtaskId, over = {}) => ({
  id, subtask_id: subtaskId, path_id: 'frontier-lab',
  prompt: `prompt ${id}`, answer: `answer ${id}`,
  due_at: NOW + 4 * DAY, reps: 3, lapses: 1, stability: 4,
  last_reviewed_at: NOW - DAY, created_at: NOW - 10 * DAY,
  ...over
});

describe('cardsHtml', () => {
  it('renders every card', () => {
    const html = cardsHtml(ctx, [card('a', P0), card('b', P2)], NOW);
    expect(html).toContain('data-card-id="a"');
    expect(html).toContain('data-card-id="b"');
    expect(html).toContain('prompt a');
    expect(html).toContain('answer b');
  });

  it('groups in path order rather than the order the cards arrived', () => {
    // b belongs to phase 3, a to phase 1; passing b first must not win.
    const html = cardsHtml(ctx, [card('b', P2), card('a', P0)], NOW);
    expect(html.indexOf('data-card-id="a"')).toBeLessThan(html.indexOf('data-card-id="b"'));
  });

  it('shows the subtask each card came from, which is how you recognise it', () => {
    const html = cardsHtml(ctx, [card('a', P0)], NOW);
    expect(html).toContain(ctx.index.subtasks.get(P0).title);
  });

  it('shows reviews and lapses so a card you keep failing is visible here', () => {
    const html = cardsHtml(ctx, [card('a', P0)], NOW);
    expect(html).toMatch(/3 reviews/);
    expect(html).toMatch(/1 lapse\b/);
  });

  it('marks an overdue card', () => {
    const html = cardsHtml(ctx, [card('a', P0, { due_at: NOW - DAY })], NOW);
    expect(html).toMatch(/overdue/i);
  });

  it('offers edit and delete on every row', () => {
    const html = cardsHtml(ctx, [card('a', P0)], NOW);
    expect(html).toContain('data-action="edit"');
    expect(html).toContain('data-action="delete"');
  });

  it('escapes markup in a prompt, because innerHTML is how this is mounted', () => {
    const html = cardsHtml(ctx, [card('a', P0, { prompt: '<img src=x onerror=alert(1)>' })], NOW);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('points at the next action when there are no cards, rather than merely saying there are none', () => {
    const html = cardsHtml(ctx, [], NOW);
    expect(html).toMatch(/finish a subtask/i);
  });

  it('ignores a card whose subtask is not in this path, rather than throwing', () => {
    const html = cardsHtml(ctx, [card('ghost', 'no-such-subtask')], NOW);
    expect(html).not.toContain('data-card-id="ghost"');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/cards-view.test.js
```

Expected: FAIL — `src/cards-view.js` does not exist.

- [ ] **Step 3: Write `src/cards-view.js`**

```js
/**
 * The card list. cardsHtml is a pure string builder and renderCards mounts it,
 * which is what lets the markup be tested without a browser — the same split
 * that made render-path.js testable after the Chrome tooling failed.
 */
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const DAY = 86400000;

function dueLabel(card, now) {
  const days = Math.round((card.due_at - now) / DAY);
  if (days < 0) return `<span class="card-overdue">overdue by ${-days}d</span>`;
  if (days === 0) return 'due today';
  return `due in ${days}d`;
}

function row(card, now) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return `
    <div class="card-row" data-card-id="${esc(card.id)}">
      <div class="card-display">
        <div class="card-prompt">${esc(card.prompt)}</div>
        <div class="card-answer">${esc(card.answer)}</div>
        <div class="card-meta">
          ${dueLabel(card, now)} · ${plural(card.reps ?? 0, 'review')} ·
          ${plural(card.lapses ?? 0, 'lapse')}
        </div>
        <div class="card-actions">
          <button class="card-btn" data-action="edit">Edit</button>
          <button class="card-btn" data-action="delete">Delete</button>
        </div>
      </div>
    </div>`;
}

/**
 * Grouped by phase then subtask, in path order — you come here because you
 * remember roughly where in the plan a bad card came from. Due order is what
 * the runner is for.
 */
export function cardsHtml(ctx, cards, now) {
  if (!cards.length) {
    return `<p class="signed-out-note">No cards yet — finish a subtask and capture one.</p>`;
  }

  const bySubtask = new Map();
  for (const c of cards) {
    if (!ctx.index.subtasks.has(c.subtask_id)) continue;   // stale id, skip
    if (!bySubtask.has(c.subtask_id)) bySubtask.set(c.subtask_id, []);
    bySubtask.get(c.subtask_id).push(c);
  }

  let html = '';
  for (const ph of ctx.path.phases ?? []) {
    const groups = [];
    for (const t of ph.tasks ?? []) {
      for (const s of t.subtasks ?? []) {
        const group = bySubtask.get(s.id);
        if (group) groups.push({ subtask: s, cards: group });
      }
    }
    if (!groups.length) continue;

    html += `<div class="card-phase"><div class="card-phase-title">${esc(ph.title)}</div>`;
    for (const g of groups) {
      html += `<div class="card-group">
        <div class="card-group-title">${esc(g.subtask.title)}</div>
        ${g.cards.map(c => row(c, now)).join('')}
      </div>`;
    }
    html += '</div>';
  }

  return html || `<p class="signed-out-note">No cards yet — finish a subtask and capture one.</p>`;
}

const editForm = card => `
  <div class="card-edit">
    <label class="capture-label">Question</label>
    <textarea class="capture-input" data-field="prompt" rows="2">${esc(card.prompt)}</textarea>
    <label class="capture-label">Answer</label>
    <textarea class="capture-input" data-field="answer" rows="4">${esc(card.answer)}</textarea>
    <div class="capture-actions">
      <button class="capture-save" data-action="save">Save</button>
      <button class="capture-skip" data-action="cancel">Cancel</button>
      <span class="capture-status" data-role="status"></span>
    </div>
  </div>`;

export function renderCards(ctx, cards, handlers) {
  const list = document.getElementById('cards-list');
  if (!list) return;

  const byId = new Map(cards.map(c => [c.id, c]));
  list.innerHTML = cardsHtml(ctx, cards, Date.now());

  list.onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const rowEl = btn.closest('.card-row');
    if (!rowEl) return;

    const id = rowEl.dataset.cardId;
    const card = byId.get(id);
    const action = btn.dataset.action;

    if (action === 'edit') {
      rowEl.insertAdjacentHTML('beforeend', editForm(card));
      rowEl.querySelector('.card-display').hidden = true;
      return;
    }

    if (action === 'cancel') {
      rowEl.querySelector('.card-edit').remove();
      rowEl.querySelector('.card-display').hidden = false;
      return;
    }

    if (action === 'save') {
      const prompt = rowEl.querySelector('[data-field="prompt"]').value.trim();
      const answer = rowEl.querySelector('[data-field="answer"]').value.trim();
      const status = rowEl.querySelector('[data-role="status"]');
      if (!prompt || !answer) {
        status.textContent = 'Both fields, or it is not reviewable.';
        return;
      }
      status.textContent = 'Saving…';
      await handlers.onSave(id, prompt, answer);
      return;
    }

    // Two steps rather than window.confirm: a modal blocks the page, and a
    // reflex-dismissed popup is worse friction design than a second click.
    if (action === 'delete') {
      btn.outerHTML = `<span class="card-confirm">Delete?
        <button class="card-btn" data-action="confirm-delete">yes</button>
        <button class="card-btn" data-action="cancel-delete">no</button></span>`;
      return;
    }

    if (action === 'cancel-delete') {
      btn.closest('.card-confirm').outerHTML =
        `<button class="card-btn" data-action="delete">Delete</button>`;
      return;
    }

    if (action === 'confirm-delete') {
      await handlers.onDelete(id);
    }
  };
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run test/cards-view.test.js
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/cards-view.js test/cards-view.test.js
git commit -m "Add the card list markup

cardsHtml is a pure string builder and renderCards mounts it, so the
markup is testable without a browser — the same split that made
render-path.js testable after the Chrome tooling failed repeatedly.

Grouped in path order rather than due order: you come here because you
remember roughly where in the plan a bad card came from, and due order
scatters exactly that.

A card whose subtask id is not in the path is skipped rather than
throwing. Ids are append-only so it should not happen, but a list that
crashes is worse than one that is quietly short."
```

---

### Task 4: Wire the view in

**Files:**
- Modify: `index.html`, `src/api.js`, `src/main.js`, `style.css`

**Interfaces:**
- Consumes: `cardsHtml`/`renderCards` (Task 3); `PATCH`/`DELETE /api/cards` (Task 2).
- Produces:
  - `API.updateCard(cardId, prompt, answer) -> Promise<card | null>`
  - `API.deleteCard(cardId) -> Promise<{ok:true} | null>`
  - A `#cards` view reachable from the nav.

- [ ] **Step 1: Add the nav link and the panel to `index.html`**

In `<nav class="nav">`, after the Today link:

```html
    <a href="#cards">Cards</a>
```

Immediately before `<div id="view-paths" class="view-panel">`:

```html
<div id="view-cards" class="view-panel">
  <div class="container">
    <section class="today-block">
      <div class="today-block-title">Your cards</div>
      <div id="cards-list"></div>
    </section>
  </div>
</div>
```

- [ ] **Step 2: Add the API methods to `src/api.js`**

Beside `createCard`:

```js
    async updateCard(cardId, prompt, answer) {
      const res = await API.mutate('PATCH', '/api/cards', { cardId, prompt, answer });
      return res ? res.card : null;
    },

    async deleteCard(cardId) {
      return API.mutate('DELETE', `/api/cards?cardId=${encodeURIComponent(cardId)}`);
    },
```

- [ ] **Step 3: Mount the view in `src/main.js`**

Add the import beside the others:

```js
import { renderCards } from './cards-view.js';
```

and, immediately after the `renderPaths(...)` call, add:

```js
  // Cards are edited in place rather than refetched: the outbox guarantees
  // delivery, and a refetch while offline would serve the cached list and make
  // the edit appear to vanish.
  function paintCards() {
    renderCards(ctx, CAPTURE_STATE.cards, {
      async onSave(cardId, prompt, answer) {
        await API.updateCard(cardId, prompt, answer);
        const card = CAPTURE_STATE.cards.find(c => c.id === cardId);
        if (card) { card.prompt = prompt; card.answer = answer; }
        paintCards();
        await window.TODAY.render();
      },
      async onDelete(cardId) {
        await API.deleteCard(cardId);
        CAPTURE_STATE.cards = CAPTURE_STATE.cards.filter(c => c.id !== cardId);
        paintCards();
        await window.TODAY.render();
      }
    });
  }
  paintCards();

  // Signed out we know nothing about anyone's cards, so say that rather than
  // showing an empty list that reads as "you have none".
  if (!isSignedIn()) {
    document.getElementById('cards-list').innerHTML =
      `<span class="signed-out-note">Sign in with GitHub to see your cards.</span>`;
  }
```

- [ ] **Step 4: Add the styles**

Append to `style.css`:

```css
/* ── Card list ─────────────────────────────────────────────── */
.card-phase { margin-bottom: 28px; }
.card-phase-title { font-family: var(--mono); font-size: 12px; font-weight: 600;
  color: var(--accent); text-transform: uppercase; letter-spacing: 0.06em;
  margin-bottom: 12px; }
.card-group { margin-bottom: 16px; }
.card-group-title { font-size: 12px; color: var(--muted2); margin-bottom: 6px; }
.card-row { border: 1px solid var(--border); border-radius: 3px;
  padding: 12px 14px; margin-bottom: 8px; }
.card-prompt { font-size: 14px; margin-bottom: 4px; }
.card-answer { font-size: 13px; color: var(--muted); line-height: 1.6; }
.card-meta { font-family: var(--mono); font-size: 11px; color: var(--muted2);
  margin-top: 8px; }
.card-overdue { color: var(--red); }
.card-actions { display: flex; gap: 8px; margin-top: 10px; }
.card-btn { font: inherit; font-size: 12px; padding: 4px 10px;
  border: 1px solid var(--border); border-radius: 2px;
  background: rgba(255,255,255,0.05); color: inherit; cursor: pointer; }
.card-btn:hover { background: rgba(255,255,255,0.12); }
.card-confirm { font-size: 12px; color: var(--red);
  display: inline-flex; align-items: center; gap: 6px; }
.card-edit { margin-top: 10px; }
```

- [ ] **Step 5: Build**

```bash
pnpm build
```

Expected: a clean build. A missing export surfaces here rather than at runtime.

- [ ] **Step 6: Verify against the real Worker**

```bash
pnpm db:migrate:local
pnpm validate
pnpm build
pnpm dev:worker
```

The API can be exercised without signing in only for public routes, so this
check uses the tests as its proof and the browser as confirmation once GitHub
sign-in is configured. Confirm at minimum that the page still serves and the
bundle contains the new view:

```bash
curl -s -o /dev/null -w 'page %{http_code}\n' localhost:8787/
grep -c 'view-cards' dist/index.html
```

Expected: `page 200` and `1`.

- [ ] **Step 7: Run everything and commit**

```bash
pnpm test
git add index.html src style.css
git commit -m "Wire the card list into the app

Edits apply in place rather than refetching. The outbox guarantees
delivery, so a refetch while offline would serve the cached list, the
edit would appear to vanish, and it would be retyped.

Signed out, the list says we do not know who you are rather than showing
an empty list that reads as you have no cards."
```

---

## Verification checklist

- [ ] `pnpm test` — 123 previous plus 28 new
- [ ] Editing a card changes its text and leaves `due_at`, `stability`, `reps` and `lapses` identical
- [ ] `PATCH` and `DELETE` on another user's card both 404 **and leave that card untouched**
- [ ] A blank prompt or answer is a 400 on both create and update
- [ ] `DELETE` with no `cardId` is a 400, not a silent success
- [ ] Deleting a card removes its review rows
- [ ] The list groups in path order and shows the subtask each card came from
- [ ] Deleting requires two clicks and never opens a browser dialog
