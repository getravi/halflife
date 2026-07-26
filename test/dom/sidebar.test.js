import { describe, it, expect } from 'vitest';
import { mountApp, cardFor } from './harness.js';
import PATH from '../../paths/frontier-lab.json';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const FIRST = PATH.phases[0].tasks[0].subtasks[0];

function openFirst() {
  $(`.task-item[data-subtask-id="${FIRST.id}"]`).click();
  return FIRST;
}

describe('opening the sidebar', () => {
  it('shows that subtask, its description and one checkbox per step', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    const s = openFirst();

    expect($('#sidebar-title').textContent).toContain(s.title);
    expect($('#sidebar-body').textContent).toContain(s.desc.slice(0, 30));
    expect($$('#sidebar-body .step-checkbox')).toHaveLength(s.steps.length);
  });

  it('lists the resources that subtask carries', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    const s = openFirst();

    const urls = Object.values(s.resources ?? {}).flat().map(r => r.url);
    if (!urls.length) return;                 // some subtasks legitimately have none
    expect($('#sidebar-body').innerHTML).toContain(urls[0]);
  });

  it('disables every checkbox when signed out, so the page is readable and not writable', async () => {
    await mountApp();
    openFirst();
    const boxes = $$('#sidebar-body .step-checkbox');
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.every(b => b.disabled)).toBe(true);
  });
});

describe('capture on finish', () => {
  async function finishFirstSubtask(state = {}) {
    const { requests } = await mountApp({ signedIn: true, enrolled: true, ...state });
    openFirst();
    for (const box of $$('#sidebar-body .step-checkbox')) {
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 0));
    }
    await new Promise(r => setTimeout(r, 0));
    return { requests };
  }

  it('raises the form once the last step is ticked', async () => {
    await finishFirstSubtask();
    expect($('.capture-form')).toBeTruthy();
  });

  it('does not raise it when a card for that subtask already exists', async () => {
    await finishFirstSubtask({ cards: [cardFor(FIRST.id)] });
    expect($('.capture-form')).toBeNull();
  });

  it('refuses to save with an empty field rather than posting a blank card', async () => {
    const { requests } = await finishFirstSubtask();
    $('#capture-answer').value = 'something';
    $('#capture-prompt').value = '';
    $('#capture-save').click();
    await new Promise(r => setTimeout(r, 0));

    expect($('#capture-status').textContent).toMatch(/both fields/i);
    expect(requests.filter(r => r.method === 'POST' && r.url.includes('/api/cards')))
      .toHaveLength(0);
  });

  it('posts the subtask id along with the text, because that anchor is what Retained counts', async () => {
    const { requests } = await finishFirstSubtask();
    $('#capture-answer').value = 'the answer';
    $('#capture-prompt').value = 'the question';
    $('#capture-save').click();
    await new Promise(r => setTimeout(r, 0));

    const post = requests.find(r => r.method === 'POST' && r.url.includes('/api/cards'));
    expect(post).toBeTruthy();
    expect(post.body).toMatchObject({
      pathId: 'frontier-lab',
      subtaskId: FIRST.id,
      prompt: 'the question',
      answer: 'the answer'
    });
  });
});
