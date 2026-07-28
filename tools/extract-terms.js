#!/usr/bin/env node
/**
 * Builds a term index from text that already exists in the path: backticked
 * identifiers and repeated capitalised acronyms.
 *
 * No definitions are written. The index answers "where does this appear, and
 * where is it explained" — never "what does it mean".
 *
 * A term is kept only if it appears in two or more subtasks. Measured on this
 * path, that takes 652 candidates down to about 109: appearing once means the
 * term is explained where it appears and needs no index entry.
 *
 * Run once: node tools/extract-terms.js
 *
 * It writes all surviving candidates, and the committed index is the pruned
 * result of reading them — 106 down to 35 on 2026-07-27. Re-running restores
 * the other 71, so whoever adds content and re-runs it has to prune again.
 * That is the same bargain tools/convert-path.js makes, and it is preferable
 * to a stop-list baked in here, which would silently swallow every new term.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILE = path.join(ROOT, 'paths/frontier-lab.json');
const plan = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const byTerm = new Map();      // term -> Map(subtask id -> mention count)
const resourcesOf = new Map(); // subtask id -> [{label, url}]

for (const ph of plan.phases) {
  for (const t of ph.tasks) {
    for (const s of t.subtasks ?? []) {
      const text = [s.desc, ...(s.steps ?? []).map(x => x.text)].join(' ');

      resourcesOf.set(s.id, Object.values(s.resources ?? {}).flat()
        .map(r => ({ label: r.name ?? r.title ?? r.url, url: r.url })));

      // `a` and `b` makes the closing backtick of one term the opening one of
      // the next, so the run of prose between them matches too. A candidate
      // that is untrimmed or has no letter in it came from that gap.
      const real = c => c === c.trim() && /[A-Za-z]/.test(c);

      const found = new Set();
      for (const m of text.matchAll(/`([^`]{2,40})`/g)) if (real(m[1])) found.add(m[1]);
      for (const m of text.matchAll(/\b([A-Z]{2,6})\b/g)) found.add(m[1]);

      for (const term of found) {
        if (!byTerm.has(term)) byTerm.set(term, new Map());
        const escaped = term.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
        byTerm.get(term).set(s.id, (text.match(new RegExp(escaped, 'g')) ?? []).length);
      }
    }
  }
}

const terms = [...byTerm.entries()]
  .filter(([, counts]) => counts.size >= 2)
  .sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()))
  .map(([term, counts]) => {
    // Links come from the subtask that says the term most often, not the one
    // that says it first. The earliest mention of "GPU" is a subtask about ssh
    // hygiene, and it would have sent every reader to a tmux cheat sheet. The
    // densest mention is the subtask actually about the thing.
    const [home] = [...counts].sort((a, b) => b[1] - a[1])[0];
    return {
      term,
      mentionedIn: [...counts.keys()],
      seeAlso: (resourcesOf.get(home) ?? []).slice(0, 3)
    };
  });

plan.terms = terms;
fs.writeFileSync(FILE, JSON.stringify(plan, null, 2) + '\n');
console.log(`wrote ${terms.length} terms (from ${byTerm.size} candidates)`);
