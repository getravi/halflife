import { describe, it, expect } from 'vitest';
import { mountApp } from './harness.js';

const $ = sel => document.querySelector(sel);

describe('signed out', () => {
  it('offers sign-in from the header', async () => {
    await mountApp();
    expect($('.auth-signin')).toBeTruthy();
  });

  it('shows a sign-in form on the account panel', async () => {
    await mountApp();
    expect($('#auth-email')).toBeTruthy();
    expect($('#auth-password')).toBeTruthy();
  });

  it('can switch to the sign-up form and back', async () => {
    await mountApp();
    $('#auth-toggle').click();
    expect($('#auth-submit').textContent).toMatch(/sign up/i);
    $('#auth-toggle').click();
    expect($('#auth-submit').textContent).toMatch(/sign in/i);
  });

  it('posts to the sign-in route with what was typed', async () => {
    const { requests } = await mountApp();
    $('#auth-email').value = 'someone@example.com';
    $('#auth-password').value = 'a-password';
    $('#auth-submit').click();
    await new Promise(r => setTimeout(r, 0));

    const post = requests.find(r => r.url.includes('/api/auth/sign-in/email'));
    expect(post).toBeTruthy();
    expect(post.body).toMatchObject({ email: 'someone@example.com', password: 'a-password' });
  });

  it('posts to the sign-up route when creating an account', async () => {
    const { requests } = await mountApp();
    $('#auth-toggle').click();
    $('#auth-email').value = 'new@example.com';
    $('#auth-password').value = 'a-password';
    $('#auth-submit').click();
    await new Promise(r => setTimeout(r, 0));

    expect(requests.some(r => r.url.includes('/api/auth/sign-up/email'))).toBe(true);
  });

  it('refuses to submit an empty form rather than posting blanks', async () => {
    const { requests } = await mountApp();
    $('#auth-submit').click();
    await new Promise(r => setTimeout(r, 0));

    expect($('#auth-status').textContent).toMatch(/both/i);
    expect(requests.find(r => r.url.includes('/api/auth/sign-in'))).toBeUndefined();
  });

  it('hides the GitHub button when no credentials are configured', async () => {
    await mountApp();
    expect($('#auth-github')).toBeNull();
  });

  it('shows it when they are, because then it can actually work', async () => {
    await mountApp({ providers: { github: true } });
    expect($('#auth-github')).toBeTruthy();
  });
});

describe('signed in but unverified', () => {
  const unverified = { signedIn: true, verified: false, enrolled: true };

  it('lands on the account panel rather than Today', async () => {
    await mountApp(unverified);
    expect(window.location.hash).toBe('#account');
  });

  it('says to check the inbox, and names the address', async () => {
    await mountApp(unverified);
    expect($('#auth-panel').textContent).toMatch(/check your inbox/i);
    expect($('#auth-panel').textContent).toContain('ravi@example.com');
  });

  it('still renders the whole curriculum, because reading was never gated', async () => {
    await mountApp(unverified);
    expect(document.querySelectorAll('.task-item').length).toBeGreaterThan(100);
  });

  it('cannot write: every step checkbox is disabled', async () => {
    const { path } = await mountApp(unverified);
    const id = path.phases[0].tasks[0].subtasks[0].id;
    $(`.task-item[data-subtask-id="${id}"]`).click();

    const boxes = [...document.querySelectorAll('#sidebar-body .step-checkbox')];
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.every(b => b.disabled)).toBe(true);
  });

  it('never asks for progress or cards it is not allowed to change', async () => {
    const { requests } = await mountApp(unverified);
    const urls = requests.map(r => r.url).join(' ');
    expect(urls).not.toMatch(/api\/progress/);
    expect(urls).not.toMatch(/api\/cards/);
  });
});

describe('signed in and verified', () => {
  it('lands on the paths homepage even when enrolled — the app is its paths', async () => {
    await mountApp({ signedIn: true, verified: true, enrolled: true });
    expect(window.location.hash).toBe('#paths');
  });

  it('shows the email in the header', async () => {
    await mountApp({ signedIn: true, verified: true, enrolled: true });
    expect($('.auth-login').textContent).toContain('ravi@example.com');
  });
});
