import { describe, it, expect } from 'vitest';
import { validatePath, validateExercises, catalogueEntry } from '../tools/validate-path.js';

const valid = () => ({
  id: 'p', title: 'P', tagline: 't',
  phases: [{
    id: 'ph1', title: 'One', weeks: [1, 4], weight: 1,
    tasks: [{
      id: 't1', title: 'T', weeks: [1, 2], weight: 1,
      subtasks: [{
        id: 't1-s01', title: 'S', desc: 'd',
        steps: [{ id: 't1-s01-01', text: 'do it' }], resources: {}
      }]
    }]
  }]
});

describe('validatePath', () => {
  it('accepts a well-formed path', () => {
    expect(validatePath(valid(), null)).toEqual([]);
  });

  it('rejects a duplicate id anywhere in the tree', () => {
    const p = valid();
    p.phases[0].tasks[0].subtasks.push({
      id: 't1-s01', title: 'dup', desc: 'd', steps: [], resources: {}
    });
    expect(validatePath(p, null).join()).toMatch(/duplicate id/i);
  });

  it('rejects a week outside its phase range', () => {
    const p = valid();
    p.phases[0].tasks[0].weeks = [1, 9];
    expect(validatePath(p, null).join()).toMatch(/outside/i);
  });

  it('rejects a task that starts before one listed ahead of it', () => {
    // Overlap is fine — two tasks may share a week. What is not fine is a
    // later entry starting earlier, which is what sequential renumbering used
    // to produce and what put the capstone before the experiment designing it.
    const p = valid();
    p.phases[0].tasks[0].weeks = [3, 4];
    p.phases[0].tasks.push({
      id: 't2', title: 'T2', weeks: [1, 2], weight: 1,
      subtasks: [{ id: 't2-s01', title: 'S', desc: 'd', steps: [], resources: {} }]
    });
    expect(validatePath(p, null).join()).toMatch(/backwards|before/i);
  });

  it('allows two tasks to share a week, because overlap is legitimate', () => {
    const p = valid();
    p.phases[0].tasks.push({
      id: 't2', title: 'T2', weeks: [1, 2], weight: 1,
      subtasks: [{ id: 't2-s01', title: 'S', desc: 'd', steps: [], resources: {} }]
    });
    expect(validatePath(p, null)).toEqual([]);
  });

  it('rejects a subtask with no description, because the sidebar would open blank', () => {
    const p = valid();
    p.phases[0].tasks[0].subtasks[0].desc = '';
    expect(validatePath(p, null).join()).toMatch(/desc/i);
  });

  it('accepts a milestone, which legitimately has no subtasks at all', () => {
    const p = valid();
    p.phases[0].tasks.push({
      id: 't-mile', title: 'Milestone', weeks: [3, 4], weight: 1,
      subtasks: [], milestone: { heading: 'h', items: ['a'], next: '' }
    });
    expect(validatePath(p, null)).toEqual([]);
  });

  it('fails when an id present in the previous version has vanished — that orphans every user card keyed to it', () => {
    const previous = valid();
    const next = valid();
    next.phases[0].tasks[0].subtasks[0].id = 't1-s99';
    const problems = validatePath(next, previous).join();
    expect(problems).toMatch(/t1-s01/);
    expect(problems).toMatch(/removed|vanished/i);
  });

  it('allows adding new ids, because a path must be able to grow', () => {
    const previous = valid();
    const next = valid();
    next.phases[0].tasks[0].subtasks.push({
      id: 't1-s02', title: 'New', desc: 'd', steps: [], resources: {}
    });
    expect(validatePath(next, previous)).toEqual([]);
  });

  it('allows renaming a title freely, which is the whole point of stable ids', () => {
    const previous = valid();
    const next = valid();
    next.phases[0].tasks[0].subtasks[0].title = 'Completely different wording';
    expect(validatePath(next, previous)).toEqual([]);
  });

  it('rejects a prereq pointing at a subtask that does not exist', () => {
    const p = valid();
    p.phases[0].tasks[0].subtasks[0].prereqs = ['no-such-subtask'];
    expect(validatePath(p, null).join()).toMatch(/unknown prereq/i);
  });

  it('rejects a cycle, because a plan you can never start is worse than no plan', () => {
    const p = valid();
    p.phases[0].tasks[0].subtasks.push({
      id: 't1-s02', title: 'B', desc: 'd', steps: [], resources: {},
      prereqs: ['t1-s01']
    });
    p.phases[0].tasks[0].subtasks[0].prereqs = ['t1-s02'];
    expect(validatePath(p, null).join()).toMatch(/cycle/i);
  });

  it('rejects a prereq that comes later in the path than the subtask needing it', () => {
    const p = valid();
    p.phases[0].tasks[0].subtasks.push({
      id: 't1-s02', title: 'B', desc: 'd', steps: [], resources: {}
    });
    // s01 comes first but claims to depend on s02, which comes after it.
    p.phases[0].tasks[0].subtasks[0].prereqs = ['t1-s02'];
    expect(validatePath(p, null).join()).toMatch(/after|later/i);
  });

  it('accepts a prereq that comes earlier', () => {
    const p = valid();
    p.phases[0].tasks[0].subtasks.push({
      id: 't1-s02', title: 'B', desc: 'd', steps: [], resources: {},
      prereqs: ['t1-s01']
    });
    expect(validatePath(p, null)).toEqual([]);
  });

  it('accepts a path with no prereqs at all, because the field is optional', () => {
    expect(validatePath(valid(), null)).toEqual([]);
  });
});

describe('validateExercises', () => {
  const ex = (over = {}) => ({
    ghost: {
      pathId: 'p', subtaskId: 't1-s01', gatedNodeId: 't1-s01-01', tests: 1, ...over
    }
  });

  it('rejects an exercise whose gated step is not in the path', () => {
    expect(validateExercises(valid(), ex({ gatedNodeId: 'nope-07' })).join())
      .toMatch(/nope-07/);
  });

  it('rejects an exercise whose subtask is not in the path', () => {
    expect(validateExercises(valid(), ex({ subtaskId: 'gone' })).join()).toMatch(/gone/);
  });

  it('rejects a test count that is not a positive integer', () => {
    expect(validateExercises(valid(), ex({ tests: 0 })).join()).toMatch(/tests/i);
  });

  it('rejects a missing pathId, which would write progress nothing reads back', () => {
    expect(validateExercises(valid(), ex({ pathId: undefined })).join())
      .toMatch(/pathId/i);
  });

  it('rejects two exercises claiming the same gated step', () => {
    const problems = validateExercises(valid(), {
      a: { pathId: 'p', subtaskId: 't1-s01', gatedNodeId: 't1-s01-01', tests: 1 },
      b: { pathId: 'p', subtaskId: 't1-s01', gatedNodeId: 't1-s01-01', tests: 1 }
    });
    expect(problems.join()).toMatch(/twice|duplicate/i);
  });

  it('accepts a well-formed exercise', () => {
    expect(validateExercises(valid(), ex())).toEqual([]);
  });

  it('accepts a path with no exercises at all', () => {
    expect(validateExercises(valid(), {})).toEqual([]);
  });
});

describe('catalogue metadata', () => {
  it('rejects a path without a tagline', () => {
    const p = valid();
    delete p.tagline;
    expect(validatePath(p, null).join()).toMatch(/tagline/i);
  });

  it('derives card stats for the catalogue', () => {
    const p = valid();
    p.tagline = 'One line.';
    const entry = catalogueEntry(p, 'p-abc123.json');
    expect(entry).toEqual({
      id: 'p', title: 'P', tagline: 'One line.',
      weeks: 4, tasks: 1,
      phases: [{ id: 'ph1', title: 'One' }],
      url: '/paths/p-abc123.json'
    });
  });
});
