import { describe, it, expect } from 'vitest';
import { buildMarkdown } from '../src/export-markdown.js';
import path from '../paths/frontier-lab.json';

const P0 = path.phases[0].tasks[0].subtasks[0].id;
const P2 = path.phases[2].tasks[0].subtasks[0].id;
const NOW = 1_800_000_000_000;

const data = {
  exportedAt: NOW,
  user: { email: 'ravi@example.com' },
  enrollments: [{ pathId: 'frontier-lab', startedOn: '2026-07-25' }],
  progress: [],
  reviews: [],
  cards: [
    { id: 'c2', subtask_id: P2, path_id: 'frontier-lab',
      prompt: 'second prompt', answer: 'second answer',
      due_at: NOW, reps: 2, lapses: 1 },
    { id: 'c1', subtask_id: P0, path_id: 'frontier-lab',
      prompt: 'first prompt', answer: 'first answer',
      due_at: NOW, reps: 0, lapses: 0 }
  ]
};

describe('buildMarkdown', () => {
  it('includes every card', () => {
    const md = buildMarkdown(data, path);
    expect(md).toContain('first prompt');
    expect(md).toContain('first answer');
    expect(md).toContain('second prompt');
    expect(md).toContain('second answer');
  });

  it('orders by the path rather than by the order the cards arrived', () => {
    const md = buildMarkdown(data, path);
    expect(md.indexOf('first prompt')).toBeLessThan(md.indexOf('second prompt'));
  });

  it('heads each group with its phase and subtask, so the file reads like the plan', () => {
    const md = buildMarkdown(data, path);
    expect(md).toContain(`## ${path.phases[0].title}`);
    expect(md).toContain(`### ${path.phases[0].tasks[0].subtasks[0].title}`);
  });

  it('records who exported it and when', () => {
    const md = buildMarkdown(data, path);
    expect(md).toContain('ravi@example.com');
    expect(md).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('leaves backticks alone, because this is Markdown and prompts discuss `vllm serve`', () => {
    const md = buildMarkdown({ ...data, cards: [
      { id: 'c', subtask_id: P0, prompt: 'What does `vllm serve` allocate?',
        answer: 'KV cache blocks', due_at: NOW, reps: 0, lapses: 0 }
    ] }, path);
    expect(md).toContain('`vllm serve`');
  });

  it('notes lapses so a struggling card is visible in the export too', () => {
    const md = buildMarkdown(data, path);
    expect(md).toMatch(/1 lapse/);
  });

  it('says so plainly when there are no cards', () => {
    const md = buildMarkdown({ ...data, cards: [] }, path);
    expect(md).toMatch(/no cards/i);
  });

  it('skips a card whose subtask is not in the path rather than throwing', () => {
    const md = buildMarkdown({ ...data, cards: [
      { id: 'ghost', subtask_id: 'no-such', prompt: 'ghost prompt',
        answer: 'a', due_at: NOW, reps: 0, lapses: 0 }
    ] }, path);
    expect(md).not.toContain('ghost prompt');
  });
});
