import { describe, it, expect } from 'vitest';
import { mountApp, cardFor } from './harness.js';
import path from '../../paths/frontier-lab.json';

const $ = sel => document.querySelector(sel);

const FIRST_SUBTASK_ID = path.phases[0].tasks[0].subtasks[0].id;

async function withOneCard() {
  const { requests } = await mountApp({
    signedIn: true, enrolled: true,
    cards: [cardFor(FIRST_SUBTASK_ID,
      { id: 'c1', prompt: 'old question', answer: 'old answer' })]
  });
  return { requests, cardId: 'c1' };
}

describe('the card list', () => {
  it('renders the card with its text', async () => {
    await withOneCard();
    expect($('#cards-list').textContent).toContain('old question');
    expect($('#cards-list').textContent).toContain('old answer');
  });

  it('swaps the row for an editor holding the current text', async () => {
    await withOneCard();
    $('[data-action="edit"]').click();

    expect($('[data-field="prompt"]').value).toBe('old question');
    expect($('[data-field="answer"]').value).toBe('old answer');
    expect($('.card-display').hidden).toBe(true);
  });

  it('cancel puts the row back without sending anything', async () => {
    const { requests } = await withOneCard();
    const before = requests.length;

    $('[data-action="edit"]').click();
    $('[data-action="cancel"]').click();

    expect($('.card-edit')).toBeNull();
    expect($('.card-display').hidden).toBe(false);
    expect(requests).toHaveLength(before);
  });

  it('saving patches the card with the new text', async () => {
    const { requests, cardId } = await withOneCard();

    $('[data-action="edit"]').click();
    $('[data-field="prompt"]').value = 'new question';
    $('[data-field="answer"]').value = 'new answer';
    $('[data-action="save"]').click();
    await new Promise(r => setTimeout(r, 0));

    const patch = requests.find(r => r.method === 'PATCH');
    expect(patch).toBeTruthy();
    expect(patch.body).toMatchObject({
      cardId, prompt: 'new question', answer: 'new answer'
    });
  });

  it('refuses to save an empty field rather than patching a blank card', async () => {
    const { requests } = await withOneCard();

    $('[data-action="edit"]').click();
    $('[data-field="prompt"]').value = '';
    $('[data-action="save"]').click();
    await new Promise(r => setTimeout(r, 0));

    expect(requests.find(r => r.method === 'PATCH')).toBeUndefined();
  });

  it('deleting takes two clicks, and the first one sends nothing', async () => {
    const { requests } = await withOneCard();
    const before = requests.length;

    $('[data-action="delete"]').click();
    expect($('[data-action="confirm-delete"]')).toBeTruthy();
    expect(requests).toHaveLength(before);
  });

  it('saying no puts the delete button back', async () => {
    await withOneCard();
    $('[data-action="delete"]').click();
    $('[data-action="cancel-delete"]').click();

    expect($('[data-action="delete"]')).toBeTruthy();
    expect($('[data-action="confirm-delete"]')).toBeNull();
  });

  it('confirming sends the delete', async () => {
    const { requests, cardId } = await withOneCard();

    $('[data-action="delete"]').click();
    $('[data-action="confirm-delete"]').click();
    await new Promise(r => setTimeout(r, 0));

    const del = requests.find(r => r.method === 'DELETE');
    expect(del).toBeTruthy();
    expect(del.url).toContain(cardId);
  });
});
