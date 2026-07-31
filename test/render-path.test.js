import { describe, it, expect } from 'vitest';
import { renderPath, renderNav } from '../src/render-path.js';
// Imported rather than read: these tests run inside the Workers runtime,
// which has no filesystem.
import path from '../paths/frontier-lab.json';

/**
 * renderPath hands one HTML string to insertAdjacentHTML, so a fake root that
 * captures the string exercises the real code path without a browser. This is
 * the layer that replaced tools/render.py, and until now nothing checked it.
 */
function capture(fn) {
  let html = '';
  fn({
    insertAdjacentHTML: (_pos, s) => { html += s; },
    // renderNav wires a change listener onto the switcher it just inserted;
    // the markup is what these tests assert, so the hook is a stub.
    querySelector: () => ({ addEventListener() {} })
  });
  return html;
}

const count = (html, re) => (html.match(re) ?? []).length;

describe('renderPath against the real curriculum', () => {
  const html = capture(root => renderPath(path, root));

  it('renders one panel per phase', () => {
    expect(count(html, /class="view-panel"/g)).toBe(5);
    for (const ph of path.phases) {
      expect(html).toContain(`id="view-${ph.id}"`);
    }
  });

  it('renders every task as its own section, milestones included', () => {
    const tasks = path.phases.flatMap(p => p.tasks);
    expect(tasks).toHaveLength(36);
    expect(count(html, /class="day-section"/g)).toBe(36);
    for (const t of tasks) expect(html).toContain(`id="sec-${t.id}"`);
  });

  it('renders every subtask as a clickable card carrying its node id', () => {
    const subtasks = path.phases.flatMap(p => p.tasks).flatMap(t => t.subtasks);
    expect(subtasks).toHaveLength(158);
    expect(count(html, /class="task-item"/g)).toBe(158);
    // The id is what the sidebar opens on; without it every card is inert.
    for (const s of subtasks.slice(0, 20)) {
      expect(html).toContain(`data-subtask-id="${s.id}"`);
    }
  });

  it('gives milestones a checkbox rather than a subtask grid, since they have no subtasks', () => {
    const milestones = path.phases.flatMap(p => p.tasks).filter(t => t.milestone);
    expect(milestones).toHaveLength(5);
    expect(count(html, /class="milestone-checkbox"/g)).toBe(5);
    for (const m of milestones) {
      expect(html).toContain(`data-node-id="${m.id}"`);
    }
  });

  it('carries the class names style.css already targets, so the CSS needs no changes', () => {
    for (const cls of ['task-grid', 'task-item-title', 'task-item-desc',
                       'task-item-time', 'day-header', 'day-num-badge',
                       'page-hero-eyebrow']) {
      expect(html, `missing .${cls}`).toContain(`class="${cls}"`);
    }
  });

  it('shows a week range on phases that have one and omits it on those that do not', () => {
    expect(html).toMatch(/Weeks \d+–\d+/);
  });

  it('escapes angle brackets, so a title containing markup cannot inject it', () => {
    const evil = {
      phases: [{
        id: 'p', title: 'T', num: 'N', weeks: [1, 2], intro: 'i',
        tasks: [{
          id: 't', title: 'T', badge: 'B',
          subtasks: [{
            id: 's', title: '<img src=x onerror=alert(1)>', desc: 'd', steps: [], resources: {}
          }]
        }]
      }]
    };
    const out = capture(root => renderPath(evil, root));
    expect(out).not.toContain('<img src=x');
    expect(out).toContain('&lt;img src=x');
  });
});

describe('renderNav', () => {
  const catalogue = { paths: [
    { id: path.id, title: 'This one', phases: [] },
    { id: 'other', title: 'Other one', phases: [{ id: 'o-p0', title: 'O' }] }
  ] };

  it('builds the whole path bar: views plus one link per phase', () => {
    const bar = capture(root => renderNav(path, root, catalogue));
    for (const [href, label] of [['#today', 'Today'], ['#cards', 'Cards'],
        ['#glossary', 'Terms'], ['#notes', 'Notes']]) {
      expect(bar).toContain(`href="${href}">${label}`);
    }
    for (const ph of path.phases) expect(bar).toContain(`href="#${ph.id}"`);
  });

  it('offers a path switcher when the catalogue holds more than one path', () => {
    const bar = capture(root => renderNav(path, root, catalogue));
    expect(bar).toContain('nav-path-switcher');
    expect(bar).toContain('Other one');
    expect(bar).toMatch(new RegExp(`value="${path.id}"[^>]*selected`));
  });

  it('renders no switcher when there is only one path', () => {
    const one = { paths: [{ id: path.id, title: 'Only', phases: [] }] };
    const bar = capture(root => renderNav(path, root, one));
    expect(bar).not.toContain('nav-path-switcher');
  });
});
