import { describe, it, expect } from 'vitest';
import { computeWeights, indexPath } from '../src/weights.js';

const path = {
  id: 'p', title: 'P',
  phases: [{
    id: 'ph1', title: 'One', weeks: [1, 4], weight: 10,
    tasks: [{
      id: 't1', title: 'T', weeks: [1, 2], weight: 8,
      subtasks: [
        { id: 't1-s01', title: 'A', desc: 'd', resources: {},
          steps: [
            { id: 't1-s01-01', text: 'Implement the tokenizer' },
            { id: 't1-s01-02', text: 'Debug the failing case' },
            { id: 't1-s01-03', text: 'Read the paper' }
          ] },
        { id: 't1-s02', title: 'B', desc: 'd', resources: {}, steps: [] }
      ]
    }]
  }]
};

describe('computeWeights', () => {
  it('takes phase and task weights straight from the path', () => {
    const w = computeWeights(path);
    expect(w.phases.ph1).toBe(10);
    expect(w.tasks.t1).toBe(8);
  });

  it('divides a task weight evenly across its subtasks', () => {
    const w = computeWeights(path);
    expect(w.subtasks['t1-s01']).toBe(4);
    expect(w.subtasks['t1-s02']).toBe(4);
  });

  it('scores a build verb above a practice verb above a read verb, because effort is not uniform', () => {
    const w = computeWeights(path);
    expect(w.steps['t1-s01-01']).toBe(3);   // implement
    expect(w.steps['t1-s01-02']).toBe(2);   // debug
    expect(w.steps['t1-s01-03']).toBe(1);   // read
  });

  it('lets a build verb win when a step contains both, because the build is the work', () => {
    const w = computeWeights({ id: 'p', phases: [{ id: 'ph', weight: 1, tasks: [{
      id: 't', weight: 1, subtasks: [{ id: 's', desc: 'd', resources: {},
        steps: [{ id: 'st', text: 'Run the benchmark suite' }] }] }] }] });
    expect(w.steps.st).toBe(3);
  });

  it('never divides by zero when a task has no subtasks, which every milestone is', () => {
    const empty = { id: 'p', phases: [{ id: 'ph', weeks: [1, 1], weight: 1,
      tasks: [{ id: 't', weeks: null, weight: 4, subtasks: [] }] }] };
    expect(() => computeWeights(empty)).not.toThrow();
    expect(computeWeights(empty).tasks.t).toBe(4);
  });
});

describe('indexPath', () => {
  it('maps every id to its node and every child to its parent', () => {
    const ix = indexPath(path);
    expect(ix.subtasks.get('t1-s01').title).toBe('A');
    expect(ix.steps.get('t1-s01-02').text).toMatch(/failing case/);
    expect(ix.taskOf.get('t1-s01')).toBe('t1');
    expect(ix.subtaskOf.get('t1-s01-01')).toBe('t1-s01');
  });
});
