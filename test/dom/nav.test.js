import { describe, it, expect } from 'vitest';
import { mountApp } from './harness.js';

const $ = sel => document.querySelector(sel);

describe('mobile nav drawer', () => {
  it('opens from the toggle and closes when a link is chosen', async () => {
    await mountApp();

    const toggle = $('.nav-toggle');
    const nav = $('.nav');
    expect(toggle).toBeTruthy();

    // Closed by default: the drawer must never cover content on load.
    expect(nav.classList.contains('nav-open')).toBe(false);

    toggle.click();
    expect(nav.classList.contains('nav-open')).toBe(true);

    toggle.click();
    expect(nav.classList.contains('nav-open')).toBe(false);

    // Hash navigation keeps the page alive, so the drawer has to close
    // itself — otherwise it sits on top of the view the user just picked.
    toggle.click();
    $('.nav a[href="#cards"]').click();
    expect(nav.classList.contains('nav-open')).toBe(false);
  });
});
