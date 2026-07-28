import { describe, it, expect } from 'vitest';
import { mountApp } from './harness.js';
import PATH from '../../paths/frontier-lab.json';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const SUB = PATH.phases[0].tasks[0].subtasks[0];
const open = id => $(`.task-item[data-subtask-id="${id}"]`).click();

const note = (body, over = {}) => ({
  id: 'n1', subtask_id: SUB.id, path_id: 'frontier-lab',
  body, created_at: 1, updated_at: 1, ...over
});

const type = (sel, value) => {
  const el = $(sel);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return el;
};

describe('notes in the sidebar', () => {
  it('shows the box to someone signed in', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    open(SUB.id);
    expect($('#notes-slot')).toBeTruthy();
    expect($('#note-input')).toBeTruthy();
  });

  it('shows nothing at all to someone signed out', async () => {
    await mountApp();
    open(SUB.id);
    expect($('#notes-slot')).toBeNull();
  });

  it('renders a saved note as markdown rather than as its source', async () => {
    await mountApp({
      signedIn: true, enrolled: true,
      notes: [note('the `--flag` matters')]
    });
    open(SUB.id);

    expect($('#notes-list .note-body code').textContent).toBe('--flag');
  });

  it('escapes a script tag written into a note', async () => {
    await mountApp({
      signedIn: true, enrolled: true,
      notes: [note('<script>window.PWNED = 1</script>')]
    });
    open(SUB.id);

    expect($('#notes-list script')).toBeNull();
    expect(window.PWNED).toBeUndefined();
  });

  it('refuses to save an empty note', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    open(SUB.id);

    $('#note-save').click();
    expect($('#note-status').textContent).toMatch(/nothing/i);
  });
});

describe('the notes view', () => {
  it('lists notes grouped by subtask', async () => {
    await mountApp({
      signedIn: true, enrolled: true, notes: [note('grouped here')]
    });

    const text = $('#notes-list-all').textContent;
    expect(text).toContain(SUB.title);
    expect(text).toContain('grouped here');
  });

  it('narrows as you type, and says so when nothing matches', async () => {
    await mountApp({
      signedIn: true, enrolled: true, notes: [note('findable')]
    });

    type('#notes-filter', 'findable');
    expect($$('#notes-list-all .note-row')).toHaveLength(1);

    type('#notes-filter', 'zzzznothing');
    expect($('#notes-list-all').textContent).toMatch(/no notes/i);
  });

  it('renders an honest empty state signed out, rather than a blank page', async () => {
    await mountApp();
    expect($('#notes-list-all').textContent).toMatch(/no notes/i);
  });

  it('opens the subtask from a resolved link in a note', async () => {
    await mountApp({
      signedIn: true, enrolled: true, notes: [note(`see [[${SUB.title}]]`)]
    });

    $(`#notes-list-all .note-link[data-subtask-id="${SUB.id}"]`).click();
    expect($('#sidebar-title').textContent).toContain(SUB.title);
  });

  it('leaves the page behind the sidebar intact', async () => {
    await mountApp({
      signedIn: true, enrolled: true, notes: [note(`see [[${SUB.title}]]`)]
    });

    $('#notes-list-all .note-link').click();
    expect($$('.view-panel.active')).toHaveLength(1);
  });

  it('sends a term link to the filtered term index', async () => {
    const term = PATH.terms[0].term;
    await mountApp({
      signedIn: true, enrolled: true, notes: [note(`about [[${term}]]`)]
    });

    $(`#notes-list-all .note-link[data-term="${term}"]`).click();

    expect($('#glossary-filter').value).toBe(term);
    expect(window.location.hash).toBe('#glossary');
  });
});
