import { describe, it, expect } from 'vitest';
import { notesHtml } from '../src/notes-view.js';
import { indexPath } from '../src/weights.js';

const path = {
  id: 'p',
  terms: [],
  phases: [{
    id: 'ph1', weight: 1,
    tasks: [{
      id: 't1', weight: 1,
      subtasks: [
        { id: 's1', title: 'Stand up vLLM', desc: 'd', steps: [], resources: {} },
        { id: 's2', title: 'Continuous batching', desc: 'd', steps: [], resources: {} }
      ]
    }]
  }]
};
const ctx = { path, index: indexPath(path) };

const notes = [
  { id: 'n1', subtask_id: 's1', body: '`--gpu-memory-utilization 0.85`',
    created_at: 2000, updated_at: 2000 },
  { id: 'n2', subtask_id: 's1', body: 'older note', created_at: 1000, updated_at: 1000 },
  { id: 'n3', subtask_id: 's2', body: 'different subtask',
    created_at: 3000, updated_at: 3000 }
];

describe('notesHtml', () => {
  it('shows only the notes for that subtask', () => {
    const html = notesHtml(notes, ctx, 's1');
    expect(html).toContain('older note');
    expect(html).not.toContain('different subtask');
  });

  it('renders the markdown rather than the source', () => {
    expect(notesHtml(notes, ctx, 's1')).toContain('<code>');
  });

  it('puts the newest first, because that is what you just wrote', () => {
    const html = notesHtml(notes, ctx, 's1');
    expect(html.indexOf('gpu-memory')).toBeLessThan(html.indexOf('older note'));
  });

  it('carries the id the edit and delete handlers need', () => {
    expect(notesHtml(notes, ctx, 's1')).toContain('data-note-id="n1"');
  });

  it('offers edit and delete on each note', () => {
    const html = notesHtml(notes, ctx, 's1');
    expect(html).toContain('data-action="edit"');
    expect(html).toContain('data-action="delete"');
  });

  it('marks a note that was edited, so a stale one is visible as stale', () => {
    const edited = [{ id: 'n4', subtask_id: 's1', body: 'x',
                      created_at: 1000, updated_at: 9000 }];
    expect(notesHtml(edited, ctx, 's1')).toMatch(/edited/i);
  });

  it('says nothing is here yet rather than rendering an empty box', () => {
    expect(notesHtml([], ctx, 's1')).toMatch(/no notes/i);
  });

  it('survives a note whose subtask no longer exists', () => {
    const stale = [{ id: 'n9', subtask_id: 'gone', body: 'x',
                     created_at: 1, updated_at: 1 }];
    expect(() => notesHtml(stale, ctx, 's1')).not.toThrow();
  });
});
