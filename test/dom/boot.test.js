import { describe, it, expect } from 'vitest';
import { mountApp } from './harness.js';

describe('harness', () => {
  it('boots and actually renders the plan', async () => {
    await mountApp();
    // Not merely "did not throw": six sub-projects of boot code have never
    // run, so the assertion has to be that something appeared.
    expect(document.querySelectorAll('.day-section').length).toBeGreaterThan(0);
  });
});
