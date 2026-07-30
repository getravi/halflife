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
import { execFileSync } from 'node:child_process';
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

  if (!p.tagline) problems.push('no tagline — the homepage card would be blank');

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
      if (t.weeks && lo !== undefined) {
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
    // The gate hangs off this id. If it does not exist the exercise gates
    // nothing at all, and the whole feature is decoration that reads as
    // working.
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

/**
 * The catalogue entry a path's homepage card renders from. Derived here so
 * the card never has to fetch the full path, and so the numbers can never
 * drift from the content that produced them.
 */
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

export function emit(paths, outDir) {
  // Clear first. Hashed filenames mean every content edit leaves its
  // predecessor behind, and the directory would grow without bound. The
  // catalogue is served no-cache, so no client is left pointing at one.
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const catalogue = { paths: [] };

  for (const p of paths) {
    const body = JSON.stringify(p);
    const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 8);
    const file = `${p.id}-${hash}.json`;
    fs.writeFileSync(path.join(outDir, file), body);
    catalogue.paths.push(catalogueEntry(p, file));
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
      previous = JSON.parse(
        execFileSync('git', ['show', `HEAD:paths/${f}`], {
          encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
        })
      );
    } catch {
      // First commit of this path — nothing to diff against.
    }

    const problems = validatePath(p, previous);
    if (problems.length) failures.push([f, problems]);
    loaded.push(p);
  }

  // Exercises are optional: a path with none is valid, and a fresh clone that
  // has not written any must still validate.
  const exFile = path.join(ROOT, 'exercises', 'index.json');
  if (fs.existsSync(exFile)) {
    const exercises = JSON.parse(fs.readFileSync(exFile, 'utf8'));
    const byPath = new Map(loaded.map(p => [p.id, p]));

    for (const [id, e] of Object.entries(exercises)) {
      const target = byPath.get(e.pathId);
      if (!target) {
        failures.push(['exercises/index.json', [`${id}: no such path "${e.pathId}"`]]);
        continue;
      }
      const problems = validateExercises(target, { [id]: e });
      if (problems.length) failures.push(['exercises/index.json', problems]);
    }
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
