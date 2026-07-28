import { describe, it, expect } from 'vitest';
import { exerciseHtml } from '../src/exercise-view.js';

const ex = {
  id: 'attention-einsum',
  title: 'Attention in einsum',
  notebook: 'attention-einsum.ipynb',
  tests: 5
};

const attempt = (over = {}) =>
  ({ exercise_id: 'attention-einsum', passed: 5, total: 5, ran_at: 900, ...over });

describe('exerciseHtml', () => {
  it('links to Colab for this repository', () => {
    const html = exerciseHtml(ex, [], 1000);
    expect(html).toContain('colab.research.google.com/github/getravi/halflife');
    expect(html).toContain('attention-einsum.ipynb');
  });

  it('says it has never been run, rather than showing a blank score', () => {
    expect(exerciseHtml(ex, [], 1000)).toMatch(/not run yet/i);
  });

  it('shows the most recent attempt, not the best one', () => {
    const html = exerciseHtml(ex, [
      attempt({ passed: 3, ran_at: 900 }),
      attempt({ passed: 5, ran_at: 500 })
    ], 1000);
    expect(html).toContain('3 / 5');
  });

  it('ignores attempts belonging to another exercise', () => {
    const html = exerciseHtml(ex, [attempt({ exercise_id: 'something-else' })], 1000);
    expect(html).toMatch(/not run yet/i);
  });

  it('marks it passed once any attempt has passed', () => {
    // Earned is earned: the newest attempt failing does not un-pass it, and
    // the route agrees — a later failure never clears the tick.
    const html = exerciseHtml(ex, [
      attempt({ passed: 2, ran_at: 900 }),
      attempt({ passed: 5, ran_at: 500 })
    ], 1000);
    expect(html).toMatch(/passed/i);
  });

  it('states what a pass actually proves', () => {
    expect(exerciseHtml(ex, [attempt()], 1000)).toMatch(/you ran it/i);
  });

  it('escapes markup in a title', () => {
    const evil = { ...ex, title: '<img src=x onerror=alert(1)>' };
    expect(exerciseHtml(evil, [], 1000)).not.toContain('<img src=x');
  });

  it('survives an empty attempt list without throwing', () => {
    expect(() => exerciseHtml(ex, null, 1000)).not.toThrow();
  });
});
