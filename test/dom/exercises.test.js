import { describe, it, expect } from 'vitest';
import { mountApp } from './harness.js';
import EXERCISES from '../../exercises/index.json';

const $ = sel => document.querySelector(sel);

const EX = EXERCISES['attention-einsum'];
const open = id => $(`.task-item[data-subtask-id="${id}"]`).click();

const box = nodeId => $(`.step-checkbox[data-node-id="${nodeId}"]`);

describe('the exercise panel', () => {
  it('appears on a gated subtask for someone signed in', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    open(EX.subtaskId);

    const block = $('#sidebar-body .exercise-block');
    expect(block).toBeTruthy();
    expect(block.textContent).toContain('Attention in einsum');
  });

  it('does not appear on an ordinary subtask', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    open('p0-python-fluency-s01');
    expect($('#sidebar-body .exercise-block')).toBeNull();
  });

  it('is hidden from someone signed out, like all user data', async () => {
    await mountApp();
    open(EX.subtaskId);
    expect($('#sidebar-body .exercise-block')).toBeNull();
  });

  it('links to the notebook in Colab', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    open(EX.subtaskId);

    const link = $('#sidebar-body .exercise-block a');
    expect(link.href).toContain('colab.research.google.com/github/getravi/halflife');
    expect(link.href).toContain(EX.notebook);
  });

  it('shows the last attempt', async () => {
    await mountApp({
      signedIn: true, enrolled: true,
      attempts: [{ exercise_id: 'attention-einsum', passed: 3, total: 5, ran_at: 1 }]
    });
    open(EX.subtaskId);

    expect($('#sidebar-body .exercise-status').textContent).toContain('3 / 5');
  });

  it('disables the graded checkbox, which the route refuses anyway', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    open(EX.subtaskId);

    expect(box(EX.gatedNodeId).disabled).toBe(true);
  });

  it('leaves the other steps of the same subtask tickable', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    open(EX.subtaskId);

    expect(box(`${EX.subtaskId}-01`).disabled).toBe(false);
  });

  it('shows the graded step ticked when it has been earned', async () => {
    await mountApp({
      signedIn: true, enrolled: true,
      progress: [EX.gatedNodeId]
    });
    open(EX.subtaskId);

    // Disabled, not hidden: you still need to see that you passed it.
    const cb = box(EX.gatedNodeId);
    expect(cb.checked).toBe(true);
    expect(cb.disabled).toBe(true);
  });
});

describe('the token panel', () => {
  it('reveals a token on mint and hides it again on revoke', async () => {
    await mountApp({ signedIn: true, enrolled: true });

    expect($('#token-value').hidden).toBe(true);

    $('#token-mint').click();
    await new Promise(r => setTimeout(r, 0));
    expect($('#token-value').hidden).toBe(false);
    // The actual token, not the string "undefined" — which is what this
    // rendered before the harness answered the mint route.
    expect($('#token-value').value).toBe('test-token-abc123');
    expect($('#token-status').textContent).toMatch(/not shown again/i);

    $('#token-revoke').click();
    await new Promise(r => setTimeout(r, 0));
    expect($('#token-value').hidden).toBe(true);
  });
});
