import { describe, it, expect } from 'vitest';
import { mountApp, cardFor } from './harness.js';
// Imported directly rather than read back from mountApp: the ids are needed to
// build the state passed *into* it.
import path from '../../paths/frontier-lab.json';

const $$ = sel => [...document.querySelectorAll(sel)];
const $ = sel => document.querySelector(sel);

const FIRST_SUBTASK = path.phases[0].tasks[0].subtasks[0];

describe('boot, signed out', () => {
  it('renders the whole curriculum, because the path is public', async () => {
    await mountApp();

    const tasks = path.phases.flatMap(p => p.tasks);
    const subtasks = tasks.flatMap(t => t.subtasks);

    expect($$('.day-section')).toHaveLength(tasks.length);       // 36
    expect($$('.task-item')).toHaveLength(subtasks.length);      // 158
  });

  it('builds a path-bar link per phase', async () => {
    await mountApp();
    for (const ph of path.phases) {
      expect($(`.path-bar a[href="#${ph.id}"]`)).toBeTruthy();
    }
  });

  it('offers sign-in rather than pretending there is nothing to show', async () => {
    await mountApp();
    expect($('.auth-signin')).toBeTruthy();
    expect($('#today-week').textContent).toMatch(/sign in/i);
  });

  it('never writes: it does not ask for progress or cards at all', async () => {
    const { requests } = await mountApp();
    const urls = requests.map(r => r.url).join(' ');
    expect(urls).not.toMatch(/api\/progress/);
    expect(urls).not.toMatch(/api\/cards/);
  });

  it('lands on the catalogue, which is the homepage', async () => {
    await mountApp();
    expect(window.location.hash).toBe('#paths');
  });

  it('offers a read-only view link into the path, not an enrol button', async () => {
    await mountApp();
    const link = $('#paths-list a[href^="/?path=frontier-lab#"]');
    expect(link).toBeTruthy();
    expect(link.textContent).toBe('View path');
    expect($('#paths-list .path-enrol')).toBeFalsy();
  });
});

describe('boot, signed in and enrolled', () => {
  it('shows both progress numbers', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    expect($('#today-covered').textContent).toMatch(/%$/);
    expect($('#today-retained').textContent).toMatch(/%$/);
  });

  it('reports the plan week rather than a sign-in prompt', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    expect($('#today-week').textContent).toMatch(/week/i);
  });

  it('counts a due card and enables the review button', async () => {
    await mountApp({
      signedIn: true, enrolled: true,
      cards: [cardFor(FIRST_SUBTASK.id)]
    });
    expect($('#today-due-count').textContent).toBe('1');
    expect($('#today-start-review').disabled).toBe(false);
  });

  it('renders the capture debt panel', async () => {
    await mountApp({
      signedIn: true, enrolled: true,
      progress: [FIRST_SUBTASK.steps[0].id]
    });
    expect($('#today-debt')).toBeTruthy();
  });
});

describe('boot, signed in without an enrolment', () => {
  it('lands on the picker', async () => {
    await mountApp({ signedIn: true, enrolled: false });
    expect(window.location.hash).toBe('#paths');
  });

  it('lists the catalogue with an enrol button', async () => {
    await mountApp({ signedIn: true, enrolled: false });
    expect($('#paths-list .path-enrol')).toBeTruthy();
  });
});
