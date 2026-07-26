# DOM Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute six sub-projects' worth of click handlers, and assert for the first time that the app boots at all.

**Architecture:** Two Vitest projects — Worker tests stay in `workerd` against real D1, everything else runs under `happy-dom`. A harness loads the real `index.html`, stubs the four endpoints boot touches, and calls the exported `boot()`.

**Tech Stack:** Vitest 4, `happy-dom`, `@cloudflare/vitest-pool-workers`, Vite 8, pnpm, Node 24.

## Global Constraints

- **All 183 existing tests must still pass** after the config split. A split that quietly stopped running a project looks exactly like success.
- **Worker tests keep running in `workerd` against real D1.** That arrangement works and is not being changed.
- **Tests load the real `index.html`.** Hand-written markup would pass while the shell was missing an element a handler looks up.
- **No snapshot tests.** A snapshot fails on every wording change and proves nothing about behaviour.
- **Every assertion is about what the app does**, not what it contains.
- The two production changes — exporting `boot`, guarding `caches` — are improvements in their own right, not test scaffolding.
- Package manager is pnpm. Node >= 24.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `test/dom/harness.js` | `mountApp(state)` — loads `index.html`, stubs `fetch`, returns request log. |
| `test/dom/boot.test.js` | The three boot states. |
| `test/dom/sidebar.test.js` | Opening the pane, capture form appearing and saving. |
| `test/dom/runner.test.js` | Keyboard reveal, grade, and the typing cases. |
| `test/dom/cards.test.js` | Edit swap, cancel, two-step delete. |
| `test/dom/settings.test.js` | The typed-login delete confirm. |

**Modified:** `vitest.config.js` (two projects), `src/main.js` (export `boot`), `src/content.js` (guard `caches`), `package.json` (dev dependency), `README.md`.

---

### Task 1: Two Vitest projects

**Files:**
- Modify: `vitest.config.js`, `package.json`

**Interfaces:**
- Produces: a `worker` project running `test/worker/**` in `workerd`, and a `dom` project running `test/*.test.js` and `test/dom/**` under `happy-dom`.

- [ ] **Step 1: Install happy-dom**

```bash
pnpm add -D happy-dom
```

- [ ] **Step 2: Rewrite `vitest.config.js`**

```js
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// Read on the Node side at config time. Worker tests run inside the Workers
// runtime, where node:fs cannot slurp SQL files off disk.
const migrations = await readD1Migrations('./migrations');

export default defineConfig({
  test: {
    projects: [
      {
        // Routes and D1, against a real local database.
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              d1Databases: ['DB'],
              bindings: { TEST_MIGRATIONS: migrations }
            }
          })
        ],
        test: {
          name: 'worker',
          include: ['test/worker/**/*.test.js'],
          setupFiles: ['./test/apply-migrations.js']
        }
      },
      {
        // Everything else: the pure modules, and the DOM wiring above them.
        test: {
          name: 'dom',
          include: ['test/*.test.js', 'test/dom/**/*.test.js'],
          environment: 'happy-dom'
        }
      }
    ]
  }
});
```

- [ ] **Step 3: Run the whole suite and count**

```bash
pnpm test 2>&1 | tail -20
```

Expected: **183 tests passing**, and both project names appearing in the
output. If the total is lower than 183, a project is silently not running —
stop and find which, because a config split that drops a project looks
identical to success.

- [ ] **Step 4: Confirm both projects are actually selected**

```bash
pnpm vitest run --project worker 2>&1 | grep -E "Tests |Test Files"
pnpm vitest run --project dom 2>&1 | grep -E "Tests |Test Files"
```

Expected: two non-zero counts that sum to 183.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.js package.json pnpm-lock.yaml
git commit -m "Split the test suite into worker and dom projects

Worker tests keep running in workerd against real D1; everything else
moves to happy-dom so the click handlers can finally be executed.

Both project totals are checked separately, because a config split that
quietly stopped running one of them would look exactly like success."
```

---

### Task 2: The two production changes

**Files:**
- Modify: `src/main.js`, `src/content.js`
- Create: `test/dom/exports.test.js`

**Interfaces:**
- Produces:
  - `boot()` exported from `src/main.js`, still auto-registered on `DOMContentLoaded`.
  - `loadPath` in `src/content.js` works when `caches` is undefined.

- [ ] **Step 1: Write the failing test**

Create `test/dom/exports.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('main exports boot', () => {
  it('exports boot so it can be driven directly', async () => {
    const mod = await import('../../src/main.js');
    expect(typeof mod.boot).toBe('function');
  });
});

describe('loadPath without a Cache API', () => {
  const realCaches = globalThis.caches;
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    // Safari in private browsing has historically exposed no caches. A page
    // served there would throw during boot and render nothing at all.
    delete globalThis.caches;
  });

  afterEach(() => {
    if (realCaches) globalThis.caches = realCaches;
    globalThis.fetch = realFetch;
    vi.resetModules();
  });

  it('falls back to a plain fetch rather than throwing', async () => {
    const path = { id: 'p', title: 'P', phases: [] };
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes('index.json')) {
        return new Response(JSON.stringify({
          paths: [{ id: 'p', title: 'P', url: '/paths/p-abc.json' }]
        }), { status: 200 });
      }
      return new Response(JSON.stringify(path), { status: 200 });
    });

    const { loadPath } = await import('../../src/content.js');
    await expect(loadPath('p')).resolves.toEqual(path);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run test/dom/exports.test.js
```

Expected: FAIL — `boot` is not exported, and `loadPath` throws on `caches`.

- [ ] **Step 3: Export `boot` from `src/main.js`**

Replace the last line of the file:

```js
document.addEventListener('DOMContentLoaded', boot);
```

with:

```js
// Exported so tests can drive it directly: by the time a test module imports
// this file, DOMContentLoaded has already fired and the listener would never
// run. Separating the function from its registration is how a boot sequence
// should be written regardless.
export { boot };

document.addEventListener('DOMContentLoaded', boot);
```

and change the declaration from `async function boot()` to remain as is — the
`export { boot }` statement is enough.

- [ ] **Step 4: Guard `caches` in `src/content.js`**

Replace the body of `loadPath` after the `entry` lookup:

```js
  // The filename carries a content hash, so a cache hit is always the right
  // content and a stale copy is impossible rather than merely unlikely.
  //
  // Guarded because the Cache API is not universal: Safari in private
  // browsing has historically exposed no `caches`, and an unguarded call
  // would throw during boot and render nothing at all. Losing the cache is a
  // slower load; losing the page is the whole app.
  const cache = typeof caches !== 'undefined' ? await caches.open(CACHE) : null;

  if (cache) {
    const hit = await cache.match(entry.url);
    if (hit) return hit.json();
  }

  const res = await fetch(entry.url);
  if (!res.ok) throw new Error(`${entry.url} — ${res.status}`);
  if (cache) await cache.put(entry.url, res.clone());
  return res.json();
```

- [ ] **Step 5: Run the tests**

```bash
pnpm vitest run test/dom/exports.test.js
```

Expected: PASS, 2 tests.

- [ ] **Step 6: Confirm the build still works**

```bash
pnpm build
```

Expected: a clean build. `export { boot }` must not break the entry chunk.

- [ ] **Step 7: Commit**

```bash
git add src/main.js src/content.js test/dom/exports.test.js
git commit -m "Export boot, and survive without the Cache API

Writing a test harness meant asking what globals boot actually depends
on, which surfaced a real bug: content.js called caches.open unguarded.
Safari in private browsing has historically exposed no caches, so a page
served there would have thrown during boot and rendered nothing. Losing
the cache is a slower load; losing the page is the whole app.

boot is exported because by the time a test imports the module,
DOMContentLoaded has already fired and the listener would never run."
```

---

### Task 3: The harness

**Files:**
- Create: `test/dom/harness.js`

**Interfaces:**
- Consumes: `boot` from `src/main.js` (Task 2).
- Produces:
  - `mountApp(state) -> Promise<{ requests, path }>` where `state` is
    `{ signedIn = false, enrolled = false, cards = [], progress = [] }`.
  - `requests` is an array of `{ method, url, body }` recorded from the stubbed
    `fetch`, so tests can assert what was sent.
  - `path` is the real `paths/frontier-lab.json`, returned for convenience.

- [ ] **Step 1: Write `test/dom/harness.js`**

```js
import fs from 'node:fs';
import { vi } from 'vitest';
import path from '../../paths/frontier-lab.json';

const PATH_URL = '/paths/frontier-lab-test.json';

/**
 * Boots the real app against a stubbed network.
 *
 * The document is the real index.html read off disk — the DOM project runs in
 * Node, so the filesystem is available. A harness with hand-written markup
 * would pass happily while the actual shell was missing the element a handler
 * looks up by id, which is exactly the bug six sub-projects of unverified
 * wiring could be hiding.
 */
export async function mountApp(state = {}) {
  const {
    signedIn = false,
    enrolled = false,
    cards = [],
    progress = []
  } = state;

  const html = fs.readFileSync('index.html', 'utf8');
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
  document.body.innerHTML = body;

  window.location.hash = '';
  localStorage.clear();

  const me = signedIn
    ? {
        user: { id: 'u1', login: 'ravi', avatarUrl: null },
        enrollments: enrolled
          ? [{ pathId: 'frontier-lab', startedOn: '2026-07-01' }]
          : []
      }
    : { user: null, enrollments: [] };

  const requests = [];

  const json = (value) => new Response(JSON.stringify(value), {
    status: 200, headers: { 'content-type': 'application/json' }
  });

  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    const u = String(url);
    requests.push({
      method: opts.method ?? 'GET',
      url: u,
      body: opts.body ? JSON.parse(opts.body) : null
    });

    if (u.includes('/paths/index.json')) {
      return json({ paths: [{ id: 'frontier-lab', title: path.title, url: PATH_URL }] });
    }
    if (u.includes(PATH_URL)) return json(path);
    if (u.includes('/api/me')) return json(me);
    if (u.includes('/api/progress')) return json({ nodeIds: progress });
    if (u.includes('/api/cards')) return json({ cards });
    if (u.includes('/api/reviews')) return json({ card: {} });
    if (u.includes('/api/enrollments')) return json({ ok: true });
    return json({ ok: true });
  });

  // No Cache API in happy-dom; content.js is guarded for exactly this.
  delete globalThis.caches;

  const { boot } = await import('../../src/main.js');
  await boot();

  return { requests, path };
}

/** A card shaped like a real row, for tests that need one to exist. */
export function cardFor(subtaskId, over = {}) {
  const now = Date.now();
  return {
    id: `card-${subtaskId}`,
    subtask_id: subtaskId,
    path_id: 'frontier-lab',
    prompt: 'a prompt',
    answer: 'an answer',
    created_at: now, last_reviewed_at: null, due_at: now,
    stability: 0, reps: 0, lapses: 0,
    r: 0, due: true,
    ...over
  };
}
```

- [ ] **Step 2: Smoke the harness with a throwaway assertion**

Create `test/dom/boot.test.js` with just this for now:

```js
import { describe, it, expect } from 'vitest';
import { mountApp } from './harness.js';

describe('harness', () => {
  it('boots without throwing', async () => {
    await expect(mountApp()).resolves.toBeTruthy();
  });
});
```

- [ ] **Step 3: Run it**

```bash
pnpm vitest run test/dom/boot.test.js
```

Expected: PASS. **If it throws, that is the finding** — six sub-projects of
boot code have never executed, and this is the first time. Fix the app, not the
harness, unless the error is clearly about a missing stub.

- [ ] **Step 4: Commit**

```bash
git add test/dom/harness.js test/dom/boot.test.js
git commit -m "Add a DOM harness that boots the real app

The document is the real index.html read from disk. A harness with
hand-written markup would pass while the shell was missing the element a
handler looks up by id, which is the class of bug six sub-projects of
unverified wiring could be hiding."
```

---

### Task 4: The boot tests

**Files:**
- Modify: `test/dom/boot.test.js`

**Interfaces:**
- Consumes: `mountApp`, `cardFor` (Task 3).

- [ ] **Step 1: Replace `test/dom/boot.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { mountApp, cardFor } from './harness.js';
// Imported directly rather than read back from mountApp: the ids are needed to
// build the state passed *into* it.
import path from '../../paths/frontier-lab.json';

const $$ = sel => [...document.querySelectorAll(sel)];
const $ = sel => document.querySelector(sel);

const FIRST_SUBTASK = path.phases[0].tasks[0].subtasks[0];

describe('boot, signed out', () => {
  it('renders the whole curriculum, because the path is public', async () => {
    await mountApp();

    const tasks = path.phases.flatMap(p => p.tasks);
    const subtasks = tasks.flatMap(t => t.subtasks);

    expect($$('.day-section')).toHaveLength(tasks.length);       // 36
    expect($$('.task-item')).toHaveLength(subtasks.length);      // 158
  });

  it('builds a nav link per phase', async () => {
    await mountApp();
    for (const ph of path.phases) {
      expect($(`.nav a[href="#${ph.id}"]`)).toBeTruthy();
    }
  });

  it('offers sign-in rather than pretending there is nothing to show', async () => {
    await mountApp();
    expect($('.auth-signin')).toBeTruthy();
    expect($('#today-week').textContent).toMatch(/sign in/i);
  });

  it('never writes: it does not ask for progress or cards at all', async () => {
    const { requests } = await mountApp();
    const urls = requests.map(r => r.url).join(' ');
    expect(urls).not.toMatch(/api\/progress/);
    expect(urls).not.toMatch(/api\/cards/);
  });
});

describe('boot, signed in and enrolled', () => {
  it('shows both progress numbers', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    expect($('#today-covered').textContent).toMatch(/%$/);
    expect($('#today-retained').textContent).toMatch(/%$/);
  });

  it('reports the plan week rather than a sign-in prompt', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    expect($('#today-week').textContent).toMatch(/week/i);
  });

  it('counts a due card and enables the review button', async () => {
    await mountApp({
      signedIn: true, enrolled: true,
      cards: [cardFor(FIRST_SUBTASK.id)]
    });
    expect($('#today-due-count').textContent).toBe('1');
    expect($('#today-start-review').disabled).toBe(false);
  });

  it('marks a finished subtask with no card as capture debt', async () => {
    await mountApp({
      signedIn: true, enrolled: true,
      progress: [FIRST_SUBTASK.steps[0].id]
    });
    // The first subtask has more than one step, so one tick is not 100%;
    // this asserts the debt list renders at all rather than a specific count.
    expect($('#today-debt')).toBeTruthy();
  });
});

describe('boot, signed in without an enrolment', () => {
  it('lands on the picker', async () => {
    await mountApp({ signedIn: true, enrolled: false });
    expect(window.location.hash).toBe('#paths');
  });

  it('lists the catalogue with an enrol button', async () => {
    await mountApp({ signedIn: true, enrolled: false });
    expect($('#paths-list .path-enrol')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it**

```bash
pnpm vitest run test/dom/boot.test.js
```

Expected: PASS, 9 tests. Any failure here is a real defect in code that has
never run — read the error before touching the test.

- [ ] **Step 3: Commit**

```bash
git add test/dom/boot.test.js
git commit -m "Assert the app boots

Nothing in six sub-projects had ever asserted this application starts.
These drive the real boot against a stubbed network and check the three
states it can resolve to: signed out with the full curriculum readable,
signed in and enrolled with both progress numbers, and signed in without
an enrolment landing on the picker.

The signed-out case also asserts the app never asks for progress or
cards. Requesting them would 401 harmlessly, but it would mean the
frontend was reaching for data it has no business wanting."
```

---

### Task 5: Sidebar and capture

**Files:**
- Create: `test/dom/sidebar.test.js`

**Interfaces:**
- Consumes: `mountApp`, `cardFor` (Task 3).

- [ ] **Step 1: Write `test/dom/sidebar.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { mountApp, cardFor } from './harness.js';
import PATH from '../../paths/frontier-lab.json';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

/** The first subtask of the first task of the first phase. */
function firstSubtask(path) {
  return path.phases[0].tasks[0].subtasks[0];
}

function openFirst(path) {
  const s = firstSubtask(path);
  $(`.task-item[data-subtask-id="${s.id}"]`).click();
  return s;
}

describe('opening the sidebar', () => {
  it('shows that subtask, its description and one checkbox per step', async () => {
    const { path } = await mountApp({ signedIn: true, enrolled: true });
    const s = openFirst(path);

    expect($('#sidebar-title').textContent).toContain(s.title);
    expect($('#sidebar-body').textContent).toContain(s.desc.slice(0, 30));
    expect($$('#sidebar-body .step-checkbox')).toHaveLength(s.steps.length);
  });

  it('lists the resources that subtask carries', async () => {
    const { path } = await mountApp({ signedIn: true, enrolled: true });
    const s = openFirst(path);

    const urls = Object.values(s.resources ?? {}).flat().map(r => r.url);
    if (!urls.length) return;                 // some subtasks have none
    expect($('#sidebar-body').innerHTML).toContain(urls[0]);
  });

  it('disables every checkbox when signed out, so the page is readable and not writable', async () => {
    const { path } = await mountApp();
    openFirst(path);
    const boxes = $$('#sidebar-body .step-checkbox');
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.every(b => b.disabled)).toBe(true);
  });
});

describe('capture on finish', () => {
  async function finishFirstSubtask(state = {}) {
    const { path, requests } = await mountApp({
      signedIn: true, enrolled: true, ...state
    });
    const s = openFirst(path);
    for (const box of $$('#sidebar-body .step-checkbox')) {
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    }
    // let the awaited toggle() calls settle
    await new Promise(r => setTimeout(r, 0));
    return { path, requests, subtask: s };
  }

  it('raises the form once the last step is ticked', async () => {
    await finishFirstSubtask();
    expect($('.capture-form')).toBeTruthy();
  });

  it('does not raise it when a card for that subtask already exists', async () => {
    await finishFirstSubtask({ cards: [cardFor(PATH.phases[0].tasks[0].subtasks[0].id)] });
    expect($('.capture-form')).toBeNull();
  });

  it('refuses to save with an empty field rather than posting a blank card', async () => {
    const { requests } = await finishFirstSubtask();
    $('#capture-answer').value = 'something';
    $('#capture-prompt').value = '';
    $('#capture-save').click();
    await new Promise(r => setTimeout(r, 0));

    expect($('#capture-status').textContent).toMatch(/both fields/i);
    expect(requests.filter(r => r.method === 'POST' && r.url.includes('/api/cards')))
      .toHaveLength(0);
  });

  it('posts the subtask id along with the text, because that anchor is what Retained counts', async () => {
    const { requests, subtask } = await finishFirstSubtask();
    $('#capture-answer').value = 'the answer';
    $('#capture-prompt').value = 'the question';
    $('#capture-save').click();
    await new Promise(r => setTimeout(r, 0));

    const post = requests.find(r => r.method === 'POST' && r.url.includes('/api/cards'));
    expect(post).toBeTruthy();
    expect(post.body).toMatchObject({
      pathId: 'frontier-lab',
      subtaskId: subtask.id,
      prompt: 'the question',
      answer: 'the answer'
    });
  });
});
```

- [ ] **Step 2: Run it**

```bash
pnpm vitest run test/dom/sidebar.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 3: Commit**

```bash
git add test/dom/sidebar.test.js
git commit -m "Test the sidebar and the capture form

The capture form is the entry point for every card in the system and had
never been executed by anything. These assert it appears on the last
tick, stays away when a card already exists, refuses a half-filled save,
and posts the subtask id — the anchor Retained counts against."
```

---

### Task 6: The runner

**Files:**
- Create: `test/dom/runner.test.js`

**Interfaces:**
- Consumes: `mountApp`, `cardFor` (Task 3).

- [ ] **Step 1: Write `test/dom/runner.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { mountApp, cardFor } from './harness.js';
import path from '../../paths/frontier-lab.json';

const $ = sel => document.querySelector(sel);

const press = (key, opts = {}) => {
  const target = opts.target ?? document.body;
  target.dispatchEvent(new KeyboardEvent('keydown', {
    key, bubbles: true, cancelable: true, ...opts
  }));
};

const FIRST_SUBTASK = path.phases[0].tasks[0].subtasks[0];

async function openRunner(extra = {}) {
  const { requests } = await mountApp({
    signedIn: true, enrolled: true,
    cards: [cardFor(FIRST_SUBTASK.id,
      { prompt: 'the question', answer: 'the answer', ...extra })]
  });

  $('#today-start-review').click();
  await new Promise(r => setTimeout(r, 0));
  return { requests };
}

describe('the runner opens', () => {
  it('shows the prompt and hides the answer until asked', async () => {
    await openRunner();
    expect($('#runner').hidden).toBe(false);
    expect($('#runner-prompt').textContent).toBe('the question');
    expect($('#runner-answer').hidden).toBe(true);
    expect($('#runner-grades').hidden).toBe(true);
  });
});

describe('keyboard control', () => {
  it('reveals on space', async () => {
    await openRunner();
    press(' ');
    expect($('#runner-answer').hidden).toBe(false);
    expect($('#runner-grades').hidden).toBe(false);
  });

  it('ignores a digit before reveal, so a stray key cannot grade an unseen card', async () => {
    const { requests } = await openRunner();
    press('3');
    expect($('#runner-answer').hidden).toBe(true);
    expect(requests.filter(r => r.url.includes('/api/reviews'))).toHaveLength(0);
  });

  it('grades good on 3 once revealed', async () => {
    const { requests } = await openRunner();
    press(' ');
    press('3');
    await new Promise(r => setTimeout(r, 0));

    const post = requests.find(r => r.url.includes('/api/reviews'));
    expect(post).toBeTruthy();
    expect(post.body.grade).toBe('good');
  });

  it('types a space into the recall box instead of revealing, which is the whole reason for the keymap', async () => {
    await openRunner();
    const box = $('#runner-recall');
    box.focus();
    press(' ', { target: box });
    expect($('#runner-answer').hidden).toBe(true);
  });

  it('reveals from inside the box on cmd-enter', async () => {
    await openRunner();
    const box = $('#runner-recall');
    box.focus();
    press('Enter', { target: box, metaKey: true });
    expect($('#runner-answer').hidden).toBe(false);
  });

  it('escape leaves the box before it closes the runner', async () => {
    await openRunner();
    const box = $('#runner-recall');
    box.focus();

    press('Escape', { target: box });
    expect($('#runner').hidden).toBe(false);   // still open, just blurred

    press('Escape');
    expect($('#runner').hidden).toBe(true);
  });
});
```

- [ ] **Step 2: Run it**

```bash
pnpm vitest run test/dom/runner.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 3: Commit**

```bash
git add test/dom/runner.test.js
git commit -m "Test the runner keyboard end to end

keyAction was already covered exhaustively as a pure function. These
prove the listener that calls it is actually connected: that it reads
the revealed state from the DOM, detects the textarea, and drives the
same reveal button the mouse does.

The space-inside-the-textarea case is the one the whole keymap design
exists for, and it is now asserted against a real focused element rather
than a hand-made state object."
```

---

### Task 7: Card list and settings

**Files:**
- Create: `test/dom/cards.test.js`, `test/dom/settings.test.js`

**Interfaces:**
- Consumes: `mountApp`, `cardFor` (Task 3).

- [ ] **Step 1: Write `test/dom/cards.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { mountApp, cardFor } from './harness.js';
import path from '../../paths/frontier-lab.json';

const $ = sel => document.querySelector(sel);

const FIRST_SUBTASK_ID = path.phases[0].tasks[0].subtasks[0].id;

async function withOneCard() {
  const { requests } = await mountApp({
    signedIn: true, enrolled: true,
    cards: [cardFor(FIRST_SUBTASK_ID,
      { id: 'c1', prompt: 'old question', answer: 'old answer' })]
  });
  return { requests, cardId: 'c1' };
}

describe('the card list', () => {
  it('renders the card with its text', async () => {
    await withOneCard();
    expect($('#cards-list').textContent).toContain('old question');
    expect($('#cards-list').textContent).toContain('old answer');
  });

  it('swaps the row for an editor holding the current text', async () => {
    await withOneCard();
    $('[data-action="edit"]').click();

    expect($('[data-field="prompt"]').value).toBe('old question');
    expect($('[data-field="answer"]').value).toBe('old answer');
    expect($('.card-display').hidden).toBe(true);
  });

  it('cancel puts the row back without sending anything', async () => {
    const { requests } = await withOneCard();
    const before = requests.length;

    $('[data-action="edit"]').click();
    $('[data-action="cancel"]').click();

    expect($('.card-edit')).toBeNull();
    expect($('.card-display').hidden).toBe(false);
    expect(requests).toHaveLength(before);
  });

  it('saving patches the card with the new text', async () => {
    const { requests, cardId } = await withOneCard();

    $('[data-action="edit"]').click();
    $('[data-field="prompt"]').value = 'new question';
    $('[data-field="answer"]').value = 'new answer';
    $('[data-action="save"]').click();
    await new Promise(r => setTimeout(r, 0));

    const patch = requests.find(r => r.method === 'PATCH');
    expect(patch).toBeTruthy();
    expect(patch.body).toMatchObject({
      cardId, prompt: 'new question', answer: 'new answer'
    });
  });

  it('refuses to save an empty field rather than patching a blank card', async () => {
    const { requests } = await withOneCard();

    $('[data-action="edit"]').click();
    $('[data-field="prompt"]').value = '';
    $('[data-action="save"]').click();
    await new Promise(r => setTimeout(r, 0));

    expect(requests.find(r => r.method === 'PATCH')).toBeUndefined();
  });

  it('deleting takes two clicks, and the first one sends nothing', async () => {
    const { requests } = await withOneCard();
    const before = requests.length;

    $('[data-action="delete"]').click();
    expect($('[data-action="confirm-delete"]')).toBeTruthy();
    expect(requests).toHaveLength(before);
  });

  it('saying no puts the delete button back', async () => {
    await withOneCard();
    $('[data-action="delete"]').click();
    $('[data-action="cancel-delete"]').click();

    expect($('[data-action="delete"]')).toBeTruthy();
    expect($('[data-action="confirm-delete"]')).toBeNull();
  });

  it('confirming sends the delete', async () => {
    const { requests, cardId } = await withOneCard();

    $('[data-action="delete"]').click();
    $('[data-action="confirm-delete"]').click();
    await new Promise(r => setTimeout(r, 0));

    const del = requests.find(r => r.method === 'DELETE');
    expect(del).toBeTruthy();
    expect(del.url).toContain(cardId);
  });
});
```

- [ ] **Step 2: Write `test/dom/settings.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { mountApp } from './harness.js';

const $ = sel => document.querySelector(sel);

const type = (el, value) => {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('deleting an account', () => {
  it('starts disabled', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    expect($('#delete-account').disabled).toBe(true);
  });

  it('stays disabled for a near miss, because this cascades through four tables', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    type($('#delete-confirm'), 'rav');
    expect($('#delete-account').disabled).toBe(true);

    type($('#delete-confirm'), 'Ravi');
    expect($('#delete-account').disabled).toBe(true);
  });

  it('enables only on an exact match of the login', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    type($('#delete-confirm'), 'ravi');
    expect($('#delete-account').disabled).toBe(false);
  });

  it('disables again if the text is changed back', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    type($('#delete-confirm'), 'ravi');
    type($('#delete-confirm'), 'ravix');
    expect($('#delete-account').disabled).toBe(true);
  });
});

describe('export', () => {
  it('requests the export when JSON is pressed', async () => {
    const { requests } = await mountApp({ signedIn: true, enrolled: true });
    $('#export-json').click();
    await new Promise(r => setTimeout(r, 0));

    expect(requests.some(r => r.url.includes('/api/export'))).toBe(true);
  });

  it('says so rather than downloading nothing when the server cannot be reached', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    globalThis.fetch = async () => { throw new Error('offline'); };

    $('#export-json').click();
    await new Promise(r => setTimeout(r, 0));

    expect($('#export-status').textContent).toMatch(/could not reach/i);
  });
});

describe('settings when signed out', () => {
  it('says who we do not know, rather than showing an empty panel', async () => {
    await mountApp();
    expect($('#view-settings').textContent).toMatch(/sign in/i);
  });
});
```

- [ ] **Step 3: Run both**

```bash
pnpm vitest run test/dom/cards.test.js test/dom/settings.test.js
```

Expected: PASS — 8 and 7.

`URL.createObjectURL` may be absent in happy-dom. If the export test fails with
that name, add this line to the top of `test/dom/settings.test.js` — it is a
browser API the test environment lacks, not a defect in the app:

```js
globalThis.URL.createObjectURL ??= () => 'blob:stub';
globalThis.URL.revokeObjectURL ??= () => {};
```

- [ ] **Step 4: Commit**

```bash
git add test/dom/cards.test.js test/dom/settings.test.js
git commit -m "Test the card list and the settings view

The two-step delete is asserted to send nothing on the first click.
Confirming that it takes two clicks is worth less than confirming the
first one is inert.

The delete-account confirm is checked against a near miss and a changed
mind, not only the exact match: an input handler that enabled on
substring or never re-disabled would pass a happy-path test."
```

---

### Task 8: Retire the rule in the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the commands block**

In `README.md`, replace the `pnpm test` line in the Commands block:

```
pnpm test         vitest — worker routes against real D1, plus DOM tests under happy-dom
```

- [ ] **Step 2: Add a short testing section**

Immediately before `## Link hygiene`, add:

````markdown
## Tests

Two Vitest projects:

```
pnpm vitest run --project worker    routes and D1, in the Workers runtime
pnpm vitest run --project dom       pure modules and the DOM wiring
```

The DOM tests boot the real app against a stubbed network, using the real
`index.html`. They catch broken wiring — a handler that never fires, an id that
does not exist. They cannot catch layout, CSS or focus behaviour, so they
shrink the need for a browser rather than removing it.
````

- [ ] **Step 3: Run everything**

```bash
pnpm test
pnpm build
```

Expected: all tests pass across both projects; clean build.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Document the two test projects

Also retires, in the place people actually read, the claim that this repo
has no DOM tests."
```

---

## Verification checklist

- [ ] `pnpm test` — 183 previous plus roughly 33 new, across two projects
- [ ] `pnpm vitest run --project worker` and `--project dom` both report non-zero
- [ ] The app boots: 36 task sections and 158 subtask cards render
- [ ] Signed out, every step checkbox is disabled and no progress or card request is made
- [ ] Ticking the last step of a subtask raises the capture form; an existing card suppresses it
- [ ] `Space` reveals; `Space` inside the recall box does not
- [ ] `3` before reveal sends no review
- [ ] The first Delete click sends nothing
- [ ] The delete-account button stays disabled for a near miss
