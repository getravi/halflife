import { describe, it, expect } from 'vitest';
import { mountApp, cardFor } from './harness.js';
import path from '../../paths/frontier-lab.json';

const $ = sel => document.querySelector(sel);

const press = (key, opts = {}) => {
  const target = opts.target ?? document.body;
  target.dispatchEvent(new KeyboardEvent('keydown', {
    key, bubbles: true, cancelable: true, ...opts
  }));
};

const FIRST_SUBTASK = path.phases[0].tasks[0].subtasks[0];

async function openRunner(extra = {}) {
  const { requests } = await mountApp({
    signedIn: true, enrolled: true,
    cards: [cardFor(FIRST_SUBTASK.id,
      { prompt: 'the question', answer: 'the answer', ...extra })]
  });

  $('#today-start-review').click();
  await new Promise(r => setTimeout(r, 0));
  return { requests };
}

describe('the runner opens', () => {
  it('shows the prompt and hides the answer until asked', async () => {
    await openRunner();
    expect($('#runner').hidden).toBe(false);
    expect($('#runner-prompt').textContent).toBe('the question');
    expect($('#runner-answer').hidden).toBe(true);
    expect($('#runner-grades').hidden).toBe(true);
  });
});

describe('keyboard control', () => {
  it('reveals on space', async () => {
    await openRunner();
    press(' ');
    expect($('#runner-answer').hidden).toBe(false);
    expect($('#runner-grades').hidden).toBe(false);
  });

  it('ignores a digit before reveal, so a stray key cannot grade an unseen card', async () => {
    const { requests } = await openRunner();
    press('3');
    expect($('#runner-answer').hidden).toBe(true);
    expect(requests.filter(r => r.url.includes('/api/reviews'))).toHaveLength(0);
  });

  it('grades good on 3 once revealed', async () => {
    const { requests } = await openRunner();
    press(' ');
    press('3');
    await new Promise(r => setTimeout(r, 0));

    const post = requests.find(r => r.url.includes('/api/reviews'));
    expect(post).toBeTruthy();
    expect(post.body.grade).toBe('good');
  });

  it('types a space into the recall box instead of revealing, which is the whole reason for the keymap', async () => {
    await openRunner();
    const box = $('#runner-recall');
    box.focus();
    press(' ', { target: box });
    expect($('#runner-answer').hidden).toBe(true);
  });

  it('reveals from inside the box on cmd-enter', async () => {
    await openRunner();
    const box = $('#runner-recall');
    box.focus();
    press('Enter', { target: box, metaKey: true });
    expect($('#runner-answer').hidden).toBe(false);
  });

  it('escape leaves the box before it closes the runner', async () => {
    await openRunner();
    const box = $('#runner-recall');
    box.focus();

    press('Escape', { target: box });
    expect($('#runner').hidden).toBe(false);   // still open, just blurred

    press('Escape');
    expect($('#runner').hidden).toBe(true);
  });
});
