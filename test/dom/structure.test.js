import { describe, it, expect } from 'vitest';
import { mountApp } from './harness.js';
import PATH from '../../paths/frontier-lab.json';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const subtasks = PATH.phases.flatMap(p => p.tasks).flatMap(t => t.subtasks ?? []);
const WITH = subtasks.find(s => (s.prereqs ?? []).length);

// Isolated in both directions. "Assumes" and "Needed by" share a class, so a
// subtask that is merely free of prerequisites still renders a block if
// anything depends on it.
const dependedOn = new Set(subtasks.flatMap(s => s.prereqs ?? []));
const WITHOUT = subtasks.find(s => !(s.prereqs ?? []).length && !dependedOn.has(s.id));
const byId = id => subtasks.find(s => s.id === id);

const open = id => $(`.task-item[data-subtask-id="${id}"]`).click();

describe('prerequisites in the sidebar', () => {
  it('shows them when a subtask has them', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    open(WITH.id);

    const block = $('#sidebar-body .prereq-block');
    expect(block).toBeTruthy();
    expect(block.textContent).toContain(byId(WITH.prereqs[0]).title);
  });

  it('shows no prereq block for a subtask that assumes nothing', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    open(WITHOUT.id);
    expect($('#sidebar-body .prereq-block')).toBeNull();
  });

  it('opens the prerequisite when you click it — the reason it is a button', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    open(WITH.id);

    const target = byId(WITH.prereqs[0]);
    $(`#sidebar-body .prereq-item[data-subtask-id="${target.id}"]`).click();

    expect($('#sidebar-title').textContent).toContain(target.title);
  });

  it('leaves the page behind the sidebar intact, rather than blanking it', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    open(WITH.id);
    $(`#sidebar-body .prereq-item`).click();

    // An href would have set the hash to a subtask id, which nav.js reads as a
    // panel name that does not exist, deactivating every panel.
    expect($$('.view-panel.active').length).toBe(1);
  });

  it('shows what needs this subtask, on the subtask it depends on', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    open(WITH.prereqs[0]);

    const blocks = $$('#sidebar-body .prereq-block')
      .filter(b => b.textContent.includes('Needed by'));
    expect(blocks.length).toBe(1);
    expect(blocks[0].textContent).toContain(WITH.title);
  });
});

describe('the term index', () => {
  it('renders every term on load', async () => {
    await mountApp();
    expect($$('#glossary-list .glossary-row').length).toBe(PATH.terms.length);
  });

  it('narrows as you type', async () => {
    await mountApp();
    const before = $$('#glossary-list .glossary-row').length;

    const box = $('#glossary-filter');
    box.value = 'GRPO';
    box.dispatchEvent(new Event('input', { bubbles: true }));

    const rows = $$('#glossary-list .glossary-row');
    expect(rows.length).toBeLessThan(before);
    expect(rows.every(r => r.textContent.includes('GRPO'))).toBe(true);
  });

  it('says so rather than going blank when nothing matches', async () => {
    await mountApp();
    const box = $('#glossary-filter');
    box.value = 'zzzznothing';
    box.dispatchEvent(new Event('input', { bubbles: true }));

    expect($$('#glossary-list .glossary-row').length).toBe(0);
    expect($('#glossary-list').textContent).toMatch(/no terms/i);
  });

  it('renders signed out, because terms are content rather than user data', async () => {
    await mountApp();
    expect($$('#glossary-list .glossary-row').length).toBeGreaterThan(0);
  });

  it('opens the subtask a term appears in', async () => {
    await mountApp();
    const jump = $('#glossary-list .glossary-ref[data-subtask-id]');
    const target = byId(jump.dataset.subtaskId);
    jump.click();

    expect($('#sidebar-title').textContent).toContain(target.title);
  });
});
