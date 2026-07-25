import { describe, it, expect } from 'vitest';
import { computeWeights } from '../src/weights.js';
import { rollup } from '../src/progress.js';

const path = {
  id: 'p',
  phases: [{
    id: 'ph1', weeks: [1, 4], weight: 1,
    tasks: [{
      id: 't1', weeks: [1, 2], weight: 2,
      subtasks: [
        { id: 's1', desc: 'd', resources: {},
          steps: [{ id: 's1-01', text: 'Read it' }, { id: 's1-02', text: 'Read it again' }] },
        { id: 's2', desc: 'd', resources: {}, steps: [] }
      ]
    }]
  }]
};

const w = computeWeights(path);

describe('rollup', () => {
  it('is zero with nothing done', () => {
    expect(rollup(path, w, new Set()).overall).toBe(0);
  });

  it('is one hundred with everything done', () => {
    const all = new Set(['s1-01', 's1-02', 's2']);
    expect(Math.round(rollup(path, w, all).overall)).toBe(100);
  });

  it('treats a stepless subtask as its own single checkbox', () => {
    const r = rollup(path, w, new Set(['s2']));
    expect(r.subtasks.s2).toBe(100);
    expect(r.subtasks.s1).toBe(0);
  });

  it('weights a half-done subtask by step weight rather than step count', () => {
    const r = rollup(path, w, new Set(['s1-01']));
    expect(r.subtasks.s1).toBe(50);   // both steps are read verbs, weight 1 each
  });

  it('normalises at each level, so one finished subtask of two is half the task', () => {
    const r = rollup(path, w, new Set(['s2']));
    expect(Math.round(r.tasks.t1)).toBe(50);
    expect(Math.round(r.phases.ph1)).toBe(50);
  });
});

describe('rollup with milestones', () => {
  // A milestone is a task with no subtasks, ticked by its own id. Without a
  // branch for it, its weight would sit in the denominator and never be
  // satisfiable, capping the plan below 100 forever.
  const withMilestone = {
    id: 'p',
    phases: [{
      id: 'ph1', weight: 1,
      tasks: [
        { id: 't1', weight: 1, subtasks: [
          { id: 's1', desc: 'd', resources: {}, steps: [] }] },
        { id: 'm1', weight: 1, subtasks: [],
          milestone: { heading: 'h', items: ['a'], next: '' } }
      ]
    }]
  };
  const mw = computeWeights(withMilestone);

  it('counts a milestone as done when its own id is ticked', () => {
    expect(rollup(withMilestone, mw, new Set(['m1'])).tasks.m1).toBe(100);
  });

  it('counts it as not done otherwise', () => {
    expect(rollup(withMilestone, mw, new Set()).tasks.m1).toBe(0);
  });

  it('reaches one hundred overall only when the milestone is ticked too', () => {
    const partial = rollup(withMilestone, mw, new Set(['s1']));
    expect(Math.round(partial.overall)).toBe(50);

    const complete = rollup(withMilestone, mw, new Set(['s1', 'm1']));
    expect(Math.round(complete.overall)).toBe(100);
  });
});
