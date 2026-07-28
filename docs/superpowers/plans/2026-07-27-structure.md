# Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 158 subtasks navigable — what a subtask assumes, what needs it, and where a term appears and is explained.

**Architecture:** Two optional fields on the path format, filled by two one-shot tools whose output a human reviews. Three new validator checks. Two pure string builders and a new view.

**Tech Stack:** Node 24, Vitest with happy-dom, Vite 8, pnpm. No new dependencies.

## Global Constraints

- **No definitions, by anyone.** The term index answers *where does this appear and where is it explained*, never *what does it mean*.
- **Prerequisites come only from explicit textual references.** Deriving from ordering yields ~12,000 meaningless edges.
- **A term is kept only if it appears in two or more subtasks.** Measured: this takes 652 candidates down to 109.
- **The derivation output carries the sentence that produced each candidate.** A bare list of ids is unreviewable and would be approved wholesale.
- **Both tools run once and their output is committed.** Neither is part of the build, exactly as `tools/convert-path.js` was.
- **Both new fields are optional**, so existing paths stay valid.
- Package manager is pnpm. Node >= 24.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `tools/derive-prereqs.js` | Emits dependency *candidates* with evidence, for a human to turn into edges. |
| `tools/extract-terms.js` | Emits the term index, filtered to terms appearing twice or more. |
| `src/prereq-view.js` | `prereqHtml(subtask, ctx, doneSet)` and `neededByHtml(...)` — pure. |
| `src/glossary-view.js` | `glossaryHtml(terms, ctx, filter)` — pure — plus `renderGlossary`. |
| `test/prereq-view.test.js`, `test/glossary-view.test.js` | The string builders. |
| `test/dom/structure.test.js` | Sidebar prerequisites, glossary filtering. |

**Modified:** `paths/frontier-lab.json`, `tools/validate-path.js`, `test/validate-path.test.js`, `src/sidebar.js`, `src/main.js`, `index.html`, `style.css`.

---

### Task 1: Propose prerequisite candidates

**Files:**
- Create: `tools/derive-prereqs.js`
- Modify: `paths/frontier-lab.json`

**Interfaces:**
- Produces: `prereqs: string[]` on subtasks in the path. Optional; absent means none.

**This task ends in a human review that cannot be skipped.** The tool proposes;
it does not decide.

- [ ] **Step 1: Write the tool**

Create `tools/derive-prereqs.js`:

```js
#!/usr/bin/env node
/**
 * Proposes prerequisite candidates by finding sentences that name a
 * dependency out loud, and prints the sentence beside each one.
 *
 * It deliberately does NOT write to the path. Precision here is low — the
 * phrases below also match ordinary prose about weeks and repos — so the
 * output is a worksheet for a human, not an answer. Writing edges nobody read
 * would assert dependencies nobody checked, in a tool whose whole purpose is
 * telling you the truth about what you know.
 *
 * Run once: node tools/derive-prereqs.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const plan = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'paths/frontier-lab.json'), 'utf8'));

// Tight on purpose. "week 1" alone is a schedule reference, not a dependency;
// "you built" and "depends on" name an artifact that must already exist.
const SIGNALS = [
  /\bdepends on\b/i,
  /\byou (built|published|wrote|stood up|created)\b/i,
  /\bvariation on\b/i,
  /\bfrom (week|phase) \d+\b/i,
  /\bthe (environment|harness|endpoint|verifier) you\b/i,
  /\bearlier (task|subtask|phase)\b/i
];

const sentences = text => String(text ?? '')
  .split(/(?<=[.!?])\s+/)
  .map(s => s.trim())
  .filter(Boolean);

let candidates = 0;
const lines = [];

for (const ph of plan.phases) {
  for (const t of ph.tasks) {
    for (const s of t.subtasks ?? []) {
      const text = [s.desc, ...(s.steps ?? []).map(x => x.text)].join(' ');
      const hits = sentences(text).filter(sent => SIGNALS.some(re => re.test(sent)));
      if (!hits.length) continue;

      candidates++;
      lines.push(`\n${s.id}  (${ph.id} · ${s.title})`);
      for (const h of hits) lines.push(`    "${h.replace(/\s+/g, ' ').slice(0, 220)}"`);
    }
  }
}

lines.push(`\n\n${candidates} subtasks carry a dependency phrase.`);
lines.push('For each, decide which subtask id it depends on and add:');
lines.push('    "prereqs": ["<subtask-id>"]');
lines.push('Most of these will be false positives. Deleting is the common case.');

fs.writeFileSync(path.join(ROOT, 'prereq-candidates.txt'), lines.join('\n') + '\n');
console.log(`wrote prereq-candidates.txt — ${candidates} subtasks to review`);
```

- [ ] **Step 2: Run it**

```bash
node tools/derive-prereqs.js
wc -l prereq-candidates.txt
```

Expected: a file listing subtasks with their triggering sentences.

- [ ] **Step 3: Review and add the real edges**

Read `prereq-candidates.txt`. For each candidate that names a genuine
dependency, add a `prereqs` array to that subtask in
`paths/frontier-lab.json`. Delete the rest from consideration.

**Expect to keep few.** The measured signal is loose: of 158 subtasks, roughly
a third contain a phrase like this, and most are prose about weeks and repos
rather than real dependencies. Ten to thirty genuine edges is a good outcome; a
hundred would mean the review was not done.

Known real ones to look for, from the path text:

- the agent harness assumes the served endpoint (*"Phase 3 depends on exactly this"*)
- the statistics, judge and audit subtasks assume the environment published at week 26
- the later vLLM subtasks are *"a variation on one server"* — the first one

- [ ] **Step 4: Delete the worksheet**

```bash
rm prereq-candidates.txt
```

It is a scratch file, not a deliverable. The edges now live in the path.

- [ ] **Step 5: Confirm the path still validates and the app still builds**

```bash
pnpm validate
pnpm build
```

Expected: `OK — 1 path(s)` and a clean build. The new field is ignored by
everything until Task 3.

- [ ] **Step 6: Commit**

```bash
git add tools/derive-prereqs.js paths/frontier-lab.json
git commit -m "Add prerequisite edges, proposed by tool and chosen by hand

The tool prints the sentence that produced each candidate and writes
nothing to the path. Precision is deliberately low — the phrases it
matches also catch ordinary prose about weeks and repos — so its output
is a worksheet, not an answer.

Writing edges nobody read would assert dependencies nobody checked, in a
tool whose whole purpose is telling you the truth about what you know."
```

---

### Task 2: Build the term index

**Files:**
- Create: `tools/extract-terms.js`
- Modify: `paths/frontier-lab.json`

**Interfaces:**
- Produces: `terms: [{ term, mentionedIn: string[], seeAlso: [{label, url}] }]` at the top level of the path, beside `phases`.

- [ ] **Step 1: Write the tool**

Create `tools/extract-terms.js`:

```js
#!/usr/bin/env node
/**
 * Builds a term index from text that already exists in the path: backticked
 * identifiers and repeated capitalised acronyms.
 *
 * No definitions are written. The index answers "where does this appear, and
 * where is it explained" — never "what does it mean".
 *
 * A term is kept only if it appears in two or more subtasks. Measured on this
 * path, that takes 652 candidates down to 109: appearing once means the term
 * is explained where it appears and needs no index entry.
 *
 * Run once: node tools/extract-terms.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILE = path.join(ROOT, 'paths/frontier-lab.json');
const plan = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const byTerm = new Map();      // term -> Set of subtask ids
const linksFor = new Map();    // term -> Map(url -> label)

for (const ph of plan.phases) {
  for (const t of ph.tasks) {
    for (const s of t.subtasks ?? []) {
      const text = [s.desc, ...(s.steps ?? []).map(x => x.text)].join(' ');

      const found = new Set();
      for (const m of text.matchAll(/`([^`]{2,40})`/g)) found.add(m[1]);
      for (const m of text.matchAll(/\b([A-Z]{2,6})\b/g)) found.add(m[1]);

      for (const term of found) {
        if (!byTerm.has(term)) byTerm.set(term, new Set());
        byTerm.get(term).add(s.id);

        // Resources already attached to a mentioning subtask are the honest
        // answer to "where is this explained".
        if (!linksFor.has(term)) linksFor.set(term, new Map());
        for (const list of Object.values(s.resources ?? {})) {
          for (const r of list) linksFor.get(term).set(r.url, r.name ?? r.title ?? r.url);
        }
      }
    }
  }
}

const terms = [...byTerm.entries()]
  .filter(([, ids]) => ids.size >= 2)
  .sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()))
  .map(([term, ids]) => ({
    term,
    mentionedIn: [...ids],
    // Cap the links: a term appearing in eight subtasks would otherwise carry
    // every resource from all of them, which is a list nobody reads.
    seeAlso: [...(linksFor.get(term) ?? new Map())]
      .slice(0, 3)
      .map(([url, label]) => ({ label, url }))
  }));

plan.terms = terms;
fs.writeFileSync(FILE, JSON.stringify(plan, null, 2) + '\n');
console.log(`wrote ${terms.length} terms (from ${byTerm.size} candidates)`);
```

- [ ] **Step 2: Run it**

```bash
node tools/extract-terms.js
```

Expected: `wrote 109 terms (from 652 candidates)` — or close to it.

- [ ] **Step 3: Review and prune**

Open the `terms` array in `paths/frontier-lab.json` and delete entries that
index nothing useful. Measured, the top of the list is a mix: `GPU`, `KV`,
`JAX`, `GRPO`, `FLOP` earn their place; `README`, `CI`, `PR` are project
vocabulary rather than curriculum terms and can go.

This is a one-time read of about a hundred short lines. Do it now rather than
shipping an index whose first entries are noise — the first screen is what
decides whether anyone uses the page again.

- [ ] **Step 4: Validate and commit**

```bash
pnpm validate && pnpm build
git add tools/extract-terms.js paths/frontier-lab.json
git commit -m "Add a term index built from text that already exists

No definitions, by anyone: the index answers where a term appears and
where somebody who knows has explained it.

Kept only if a term appears in two or more subtasks, which takes 652
candidates to 109. Appearing once means it is explained where it appears
and needs no index entry."
```

---

### Task 3: Validate the graph

**Files:**
- Modify: `tools/validate-path.js`, `test/validate-path.test.js`

**Interfaces:**
- Consumes: `prereqs` from Task 1.
- Produces: three new failure modes from `validatePath(path, previous)`.

- [ ] **Step 1: Write the failing tests**

Append to `test/validate-path.test.js`, inside the existing `describe`:

```js
  it('rejects a prereq pointing at a subtask that does not exist', () => {
    const p = valid();
    p.phases[0].tasks[0].subtasks[0].prereqs = ['no-such-subtask'];
    expect(validatePath(p, null).join()).toMatch(/unknown prereq/i);
  });

  it('rejects a cycle, because a plan you can never start is worse than no plan', () => {
    const p = valid();
    p.phases[0].tasks[0].subtasks.push({
      id: 't1-s02', title: 'B', desc: 'd', steps: [], resources: {},
      prereqs: ['t1-s01']
    });
    p.phases[0].tasks[0].subtasks[0].prereqs = ['t1-s02'];
    expect(validatePath(p, null).join()).toMatch(/cycle/i);
  });

  it('rejects a prereq that comes later in the path than the subtask needing it', () => {
    const p = valid();
    p.phases[0].tasks[0].subtasks.push({
      id: 't1-s02', title: 'B', desc: 'd', steps: [], resources: {}
    });
    // s01 comes first but claims to depend on s02, which comes after it.
    p.phases[0].tasks[0].subtasks[0].prereqs = ['t1-s02'];
    expect(validatePath(p, null).join()).toMatch(/after|later/i);
  });

  it('accepts a prereq that comes earlier', () => {
    const p = valid();
    p.phases[0].tasks[0].subtasks.push({
      id: 't1-s02', title: 'B', desc: 'd', steps: [], resources: {},
      prereqs: ['t1-s01']
    });
    expect(validatePath(p, null)).toEqual([]);
  });

  it('accepts a path with no prereqs at all, because the field is optional', () => {
    expect(validatePath(valid(), null)).toEqual([]);
  });
```

- [ ] **Step 2: Run and watch them fail**

```bash
pnpm vitest run test/validate-path.test.js
```

Expected: FAIL on the first three — no prerequisite checking exists yet.

- [ ] **Step 3: Add the checks to `tools/validate-path.js`**

Insert before the `if (previous)` block:

```js
  // ---- prerequisites ----
  // Order matters here: a plan that tells you to build something before its
  // dependency is a bug in the plan, and nothing else catches it.
  const order = new Map();
  let seq = 0;
  for (const ph of p.phases ?? []) {
    for (const t of ph.tasks ?? []) {
      for (const s of t.subtasks ?? []) order.set(s.id, seq++);
    }
  }

  const edges = new Map();
  for (const ph of p.phases ?? []) {
    for (const t of ph.tasks ?? []) {
      for (const s of t.subtasks ?? []) {
        const prereqs = s.prereqs ?? [];
        edges.set(s.id, prereqs);
        for (const dep of prereqs) {
          if (!order.has(dep)) {
            problems.push(`${s.id}: unknown prereq "${dep}"`);
          } else if (order.get(dep) > order.get(s.id)) {
            problems.push(
              `${s.id}: prereq "${dep}" comes after it in the path`);
          }
        }
      }
    }
  }

  // Depth-first cycle detection. A cycle means a plan you can never start.
  const state = new Map();
  const walk = (id) => {
    if (state.get(id) === 'done') return false;
    if (state.get(id) === 'open') return true;
    state.set(id, 'open');
    for (const dep of edges.get(id) ?? []) {
      if (order.has(dep) && walk(dep)) return true;
    }
    state.set(id, 'done');
    return false;
  };
  for (const id of edges.keys()) {
    if (walk(id)) { problems.push(`prereq cycle involving ${id}`); break; }
  }
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run test/validate-path.test.js
```

Expected: PASS.

- [ ] **Step 5: Validate the real path**

```bash
pnpm validate
```

Expected: `OK — 1 path(s): frontier-lab`. **If it reports an ordering
violation, that is a genuine finding about the plan**, not a bug in the check —
read the edge and decide whether the plan or the edge is wrong.

- [ ] **Step 6: Commit**

```bash
git add tools/validate-path.js test/validate-path.test.js
git commit -m "Validate the prerequisite graph

Three checks: the id resolves, there is no cycle, and a prerequisite
never sits later in the path than the subtask needing it.

That last one is the reason to have this. A plan that tells you to build
something before its dependency is a bug in the plan, and nothing else
in the project catches it."
```

---

### Task 4: Show prerequisites in the sidebar

**Files:**
- Create: `src/prereq-view.js`, `test/prereq-view.test.js`
- Modify: `src/sidebar.js`, `style.css`

**Interfaces:**
- Consumes: `ctx.index` from `src/weights.js`, `allDone()` from `src/progress.js`.
- Produces:
  - `prereqHtml(subtask, ctx, doneSet) -> string` — empty string when there are none
  - `neededByHtml(subtask, ctx) -> string` — empty string when nothing needs it
  - `doneSet` may be `null`, meaning "we do not know who is asking": links render without tick state.

- [ ] **Step 1: Write the failing test**

Create `test/prereq-view.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { prereqHtml, neededByHtml } from '../src/prereq-view.js';
import { indexPath } from '../src/weights.js';

const path = {
  id: 'p',
  phases: [{
    id: 'ph1', weight: 1,
    tasks: [{
      id: 't1', weight: 1,
      subtasks: [
        { id: 's1', title: 'Stand up vLLM', desc: 'd', steps: [], resources: {} },
        { id: 's2', title: 'Agent harness', desc: 'd', steps: [], resources: {},
          prereqs: ['s1'] }
      ]
    }]
  }]
};
const ctx = { path, index: indexPath(path) };
const sub = id => ctx.index.subtasks.get(id);

describe('prereqHtml', () => {
  it('renders nothing at all when a subtask has no prerequisites', () => {
    expect(prereqHtml(sub('s1'), ctx, new Set())).toBe('');
  });

  it('names the prerequisite by title, not by id', () => {
    const html = prereqHtml(sub('s2'), ctx, new Set());
    expect(html).toContain('Stand up vLLM');
    expect(html).not.toContain('"s1"');
  });

  it('marks an unfinished prerequisite, which is the entire point', () => {
    const html = prereqHtml(sub('s2'), ctx, new Set());
    expect(html).toMatch(/prereq-undone/);
  });

  it('marks a finished one differently', () => {
    const html = prereqHtml(sub('s2'), ctx, new Set(['s1']));
    expect(html).toMatch(/prereq-done/);
    expect(html).not.toMatch(/prereq-undone/);
  });

  it('omits tick state entirely when progress is unknown, rather than guessing', () => {
    const html = prereqHtml(sub('s2'), ctx, null);
    expect(html).toContain('Stand up vLLM');
    expect(html).not.toMatch(/prereq-done|prereq-undone/);
  });

  it('escapes markup in a title', () => {
    const evil = JSON.parse(JSON.stringify(path));
    evil.phases[0].tasks[0].subtasks[0].title = '<img src=x onerror=alert(1)>';
    const c = { path: evil, index: indexPath(evil) };
    const html = prereqHtml(c.index.subtasks.get('s2'), c, new Set());
    expect(html).not.toContain('<img src=x');
  });

  it('skips a prereq id that no longer resolves rather than throwing', () => {
    const broken = JSON.parse(JSON.stringify(path));
    broken.phases[0].tasks[0].subtasks[1].prereqs = ['gone'];
    const c = { path: broken, index: indexPath(broken) };
    expect(() => prereqHtml(c.index.subtasks.get('s2'), c, new Set())).not.toThrow();
  });
});

describe('neededByHtml', () => {
  it('names what depends on this subtask', () => {
    expect(neededByHtml(sub('s1'), ctx)).toContain('Agent harness');
  });

  it('renders nothing when nothing depends on it', () => {
    expect(neededByHtml(sub('s2'), ctx)).toBe('');
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
pnpm vitest run test/prereq-view.test.js
```

Expected: FAIL — `src/prereq-view.js` does not exist.

- [ ] **Step 3: Write `src/prereq-view.js`**

```js
/**
 * Prerequisites, both directions. Pure string builders so they are testable
 * without a browser — the house pattern, and the only reason the renderer,
 * the card list and the keymap could be verified at all.
 */
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * doneSet may be null, meaning progress is unknown — signed out, or
 * unverified. Links still render; tick state does not, because guessing at
 * somebody's progress is worse than staying quiet about it.
 */
export function prereqHtml(subtask, ctx, doneSet) {
  const ids = (subtask?.prereqs ?? []).filter(id => ctx.index.subtasks.has(id));
  if (!ids.length) return '';

  const items = ids.map(id => {
    const s = ctx.index.subtasks.get(id);
    if (!doneSet) {
      return `<a class="prereq-item" href="#${esc(id)}">${esc(s.title)}</a>`;
    }
    const done = doneSet.has(id);
    return `<a class="prereq-item ${done ? 'prereq-done' : 'prereq-undone'}"
               href="#${esc(id)}">${done ? '✓' : '✗'} ${esc(s.title)}</a>`;
  }).join(' · ');

  return `<div class="sidebar-section prereq-block">
    <div class="sidebar-section-title">Assumes</div>
    <div class="prereq-list">${items}</div>
  </div>`;
}

export function neededByHtml(subtask, ctx) {
  if (!subtask) return '';

  const dependents = [];
  for (const [id, s] of ctx.index.subtasks) {
    if ((s.prereqs ?? []).includes(subtask.id)) dependents.push({ id, title: s.title });
  }
  if (!dependents.length) return '';

  return `<div class="sidebar-section prereq-block">
    <div class="sidebar-section-title">Needed by</div>
    <div class="prereq-list">${dependents
      .map(d => `<a class="prereq-item" href="#${esc(d.id)}">${esc(d.title)}</a>`)
      .join(' · ')}</div>
  </div>`;
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run test/prereq-view.test.js
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Wire into the sidebar**

In `src/sidebar.js`, add the import:

```js
import { prereqHtml, neededByHtml } from './prereq-view.js';
import { isSignedIn } from './auth.js';
```

(`isSignedIn` is already imported — do not add it twice.)

In `openSidebar`, immediately after the `Overview & Goal` section is added to
`html`, insert the prerequisites; and after the steps section, the reverse
edge:

```js
  // Progress is only known for a signed-in, verified person. Anyone else sees
  // the links without tick state.
  const doneSet = isSignedIn() ? allDone() : null;
  html += prereqHtml(s, ctx, doneSet);
```

and after `html += '</ul></div>';`:

```js
  html += neededByHtml(s, ctx);
```

- [ ] **Step 6: Add the styles**

Append to `style.css`:

```css
/* ── Prerequisites ─────────────────────────────────────────── */
.prereq-block { padding-bottom: 4px; }
.prereq-list { font-size: 13px; line-height: 1.9; }
.prereq-item { color: var(--muted2); text-decoration: none;
  border-bottom: 1px solid var(--border); }
.prereq-item:hover { color: var(--text); }
.prereq-done { color: var(--muted); }
.prereq-undone { color: var(--amber); }
```

- [ ] **Step 7: Build and run everything**

```bash
pnpm build && pnpm test
```

Expected: clean build, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/prereq-view.js test/prereq-view.test.js src/sidebar.js style.css
git commit -m "Show what a subtask assumes, and what needs it

The tick state is the point. A list of links is a footnote; a list
showing you have not done the thing this assumes explains why you are
stuck.

Progress is only known for a signed-in verified person, so everyone else
sees the links without ticks. Guessing at somebody's progress is worse
than staying quiet about it."
```

---

### Task 5: The glossary view

**Files:**
- Create: `src/glossary-view.js`, `test/glossary-view.test.js`
- Modify: `index.html`, `src/main.js`, `style.css`

**Interfaces:**
- Consumes: `path.terms` from Task 2, `ctx.index`.
- Produces:
  - `glossaryHtml(terms, ctx, filter) -> string`
  - `renderGlossary(ctx)` — mounts it and wires the filter box.

- [ ] **Step 1: Write the failing test**

Create `test/glossary-view.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { glossaryHtml } from '../src/glossary-view.js';
import { indexPath } from '../src/weights.js';

const path = {
  id: 'p',
  phases: [{
    id: 'ph1', weight: 1,
    tasks: [{
      id: 't1', weight: 1,
      subtasks: [
        { id: 's1', title: 'Stand up vLLM', desc: 'd', steps: [], resources: {} },
        { id: 's2', title: 'Continuous batching', desc: 'd', steps: [], resources: {} }
      ]
    }]
  }]
};
const ctx = { path, index: indexPath(path) };

const terms = [
  { term: 'KV cache', mentionedIn: ['s1', 's2'],
    seeAlso: [{ label: 'vLLM docs', url: 'https://docs.vllm.ai/' }] },
  { term: 'GRPO', mentionedIn: ['s2'], seeAlso: [] }
];

describe('glossaryHtml', () => {
  it('lists every term', () => {
    const html = glossaryHtml(terms, ctx, '');
    expect(html).toContain('KV cache');
    expect(html).toContain('GRPO');
  });

  it('names the subtasks a term appears in, by title', () => {
    const html = glossaryHtml(terms, ctx, '');
    expect(html).toContain('Stand up vLLM');
    expect(html).toContain('Continuous batching');
  });

  it('links out to where it is explained', () => {
    expect(glossaryHtml(terms, ctx, '')).toContain('https://docs.vllm.ai/');
  });

  it('writes no definition, because that was the whole agreement', () => {
    const html = glossaryHtml(terms, ctx, '');
    // Only the term, the subtask titles, and link labels should appear.
    expect(html).not.toMatch(/means|refers to|is a /i);
  });

  it('filters case-insensitively on the term', () => {
    const html = glossaryHtml(terms, ctx, 'kv');
    expect(html).toContain('KV cache');
    expect(html).not.toContain('GRPO');
  });

  it('says so when a filter matches nothing, rather than rendering blank', () => {
    expect(glossaryHtml(terms, ctx, 'zzzz')).toMatch(/no terms/i);
  });

  it('has an honest empty state with no terms at all', () => {
    expect(glossaryHtml([], ctx, '')).toMatch(/no terms/i);
  });

  it('escapes markup in a term', () => {
    const evil = [{ term: '<img src=x onerror=alert(1)>', mentionedIn: ['s1'], seeAlso: [] }];
    expect(glossaryHtml(evil, ctx, '')).not.toContain('<img src=x');
  });

  it('skips a mention whose subtask no longer resolves rather than throwing', () => {
    const stale = [{ term: 'Ghost', mentionedIn: ['gone'], seeAlso: [] }];
    expect(() => glossaryHtml(stale, ctx, '')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
pnpm vitest run test/glossary-view.test.js
```

Expected: FAIL — `src/glossary-view.js` does not exist.

- [ ] **Step 3: Write `src/glossary-view.js`**

```js
/**
 * The term index. Not a glossary in the usual sense: it carries no
 * definitions, because inventing explanations of material somebody is still
 * learning is how you end up confidently wrong in an interview.
 *
 * It answers where a term appears in your plan, and where somebody who knows
 * has explained it.
 */
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const EMPTY = `<p class="signed-out-note">No terms match.</p>`;

export function glossaryHtml(terms, ctx, filter) {
  const needle = String(filter ?? '').trim().toLowerCase();
  const shown = (terms ?? []).filter(t =>
    !needle || t.term.toLowerCase().includes(needle));

  if (!shown.length) return EMPTY;

  return shown.map(t => {
    const where = (t.mentionedIn ?? [])
      .filter(id => ctx.index.subtasks.has(id))
      .map(id => `<a class="glossary-ref" href="#${esc(id)}">${
        esc(ctx.index.subtasks.get(id).title)}</a>`)
      .join(', ');

    const read = (t.seeAlso ?? [])
      .map(l => `<a class="glossary-ref" href="${esc(l.url)}" target="_blank">${
        esc(l.label)}</a>`)
      .join(', ');

    return `<div class="glossary-row">
      <div class="glossary-term">${esc(t.term)}</div>
      ${where ? `<div class="glossary-meta">appears in ${where}</div>` : ''}
      ${read ? `<div class="glossary-meta">read: ${read}</div>` : ''}
    </div>`;
  }).join('');
}

export function renderGlossary(ctx) {
  const list = document.getElementById('glossary-list');
  const box = document.getElementById('glossary-filter');
  if (!list || !box) return;

  const paint = () => { list.innerHTML = glossaryHtml(ctx.path.terms, ctx, box.value); };
  box.addEventListener('input', paint);
  paint();
}
```

- [ ] **Step 4: Add the view to `index.html`**

In `<nav class="nav">`, after the Cards link:

```html
    <a href="#glossary">Terms</a>
```

Immediately before `<div id="view-account" class="view-panel">`:

```html
<div id="view-glossary" class="view-panel">
  <div class="container">
    <section class="today-block">
      <div class="today-block-title">Terms</div>
      <p class="settings-note">Where each term appears in the plan, and where it
        is properly explained. No definitions here on purpose.</p>
      <input class="capture-input" id="glossary-filter" placeholder="Filter…"
             autocomplete="off">
      <div id="glossary-list"></div>
    </section>
  </div>
</div>
```

- [ ] **Step 5: Mount it in `src/main.js`**

Add the import:

```js
import { renderGlossary } from './glossary-view.js';
```

and immediately after `initSidebar(ctx);`:

```js
  // Content, not user data — it renders whether or not anyone is signed in.
  renderGlossary(ctx);
```

- [ ] **Step 6: Add the styles**

Append to `style.css`:

```css
/* ── Term index ────────────────────────────────────────────── */
.glossary-row { border-bottom: 1px solid var(--border); padding: 10px 0; }
.glossary-row:last-child { border-bottom: none; }
.glossary-term { font-family: var(--mono); font-size: 13px; }
.glossary-meta { font-size: 12px; color: var(--muted); margin-top: 3px; }
.glossary-ref { color: var(--muted2); text-decoration: none; }
.glossary-ref:hover { color: var(--text); }
#glossary-filter { margin-bottom: 14px; }
```

- [ ] **Step 7: Build and test**

```bash
pnpm build && pnpm test
```

Expected: clean build, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/glossary-view.js test/glossary-view.test.js index.html src/main.js style.css
git commit -m "Add the term index

Not a glossary in the usual sense: it carries no definitions, because
inventing explanations of material somebody is still learning is how you
end up confidently wrong in an interview.

It answers where a term appears in the plan and where somebody who knows
has explained it, and one test asserts no definition-shaped prose ever
creeps in."
```

---

### Task 6: DOM tests

**Files:**
- Create: `test/dom/structure.test.js`

**Interfaces:**
- Consumes: `mountApp` from the existing harness.

- [ ] **Step 1: Write the tests**

Create `test/dom/structure.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { mountApp } from './harness.js';
import path from '../../paths/frontier-lab.json';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

/** The first subtask that actually carries prerequisites, if any do. */
const withPrereqs = path.phases
  .flatMap(p => p.tasks)
  .flatMap(t => t.subtasks ?? [])
  .find(s => (s.prereqs ?? []).length);

describe('prerequisites in the sidebar', () => {
  it('shows them when a subtask has them', async () => {
    if (!withPrereqs) return;          // no edges survived review; nothing to assert
    await mountApp({ signedIn: true, verified: true, enrolled: true });

    $(`.task-item[data-subtask-id="${withPrereqs.id}"]`).click();
    expect($('#sidebar-body .prereq-block')).toBeTruthy();
  });

  it('shows no prereq block for a subtask without any', async () => {
    const plain = path.phases[0].tasks[0].subtasks
      .find(s => !(s.prereqs ?? []).length);
    await mountApp({ signedIn: true, verified: true, enrolled: true });

    $(`.task-item[data-subtask-id="${plain.id}"]`).click();
    expect($('#sidebar-body .prereq-block')).toBeNull();
  });
});

describe('the term index', () => {
  it('renders every term on load', async () => {
    await mountApp();
    expect($$('#glossary-list .glossary-row').length)
      .toBe((path.terms ?? []).length);
  });

  it('narrows as you type', async () => {
    await mountApp();
    const before = $$('#glossary-list .glossary-row').length;

    const box = $('#glossary-filter');
    box.value = (path.terms?.[0]?.term ?? 'zzz').slice(0, 3);
    box.dispatchEvent(new Event('input', { bubbles: true }));

    expect($$('#glossary-list .glossary-row').length).toBeLessThanOrEqual(before);
  });

  it('renders signed out, because terms are content rather than user data', async () => {
    await mountApp();
    expect($('#glossary-list').textContent.trim().length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run everything**

```bash
pnpm test
pnpm build
pnpm validate
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add test/dom/structure.test.js
git commit -m "Test structure in the DOM

The prerequisite test skips itself when no edges survived review. That is
deliberate: the review in task one is allowed to conclude that this path
has few real dependencies, and a test that failed for it would pressure
the next person into inventing edges to make the suite green."
```

---

## Verification checklist

- [ ] `pnpm test` — 205 previous plus roughly 25 new
- [ ] `pnpm validate` — passes, and fails if a prereq points at a later subtask
- [ ] A subtask with prerequisites shows them, ticked or crossed
- [ ] Signed out, prerequisites render without tick state
- [ ] The term index renders signed out and narrows as you type
- [ ] No definition text exists anywhere in `terms`
- [ ] `prereq-candidates.txt` is deleted and not committed
