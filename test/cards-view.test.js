import { describe, it, expect } from 'vitest';
import { cardsHtml } from '../src/cards-view.js';
import { indexPath, computeWeights } from '../src/weights.js';
import path from '../paths/frontier-lab.json';

const ctx = { path, pathId: 'frontier-lab', index: indexPath(path), weights: computeWeights(path) };
const NOW = 1_800_000_000_000;
const DAY = 86400000;

// Two subtasks from different phases, chosen so path order is observable.
const P0 = path.phases[0].tasks[0].subtasks[0].id;
const P2 = path.phases[2].tasks[0].subtasks[0].id;

const card = (id, subtaskId, over = {}) => ({
  id, subtask_id: subtaskId, path_id: 'frontier-lab',
  prompt: `prompt ${id}`, answer: `answer ${id}`,
  due_at: NOW + 4 * DAY, reps: 3, lapses: 1, stability: 4,
  last_reviewed_at: NOW - DAY, created_at: NOW - 10 * DAY,
  ...over
});

describe('cardsHtml', () => {
  it('renders every card', () => {
    const html = cardsHtml(ctx, [card('a', P0), card('b', P2)], NOW);
    expect(html).toContain('data-card-id="a"');
    expect(html).toContain('data-card-id="b"');
    expect(html).toContain('prompt a');
    expect(html).toContain('answer b');
  });

  it('groups in path order rather than the order the cards arrived', () => {
    // b belongs to phase 3, a to phase 1; passing b first must not win.
    const html = cardsHtml(ctx, [card('b', P2), card('a', P0)], NOW);
    expect(html.indexOf('data-card-id="a"')).toBeLessThan(html.indexOf('data-card-id="b"'));
  });

  it('shows the subtask each card came from, which is how you recognise it', () => {
    const html = cardsHtml(ctx, [card('a', P0)], NOW);
    expect(html).toContain(ctx.index.subtasks.get(P0).title);
  });

  it('shows reviews and lapses so a card you keep failing is visible here', () => {
    const html = cardsHtml(ctx, [card('a', P0)], NOW);
    expect(html).toMatch(/3 reviews/);
    expect(html).toMatch(/1 lapse\b/);
  });

  it('marks an overdue card', () => {
    const html = cardsHtml(ctx, [card('a', P0, { due_at: NOW - DAY })], NOW);
    expect(html).toMatch(/overdue/i);
  });

  it('offers edit and delete on every row', () => {
    const html = cardsHtml(ctx, [card('a', P0)], NOW);
    expect(html).toContain('data-action="edit"');
    expect(html).toContain('data-action="delete"');
  });

  it('escapes markup in a prompt, because innerHTML is how this is mounted', () => {
    const html = cardsHtml(ctx, [card('a', P0, { prompt: '<img src=x onerror=alert(1)>' })], NOW);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('points at the next action when there are no cards, rather than merely saying there are none', () => {
    const html = cardsHtml(ctx, [], NOW);
    expect(html).toMatch(/finish a subtask/i);
  });

  it('ignores a card whose subtask is not in this path, rather than throwing', () => {
    const html = cardsHtml(ctx, [card('ghost', 'no-such-subtask')], NOW);
    expect(html).not.toContain('data-card-id="ghost"');
  });
});
