import { describe, it, expect } from 'vitest';
import { validatePath } from '../tools/validate-path.js';

const valid = () => ({
  id: 'p', title: 'P',
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
});
