import { describe, it, expect } from 'vitest';
import { mountApp } from './harness.js';

// Browser APIs happy-dom lacks. Their absence is an environment gap, not a
// defect in the app, so they are stubbed rather than worked around in source.
globalThis.URL.createObjectURL ??= () => 'blob:stub';
globalThis.URL.revokeObjectURL ??= () => {};

const $ = sel => document.querySelector(sel);

const type = (el, value) => {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('deleting an account', () => {
  it('starts disabled', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    expect($('#delete-account').disabled).toBe(true);
  });

  it('stays disabled for a near miss, because this cascades through four tables', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    type($('#delete-confirm'), 'ravi@exampl');
    expect($('#delete-account').disabled).toBe(true);

    type($('#delete-confirm'), 'Ravi@example.com');
    expect($('#delete-account').disabled).toBe(true);
  });

  it('enables only on an exact match of the email', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    type($('#delete-confirm'), 'ravi@example.com');
    expect($('#delete-account').disabled).toBe(false);
  });

  it('disables again if the text is changed back', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    type($('#delete-confirm'), 'ravi@example.com');
    type($('#delete-confirm'), 'ravi@example.comx');
    expect($('#delete-account').disabled).toBe(true);
  });
});

describe('export', () => {
  it('requests the export when JSON is pressed', async () => {
    const { requests } = await mountApp({ signedIn: true, enrolled: true });
    $('#export-json').click();
    await new Promise(r => setTimeout(r, 0));

    expect(requests.some(r => r.url.includes('/api/export'))).toBe(true);
  });

  it('says so rather than downloading nothing when the server cannot be reached', async () => {
    await mountApp({ signedIn: true, enrolled: true });
    globalThis.fetch = async () => { throw new Error('offline'); };

    $('#export-json').click();
    await new Promise(r => setTimeout(r, 0));

    expect($('#export-status').textContent).toMatch(/could not reach/i);
  });
});

describe('settings when signed out', () => {
  it('says who we do not know, rather than showing an empty panel', async () => {
    await mountApp();
    expect($('#view-settings').textContent).toMatch(/sign in/i);
  });
});
