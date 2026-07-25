#!/usr/bin/env node
/**
 * Invariant checker. Run before committing: `make check`.
 *
 * The three files must agree exactly. index.html holds the subtask titles;
 * app.js weights and resources_db.js entries are keyed by those titles, and
 * saved progress keys embed them too. Rename a title by hand and the sidebar
 * goes blank while the progress bar quietly stops counting that subtask — with
 * no error anywhere. This catches that.
 *
 * Checks:
 *   1. index.html <-> app.js ALL_PHASES task lists match
 *   2. every subtask has a weight and a resources_db entry
 *   3. no orphan step weights (weights pointing at steps that no longer exist)
 *   4. week labels sit inside their phase range and never run backwards
 *   5. every id/attribute app.js binds to exists in the HTML
 *   6. no double-escaped entities in rendered text
 *   7. every card points at a subtask that still exists
 *
 * Exits non-zero on any failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fail = [];

// ---- load ----
const htmlSrc = read('index.html');
const appSrc = read('app.js');
// resources_db.js is an ES module now, so it is imported rather than executed
// against a faked global. Cache-bust so a rebuild inside one process is seen.
const { RESOURCES_DB: db } = await import(
  'file://' + path.join(ROOT, 'resources_db.js') + '?t=' + fs.statSync(path.join(ROOT, 'resources_db.js')).mtimeMs
);

// evaluate the two registries as expressions rather than declarations, so this
// file's own scope stays clean
const literal = name => {
  const m = appSrc.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`));
  if (!m) throw new Error(`could not find ${name} in app.js`);
  return eval('(' + m[1] + ')');
};
const ALL_PHASES = literal('ALL_PHASES');
const STATIC_WEIGHTS = literal('STATIC_WEIGHTS');

const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                     .replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const order = [], tree = {};
for (const m of htmlSrc.matchAll(/<div class="day-section" id="sec-([a-z0-9-]+)">([\s\S]*?)(?=<div class="day-section"|<!-- |$)/g)) {
  order.push(m[1]);
  tree[m[1]] = [...m[2].matchAll(/<div class="task-item-title">([\s\S]*?)<\/div>/g)]
    .map(x => decode(x[1].replace(/\s+/g, ' ').trim()));
}

// ---- 1. task lists agree ----
const appTasks = Object.values(ALL_PHASES).flatMap(p => p.tasks);
for (const t of appTasks) if (!order.includes(t)) fail.push(`app.js lists task "${t}" which is not in index.html`);
for (const t of order) if (!appTasks.includes(t)) fail.push(`index.html has task "${t}" which app.js does not list`);

// ---- 2. weights + resource entries exist ----
let subtaskCount = 0;
for (const ph of Object.keys(ALL_PHASES)) {
  const page = ALL_PHASES[ph].page;
  for (const t of ALL_PHASES[ph].tasks) {
    if (STATIC_WEIGHTS.tasks[t] === undefined) fail.push(`no task weight for "${t}"`);
    for (const sub of (tree[t] || [])) {
      subtaskCount++;
      const key = `${page}::${t}::${sub}`;
      if (STATIC_WEIGHTS.subtasks[key] === undefined) fail.push(`no subtask weight: ${key}`);
      if (!db[page]?.[t]?.[sub]) fail.push(`no resources_db entry: ${key}`);
    }
  }
}

// ---- 3. no orphan step weights ----
let stepCount = 0;
for (const k of Object.keys(STATIC_WEIGHTS.steps || {})) {
  const m = k.match(/^(.*?)::(.*?)::(.*)::(\d+)$/);
  const steps = m && db[m[1]]?.[m[2]]?.[m[3]]?.steps;
  if (!steps || steps[+m[4]] === undefined) fail.push(`orphan step weight: ${k}`);
  else stepCount++;
}

// ---- 4. week sanity ----
let prev = 0;
for (const pm of htmlSrc.matchAll(/<div id="view-(phase\d)" class="view-panel">([\s\S]*?)(?=<div id="view-|<script)/g)) {
  const panel = pm[2];
  const eb = panel.match(/page-hero-eyebrow">(.*?)<\/div>/);
  const rng = eb && decode(eb[1]).match(/Weeks?\s+(\d+)[–-](\d+)/);
  if (!rng) continue;
  const [lo, hi] = [+rng[1], +rng[2]];
  for (const tm of panel.matchAll(/<div class="task-item-time">(.*?)<\/div>/g)) {
    const nums = [...tm[1].matchAll(/\d+/g)].map(Number);
    if (!nums.length) continue;
    const [a, b] = [nums[0], nums[nums.length - 1]];
    if (a < lo || b > hi) fail.push(`${pm[1]}: "${tm[1]}" outside phase range ${lo}-${hi}`);
    if (a < prev) fail.push(`${pm[1]}: "${tm[1]}" starts before an earlier item (week ${prev})`);
    prev = Math.max(prev, a);
  }
}

// ---- 5. app.js DOM hooks ----
const hooks = ['global-bar-fill', 'global-done', 'global-total', 'global-pct',
               'global-done-2', 'global-pct-2', 'phases-started', 'streak-weeks',
               'view-today', 'today-due-count', 'today-due-noun', 'today-start-review',
               'today-week', 'today-debt', 'today-offline',
               'runner', 'runner-prompt', 'runner-recall', 'runner-answer',
               'runner-reveal', 'runner-grades', 'runner-remaining', 'runner-close',
               'today-covered', 'today-retained', 'today-retention-pressure'];
for (const h of hooks) if (!htmlSrc.includes(`id="${h}"`)) fail.push(`missing DOM hook id="${h}"`);
for (const s of ['p0', 'p1', 'p2', 'p3', 'p4'])
  for (const a of [`id="progress-bar-${s}"`, `id="progress-label-${s}"`,
                   `data-phase-count="${s}"`, `data-phase-fill="${s}"`])
    if (!htmlSrc.includes(a)) fail.push(`missing DOM hook ${a}`);

// ---- 6. escaping ----
if (htmlSrc.includes('&amp;amp;')) fail.push('double-escaped entity (&amp;amp;) in index.html');

// ---- 7. cards resolve to real subtasks ----
// Cards are keyed by subtask title, the same load-bearing string as everything
// else. A renamed title would otherwise orphan a hand-written card silently.
let cardCount = 0;
const cardsPath = path.join(ROOT, 'data', 'cards.json');
if (fs.existsSync(cardsPath)) {
  let cards;
  try {
    cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
  } catch (e) {
    fail.push(`data/cards.json is not valid JSON: ${e.message}`);
    cards = [];
  }
  for (const c of cards) {
    cardCount++;
    const phaseId = Object.keys(ALL_PHASES).find(ph => ALL_PHASES[ph].page === c.page);
    if (!phaseId || !ALL_PHASES[phaseId].tasks.includes(c.taskId)) {
      fail.push(`card ${c.id} points at unknown task ${c.page}::${c.taskId}`);
    } else if (!(tree[c.taskId] || []).includes(c.subtaskTitle)) {
      fail.push(`card ${c.id} points at unknown subtask "${c.subtaskTitle}" in ${c.taskId}`);
    }
  }
}

// ---- report ----
if (fail.length) {
  console.error(`FAIL — ${fail.length} problem(s):`);
  fail.slice(0, 40).forEach(f => console.error('  ' + f));
  if (fail.length > 40) console.error(`  ...and ${fail.length - 40} more`);
  process.exit(1);
}
console.log(`OK — ${appTasks.length} tasks, ${subtaskCount} subtasks, ${stepCount} step weights, ${cardCount} cards; index.html == app.js == resources_db.js`);
