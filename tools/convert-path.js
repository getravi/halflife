#!/usr/bin/env node
/**
 * One-shot conversion: the generated panel/resource split becomes one path
 * file with stable ids. Run once, commit the output, then delete this file.
 *
 * Subtask ids are positional rather than slugified from titles. Slugs would
 * be prettier and would change the moment a title is edited, which is the
 * entire failure mode this migration exists to end.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const weights = read('data/weights.json');

const panels = fs.readdirSync(path.join(ROOT, 'data/panels'))
  .filter(f => f.startsWith('panel_p'))
  .sort()
  .flatMap(f => {
    const d = read(`data/panels/${f}`);
    return d.phases ?? d;
  });

const resources = {};
for (const f of fs.readdirSync(path.join(ROOT, 'data/resources'))) {
  Object.assign(resources, read(`data/resources/${f}`));
}

const decode = s => String(s ?? '')
  .replace(/<br\s*\/?>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

const weeksOf = label => {
  const n = String(label ?? '').match(/\d+/g)?.map(Number) ?? [];
  return n.length ? [n[0], n[n.length - 1]] : null;
};

const KINDS = ['docs', 'courses', 'videos', 'papers', 'lectures', 'podcasts'];
const pad = n => String(n).padStart(2, '0');

const phases = panels.sort((a, b) => a.id.localeCompare(b.id)).map(ph => {
  const short = 'p' + ph.id.slice(-1);
  const page = `${ph.id}.html`;

  const tasks = ph.tasks.map(t => {
    const entry = resources[page]?.[t.id] ?? {};

    const subtasks = t.items.map((item, i) => {
      const title = decode(item.title);
      const body = entry[title] ?? {};
      const id = `${t.id}-s${pad(i + 1)}`;

      const res = {};
      for (const k of KINDS) if (body[k]?.length) res[k] = body[k];
      // The panel carries a single inline resource link the resource db does not.
      if (item.resource?.url) {
        (res.docs = res.docs ?? []).push({
          name: decode(item.resource.label), url: item.resource.url
        });
      }

      return {
        id,
        title,
        desc: body.desc ?? decode(item.desc),
        time: decode(item.time),
        steps: (body.steps ?? []).map((text, j) => ({
          id: `${id}-${pad(j + 1)}`, text
        })),
        resources: res
      };
    });

    return {
      id: t.id,
      title: decode(t.title),
      badge: decode(t.badge),
      tag: t.tag ?? null,
      weeks: weeksOf(t.items.map(i => i.time).join(' ')),
      weight: weights.tasks[t.id] ?? 1,
      subtasks
    };
  });

  // Milestones sit beside tasks in the panel, not inside them, and they carry
  // no subtasks — they are ticked by their own id. Dropping them silently is
  // exactly what the task-count assertion exists to catch.
  if (ph.milestone) {
    const m = ph.milestone;
    tasks.push({
      id: m.id,
      title: decode(m.title),
      badge: decode(m.badge),
      tag: 'milestone',
      // Deliberately no weeks. A milestone is the phase's closing summary
      // rather than work scheduled at a point in time, and giving it the whole
      // phase range makes it read as starting before the tasks it follows.
      weeks: null,
      weight: weights.tasks[m.id] ?? 1,
      subtasks: [],
      milestone: {
        heading: decode(m.heading),
        items: (m.items ?? []).map(decode),
        next: decode(m.next)
      }
    });
  }

  return {
    id: short,
    title: decode(ph.title),
    num: decode(ph.num),
    weeks: weeksOf(ph.weeks),
    weight: weights.phases[short] ?? 1,
    intro: decode(ph.intro),
    callouts: ph.callouts ?? [],
    tasks
  };
});

const out = { id: 'frontier-lab', title: 'Frontier Lab Learning Plan', phases };

fs.mkdirSync(path.join(ROOT, 'paths'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'paths/frontier-lab.json'),
                 JSON.stringify(out, null, 2) + '\n');

const counts = phases.reduce((a, p) => {
  a.tasks += p.tasks.length;
  for (const t of p.tasks) {
    a.subtasks += t.subtasks.length;
    for (const s of t.subtasks) a.steps += s.steps.length;
  }
  return a;
}, { tasks: 0, subtasks: 0, steps: 0 });

console.log(`converted: ${phases.length} phases, ${counts.tasks} tasks, `
          + `${counts.subtasks} subtasks, ${counts.steps} steps`);
