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
