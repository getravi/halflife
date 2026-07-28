/**
 * Renders an export as a readable study document. Pure: it takes the export
 * object and the loaded path and returns a string, so it is testable without a
 * browser — the same split as cardsHtml and render-path.js.
 *
 * Nothing is escaped. This is Markdown, not HTML, and prompts in this
 * curriculum are full of backticks discussing `vllm serve` and
 * `--max-num-seqs`. Escaping them would mangle the very thing the file exists
 * to preserve.
 */
import { indexPath } from './weights.js';

const day = ms => new Date(ms).toISOString().slice(0, 10);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function buildMarkdown(data, path) {
  const index = indexPath(path);

  const bySubtask = new Map();
  for (const c of data.cards ?? []) {
    if (!index.subtasks.has(c.subtask_id)) continue;   // stale id, skip
    if (!bySubtask.has(c.subtask_id)) bySubtask.set(c.subtask_id, []);
    bySubtask.get(c.subtask_id).push(c);
  }

  const notesBySubtask = new Map();
  for (const n of data.notes ?? []) {
    if (!index.subtasks.has(n.subtask_id)) continue;   // stale id, skip
    if (!notesBySubtask.has(n.subtask_id)) notesBySubtask.set(n.subtask_id, []);
    notesBySubtask.get(n.subtask_id).push(n);
  }

  const lines = [
    `# ${path.title} — cards and notes`,
    '',
    `Exported by **${data.user?.email ?? 'unknown'}** on ${day(data.exportedAt)}.`,
    ''
  ];

  if (bySubtask.size === 0 && notesBySubtask.size === 0) {
    lines.push('No cards or notes yet.');
    return lines.join('\n') + '\n';
  }

  for (const ph of path.phases ?? []) {
    const groups = [];
    for (const t of ph.tasks ?? []) {
      for (const s of t.subtasks ?? []) {
        const cards = bySubtask.get(s.id);
        const notes = notesBySubtask.get(s.id);
        if (cards || notes) {
          groups.push({ subtask: s, cards: cards ?? [], notes: notes ?? [] });
        }
      }
    }
    if (!groups.length) continue;

    lines.push(`## ${ph.title}`, '');
    for (const g of groups) {
      lines.push(`### ${g.subtask.title}`, '');
      for (const c of g.cards) {
        lines.push(`**Q.** ${c.prompt}`, '');
        lines.push(`**A.** ${c.answer}`, '');
        lines.push(`_due ${day(c.due_at)} · ${plural(c.reps ?? 0, 'review')} · ${plural(c.lapses ?? 0, 'lapse')}_`, '');
      }

      // Verbatim, for the same reason nothing else here is escaped: the body
      // is already Markdown and this file is Markdown.
      if (g.notes.length) {
        lines.push('**Notes**', '');
        for (const n of g.notes) lines.push(n.body, '');
      }
    }
  }

  return lines.join('\n') + '\n';
}
