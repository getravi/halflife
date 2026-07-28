#!/usr/bin/env node
/**
 * exercises/<id>.py  ->  exercises/<id>.ipynb
 *
 * Notebooks are JSON holding arrays of escaped source lines: unreadable in a
 * diff and unpleasant to edit by hand. The real source is percent-format
 * Python — a normal file you can run, lint and review.
 *
 * Run after editing a source: node tools/build-notebooks.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'exercises');

const cellsOf = (text) => text
  .split(/^# %%/m)
  .map(chunk => chunk.trim())
  .filter(Boolean)
  .map(chunk => {
    const markdown = chunk.startsWith('[markdown]');
    const body = markdown ? chunk.slice('[markdown]'.length).trim() : chunk;
    // Jupyter stores source as lines that keep their newline, except the last.
    const source = (markdown ? body.replace(/^# ?/gm, '') : body)
      .split('\n').map((l, i, a) => (i === a.length - 1 ? l : l + '\n'));

    return markdown
      ? { cell_type: 'markdown', metadata: {}, source }
      : { cell_type: 'code', metadata: {}, source, outputs: [], execution_count: null };
  });

let built = 0;
for (const file of fs.readdirSync(DIR).filter(f => f.endsWith('.py'))) {
  const nb = {
    cells: cellsOf(fs.readFileSync(path.join(DIR, file), 'utf8')),
    metadata: {
      kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
      language_info: { name: 'python' }
    },
    nbformat: 4,
    nbformat_minor: 5
  };
  fs.writeFileSync(
    path.join(DIR, file.replace(/\.py$/, '.ipynb')),
    JSON.stringify(nb, null, 1) + '\n');
  built++;
}

console.log(`built ${built} notebooks`);
