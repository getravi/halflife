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
