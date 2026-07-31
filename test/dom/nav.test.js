import { describe, it, expect } from 'vitest';
import { mountApp } from './harness.js';

const $ = sel => document.querySelector(sel);

describe('app nav', () => {
  it('is inline on every viewport: no drawer, no toggle', async () => {
    await mountApp();
    expect($('.nav-toggle')).toBeFalsy();
    expect($('.nav a[href="#paths"]')).toBeTruthy();
  });
});

describe('path bar visibility', () => {
  it('hides on app-level views and shows inside a path', async () => {
    await mountApp();

    window.location.hash = '#paths';
    window.dispatchEvent(new Event('hashchange'));
    expect($('#path-bar').hidden).toBe(true);

    window.location.hash = '#cards';
    window.dispatchEvent(new Event('hashchange'));
    expect($('#path-bar').hidden).toBe(false);
    expect($('.path-bar a[href="#cards"]').classList.contains('active')).toBe(true);

    window.location.hash = '#settings';
    window.dispatchEvent(new Event('hashchange'));
    expect($('#path-bar').hidden).toBe(true);
  });
});
