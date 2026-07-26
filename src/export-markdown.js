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

  const lines = [
    `# ${path.title} — cards`,
    '',
    `Exported by **${data.user?.login ?? 'unknown'}** on ${day(data.exportedAt)}.`,
    ''
  ];

  if (bySubtask.size === 0) {
    lines.push('No cards yet.');
    return lines.join('\n') + '\n';
  }

  for (const ph of path.phases ?? []) {
    const groups = [];
    for (const t of ph.tasks ?? []) {
      for (const s of t.subtasks ?? []) {
        const cards = bySubtask.get(s.id);
        if (cards) groups.push({ subtask: s, cards });
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
    }
  }

  return lines.join('\n') + '\n';
}
