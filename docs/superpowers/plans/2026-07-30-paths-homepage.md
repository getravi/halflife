# Paths Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the path catalogue a browsable homepage with rich cards, and address the rendered path via `?path=` in the URL so one account can hold and switch between multiple enrolments.

**Architecture:** The path lives in the query string, the view in the hash (`/?path=mission-masters-degree#today`). Switching paths is navigation — the page reloads and boot rebuilds everything for the addressed path, matching the app's existing "re-boot rather than patch state" pattern. Cards render entirely from catalogue metadata derived at build time by `tools/validate-path.js`.

**Tech Stack:** Vanilla ES modules, Vite, Vitest (node + happy-dom), Cloudflare Worker backend (unchanged).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-30-homepage-design.md`
- Path ids are append-only; never rename ids in `paths/*.json`.
- No backend/API/migration changes — progress, cards, notes are already keyed per path.
- Commit style: plain imperative sentence-case subjects (repo convention, e.g. "Trim the sidebar for phones"), not Conventional Commits.
- Full suite must stay green: `pnpm test` (349 tests before this work).
- Escape all catalogue-derived text with the local `esc()` helper before inserting into HTML.

---

### Task 1: Catalogue metadata — tagline + derived stats

**Files:**
- Modify: `tools/validate-path.js` (validatePath ~line 34, emit ~line 170)
- Modify: `paths/frontier-lab.json` (add top-level `tagline`)
- Modify: `paths/mission-masters-degree.json` (add top-level `tagline`)
- Test: `test/validate-path.test.js`

**Interfaces:**
- Produces catalogue entries of shape:
  `{ id, title, tagline, weeks, tasks, phases: [{ id, title }], url }`
  where `weeks` = max phase end week, `tasks` = total task count
  (milestones included), `phases` preserves path order.
- Task 2 and Task 3 consume this exact shape.

- [ ] **Step 1: Write the failing tests**

Append to `test/validate-path.test.js` (the `valid()` factory at the top of the file builds a minimal path; note `emit` writes to disk, so test the pure derivation by importing `catalogueEntry` which this task adds):

```js
describe('catalogue metadata', () => {
  it('rejects a path without a tagline', () => {
    const p = valid();
    delete p.tagline;
    expect(validatePath(p, null).join()).toMatch(/tagline/i);
  });

  it('derives card stats for the catalogue', () => {
    const p = valid();
    p.tagline = 'One line.';
    const entry = catalogueEntry(p, 'p-abc123.json');
    expect(entry).toEqual({
      id: 'p', title: 'P', tagline: 'One line.',
      weeks: 4, tasks: 1,
      phases: [{ id: 'ph1', title: 'One' }],
      url: '/paths/p-abc123.json'
    });
  });
});
```

Also update the `valid()` factory to include `tagline: 't'` so existing
tests keep passing, and import `catalogueEntry` in the test file header:

```js
import { validatePath, validateExercises, catalogueEntry } from '../tools/validate-path.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run test/validate-path.test.js`
Expected: FAIL — `catalogueEntry` is not exported; tagline check missing.

- [ ] **Step 3: Implement**

In `tools/validate-path.js`, add to `validatePath` (near the top, after the id checks):

```js
  if (!p.tagline) problems.push('no tagline — the homepage card would be blank');
```

Add an exported helper and use it inside `emit()` where the catalogue entry is currently pushed:

```js
export function catalogueEntry(p, file) {
  let weeks = 0;
  let tasks = 0;
  for (const ph of p.phases ?? []) {
    if (ph.weeks) weeks = Math.max(weeks, ph.weeks[1]);
    tasks += (ph.tasks ?? []).length;
  }
  return {
    id: p.id,
    title: p.title,
    tagline: p.tagline,
    weeks,
    tasks,
    phases: (p.phases ?? []).map(ph => ({ id: ph.id, title: ph.title })),
    url: `/paths/${file}`
  };
}
```

In `emit()`, replace:

```js
    catalogue.paths.push({ id: p.id, title: p.title, url: `/paths/${file}` });
```

with:

```js
    catalogue.paths.push(catalogueEntry(p, file));
```

- [ ] **Step 4: Add taglines to both paths**

`paths/frontier-lab.json`, after the `"title"` line:

```json
  "tagline": "Fifty-two weeks of public, verifiable work from programming foundations to a frontier-lab-ready portfolio.",
```

`paths/mission-masters-degree.json`, after the `"title"` line:

```json
  "tagline": "A thirty-week admissions campaign from resume to submitted Fall 2027 applications for HCI and information master's programs.",
```

- [ ] **Step 5: Run the validator and full test file**

Run: `node tools/validate-path.js && pnpm vitest run test/validate-path.test.js`
Expected: `OK — 2 path(s)`, all tests PASS. Inspect `public/paths/index.json` — both entries carry tagline/weeks/tasks/phases.

- [ ] **Step 6: Commit**

```bash
git add tools/validate-path.js paths/frontier-lab.json paths/mission-masters-degree.json test/validate-path.test.js public/paths 2>/dev/null
git commit -m "Emit card metadata into the path catalogue"
```

(If `public/paths` is gitignored the add silently skips it; that is fine.)

---

### Task 2: URL path resolution

**Files:**
- Modify: `src/content.js` (append pure function)
- Test: `test/resolve-path.test.js` (create)

**Interfaces:**
- Consumes: catalogue shape from Task 1 (only `paths[].id`).
- Produces: `resolvePathId(search, catalogue, enrollments) -> string` —
  `search` is `window.location.search` (e.g. `"?path=x"`), `enrollments`
  is `me.enrollments` (`[{ pathId, startedOn }]`). Resolution order:
  valid `?path=` → first enrolment → `'frontier-lab'`. Task 4 consumes
  this exact signature.

- [ ] **Step 1: Write the failing tests**

Create `test/resolve-path.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { resolvePathId } from '../src/content.js';

const catalogue = { paths: [{ id: 'frontier-lab' }, { id: 'mission-masters-degree' }] };

describe('resolvePathId', () => {
  it('honors a ?path= value that exists in the catalogue', () => {
    expect(resolvePathId('?path=mission-masters-degree', catalogue, []))
      .toBe('mission-masters-degree');
  });

  it('falls back to the first enrolment when ?path= is unknown', () => {
    expect(resolvePathId('?path=nope', catalogue,
      [{ pathId: 'mission-masters-degree' }]))
      .toBe('mission-masters-degree');
  });

  it('falls back to the first enrolment when there is no query', () => {
    expect(resolvePathId('', catalogue, [{ pathId: 'mission-masters-degree' }]))
      .toBe('mission-masters-degree');
  });

  it('defaults to frontier-lab with no query and no enrolments', () => {
    expect(resolvePathId('', catalogue, [])).toBe('frontier-lab');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run test/resolve-path.test.js`
Expected: FAIL — `resolvePathId` is not exported.

- [ ] **Step 3: Implement**

Append to `src/content.js`:

```js
/**
 * Which path this page-load renders. The URL wins so a link or bookmark
 * always shows what it says; an unknown id falls through silently because
 * a stale bookmark should degrade to the person's own path, not an error.
 */
export function resolvePathId(search, catalogue, enrollments) {
  const wanted = new URLSearchParams(search).get('path');
  if (wanted && catalogue.paths.some(p => p.id === wanted)) return wanted;
  return enrollments?.[0]?.pathId ?? 'frontier-lab';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run test/resolve-path.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/content.js test/resolve-path.test.js
git commit -m "Resolve the rendered path from the URL"
```

---

### Task 3: Homepage cards

**Files:**
- Modify: `src/paths-view.js` (rewrite)
- Test: `test/paths-view.test.js` (create)

**Interfaces:**
- Consumes: catalogue entry shape from Task 1.
- Produces:
  - `pathCardsHtml(catalogue, enrolledIds, signedIn) -> string` — pure,
    for tests. `enrolledIds` is a `Set`.
  - `renderPaths(catalogue, enrolledIds, signedIn, onEnrol)` — same DOM
    mount point (`#paths-list`) and enrol-callback contract as today;
    Task 4 passes `signedIn` as the new third argument.

- [ ] **Step 1: Write the failing tests**

Create `test/paths-view.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { pathCardsHtml } from '../src/paths-view.js';

const catalogue = { paths: [{
  id: 'mm', title: 'Mission Masters Degree', tagline: 'Apply well.',
  weeks: 30, tasks: 28,
  phases: [{ id: 'mm-p0', title: 'August' }, { id: 'mm-p1', title: 'September' }],
  url: '/paths/mm-x.json'
}] };

describe('pathCardsHtml', () => {
  it('shows title, tagline, stats and phase titles', () => {
    const html = pathCardsHtml(catalogue, new Set(), true);
    expect(html).toContain('Mission Masters Degree');
    expect(html).toContain('Apply well.');
    expect(html).toContain('30 weeks');
    expect(html).toContain('2 phases');
    expect(html).toContain('28 tasks');
    expect(html).toContain('August');
  });

  it('offers Continue for an enrolled path, linking into it', () => {
    const html = pathCardsHtml(catalogue, new Set(['mm']), true);
    expect(html).toContain('Continue');
    expect(html).toContain('/?path=mm#today');
    expect(html).not.toContain('path-enrol');
  });

  it('offers Enrol when signed in but not enrolled', () => {
    const html = pathCardsHtml(catalogue, new Set(), true);
    expect(html).toContain('Enrol');
    expect(html).toContain('data-path-id="mm"');
  });

  it('offers a read-only view link when signed out', () => {
    const html = pathCardsHtml(catalogue, new Set(), false);
    expect(html).toContain('View path');
    expect(html).toContain('/?path=mm#mm-p0');
    expect(html).not.toContain('path-enrol');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run test/paths-view.test.js`
Expected: FAIL — `pathCardsHtml` is not exported.

- [ ] **Step 3: Rewrite `src/paths-view.js`**

```js
/**
 * The homepage: one card per path. Cards render from catalogue metadata
 * alone — no full-path fetches — so this stays cheap however many paths
 * exist. The one button per card is the whole enrolment UI.
 */
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function cardButton(p, enrolledIds, signedIn) {
  if (enrolledIds.has(p.id)) {
    return `<a class="today-review-btn" href="/?path=${esc(p.id)}#today">Continue</a>`;
  }
  if (signedIn) {
    return `<button class="today-review-btn path-enrol" data-path-id="${esc(p.id)}">Enrol</button>`;
  }
  const first = p.phases?.[0]?.id ?? '';
  return `<a class="today-review-btn" href="/?path=${esc(p.id)}#${esc(first)}">View path</a>`;
}

export function pathCardsHtml(catalogue, enrolledIds, signedIn) {
  return (catalogue.paths ?? []).map(p => `
    <div class="path-card">
      <div class="path-card-head">
        <span class="path-title">${esc(p.title)}</span>
        ${cardButton(p, enrolledIds, signedIn)}
      </div>
      <p class="path-tagline">${esc(p.tagline)}</p>
      <div class="path-stats">${p.weeks} weeks · ${(p.phases ?? []).length} phases · ${p.tasks} tasks</div>
      <ol class="path-phase-list">
        ${(p.phases ?? []).map(ph => `<li>${esc(ph.title)}</li>`).join('')}
      </ol>
    </div>`).join('');
}

export function renderPaths(catalogue, enrolledIds, signedIn, onEnrol) {
  const list = document.getElementById('paths-list');
  if (!list) return;

  list.innerHTML = pathCardsHtml(catalogue, enrolledIds, signedIn);

  list.querySelectorAll('.path-enrol').forEach(btn => {
    btn.addEventListener('click', () => onEnrol(btn.dataset.pathId));
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run test/paths-view.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Add card styles**

Append to `style.css`, matching existing custom-property usage (find the
`.path-row` rules and place these beside them; keep `.path-row` styles —
delete them only if nothing else references them, checked via grep):

```css
.path-card { padding: 16px 0; border-bottom: 1px solid var(--border, rgba(128,128,128,.2)); }
.path-card:last-child { border-bottom: none; }
.path-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.path-tagline { margin: 6px 0 4px; opacity: .85; }
.path-stats { font-size: .85em; opacity: .6; margin-bottom: 6px; }
.path-phase-list { margin: 0; padding-left: 1.4em; font-size: .9em; opacity: .75; }
```

Verify variable names against `style.css` before committing — if the file
has no `--border` variable, reuse whatever the existing `.today-block`
border declaration uses.

- [ ] **Step 6: Commit**

```bash
git add src/paths-view.js test/paths-view.test.js style.css
git commit -m "Render the path catalogue as homepage cards"
```

---

### Task 4: Boot wiring and landing rules

**Files:**
- Modify: `src/main.js` (~lines 24, 45–52, 90–97, 133–139)
- Test: full suite + DOM boot tests (`test/dom/boot.test.js` may need its
  fixtures' catalogue entries extended with the Task 1 fields)

**Interfaces:**
- Consumes: `resolvePathId(search, catalogue, enrollments)` from Task 2;
  `renderPaths(catalogue, enrolledIds, signedIn, onEnrol)` from Task 3.
- Produces: final user-facing behavior; nothing downstream.

- [ ] **Step 1: Rework path selection in `boot()`**

In `src/main.js`: delete the `const DEFAULT_PATH_ID = 'frontier-lab';`
module constant. Import `resolvePathId` alongside the existing content
imports:

```js
import { loadPath, loadCatalogue, resolvePathId } from './content.js';
```

Replace the current selection block (the comment + `const PATH_ID = me.enrollments?.[0]?.pathId ?? DEFAULT_PATH_ID;` after `renderHeader()`) with a catalogue-first load — the catalogue is already fetched later in boot; move that fetch up so it happens once:

```js
  const catalogue = await loadCatalogue();
  const PATH_ID = resolvePathId(window.location.search, catalogue, me.enrollments);

  const path = await loadPath(PATH_ID);
```

Then delete the later `const catalogue = await loadCatalogue();` line
(around the `renderPaths` call) so the single early fetch serves both.

- [ ] **Step 2: Pass viewer state to `renderPaths` and navigate on enrol**

Replace the existing `renderPaths(catalogue, enrolled, async pathId => { ... })` call with:

```js
  renderPaths(catalogue, enrolled, isSignedIn(), async pathId => {
    await API.enrol(pathId, localDate(new Date()));
    window.location.href = `/?path=${encodeURIComponent(pathId)}#today`;
  });
```

(`window.location.href` with a changed query string reloads the page, so
the explicit `reload()` call goes away.)

- [ ] **Step 3: Landing rules**

Replace the final redirect block:

```js
  if (me.user && !me.user.emailVerified) {
    window.location.hash = '#account';
  } else if (isSignedIn() && !enrolled.has(PATH_ID)) {
    window.location.hash = '#paths';
  } else if (!window.location.hash) {
    window.location.hash = '#today';
  }
```

with:

```js
  if (me.user && !me.user.emailVerified) {
    window.location.hash = '#account';
  } else if (isSignedIn() && !enrolled.has(PATH_ID)) {
    window.location.hash = '#paths';
  } else if (!window.location.hash) {
    // Enrolled people land on their work; everyone else lands on the
    // catalogue, which is the homepage.
    window.location.hash = isSignedIn() ? '#today' : '#paths';
  }
```

- [ ] **Step 4: Run the full suite; mend DOM fixtures**

Run: `pnpm test`
Expected: any failure is in `test/dom/*.test.js` fixtures whose stub
catalogue lacks the new fields or whose `renderPaths` call signature is
asserted. Fix fixtures by adding `tagline: 't', weeks: 1, tasks: 1,
phases: [{ id: 'ph1', title: 'One' }]` to stub catalogue entries — do not
weaken assertions. Re-run until green (349 + new tests).

- [ ] **Step 5: Verify end-to-end**

Run: `pnpm dev` (or the repo's dev command) and check by hand:
1. Signed out, `/` → lands on `#paths`, cards show both paths with stats, "View path" opens the first phase read-only.
2. Signed in (enrolled in frontier-lab), `/` → lands on `#today` for frontier-lab; homepage shows Continue on frontier-lab, Enrol on Mission Masters Degree.
3. Enrol in the second path → page reloads at `/?path=mission-masters-degree#today`; progress starts clean; switching back via the homepage Continue works and frontier-lab progress is intact.

- [ ] **Step 6: Commit**

```bash
git add src/main.js test/dom
git commit -m "Land on the catalogue and address the path in the URL"
```

---

## Self-Review

- **Spec coverage:** §1 URL scheme → Tasks 2 & 4; §2 catalogue metadata → Task 1; §3 cards → Task 3; §4 landing rules → Task 4 step 3; §5 error handling → resolvePathId silent fallthrough (Task 2) + unchanged boot/API behavior; §6 testing → each task's test steps. No gaps.
- **Placeholder scan:** all steps carry concrete code/commands; the one deliberately conditional instruction (CSS variable name, `.path-row` removal) states exactly how to decide.
- **Type consistency:** catalogue entry shape `{ id, title, tagline, weeks, tasks, phases: [{id,title}], url }` is identical in Tasks 1, 2 (subset), 3, and 4 fixtures; `resolvePathId(search, catalogue, enrollments)` and `renderPaths(catalogue, enrolledIds, signedIn, onEnrol)` match at definition and call sites.
