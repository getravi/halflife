import { describe, it, expect } from 'vitest';
import { prereqHtml, neededByHtml } from '../src/prereq-view.js';
import { indexPath } from '../src/weights.js';

const path = {
  id: 'p',
  phases: [{
    id: 'ph1', weight: 1,
    tasks: [{
      id: 't1', weight: 1,
      subtasks: [
        { id: 's1', title: 'Stand up vLLM', desc: 'd', steps: [], resources: {} },
        { id: 's2', title: 'Agent harness', desc: 'd', steps: [], resources: {},
          prereqs: ['s1'] }
      ]
    }]
  }]
};
const ctx = { path, index: indexPath(path) };
const sub = id => ctx.index.subtasks.get(id);

describe('prereqHtml', () => {
  it('renders nothing at all when a subtask has no prerequisites', () => {
    expect(prereqHtml(sub('s1'), ctx, new Set())).toBe('');
  });

  it('shows the prerequisite as a title, never as a raw id', () => {
    const html = prereqHtml(sub('s2'), ctx, new Set());
    expect(html).toContain('Stand up vLLM');
    // The id belongs in the data attribute the click handler reads, and
    // nowhere a reader can see it.
    expect(html.replace(/<[^>]*>/g, '')).not.toContain('s1');
  });

  it('carries the id the sidebar click handler needs, and no href', () => {
    const html = prereqHtml(sub('s2'), ctx, new Set());
    expect(html).toContain('data-subtask-id="s1"');
    // An href would set the hash, and nav.js reads `#s1` as the panel
    // `view-s1`, which does not exist — every panel would go inactive.
    expect(html).not.toContain('href');
  });

  it('marks an unfinished prerequisite, which is the entire point', () => {
    const html = prereqHtml(sub('s2'), ctx, new Set());
    expect(html).toMatch(/prereq-undone/);
  });

  it('marks a finished one differently', () => {
    const html = prereqHtml(sub('s2'), ctx, new Set(['s1']));
    expect(html).toMatch(/prereq-done/);
    expect(html).not.toMatch(/prereq-undone/);
  });

  it('omits tick state entirely when progress is unknown, rather than guessing', () => {
    const html = prereqHtml(sub('s2'), ctx, null);
    expect(html).toContain('Stand up vLLM');
    expect(html).not.toMatch(/prereq-done|prereq-undone/);
  });

  it('escapes markup in a title', () => {
    const evil = JSON.parse(JSON.stringify(path));
    evil.phases[0].tasks[0].subtasks[0].title = '<img src=x onerror=alert(1)>';
    const c = { path: evil, index: indexPath(evil) };
    const html = prereqHtml(c.index.subtasks.get('s2'), c, new Set());
    expect(html).not.toContain('<img src=x');
  });

  it('skips a prereq id that no longer resolves rather than throwing', () => {
    const broken = JSON.parse(JSON.stringify(path));
    broken.phases[0].tasks[0].subtasks[1].prereqs = ['gone'];
    const c = { path: broken, index: indexPath(broken) };
    expect(() => prereqHtml(c.index.subtasks.get('s2'), c, new Set())).not.toThrow();
  });
});

describe('neededByHtml', () => {
  it('names what depends on this subtask', () => {
    expect(neededByHtml(sub('s1'), ctx)).toContain('Agent harness');
  });

  it('renders nothing when nothing depends on it', () => {
    expect(neededByHtml(sub('s2'), ctx)).toBe('');
  });
});
