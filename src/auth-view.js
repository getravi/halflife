/**
 * Sign-in, sign-up, forgotten password, and the unverified screen.
 *
 * Better Auth is a server dependency only — this talks to its routes with
 * plain fetch, so the bundle stays small and the project keeps exactly one
 * runtime dependency.
 */
import { API } from './api.js';
import { me } from './auth.js';

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const githubButton = (providers) => providers?.github
  // Rendered only when both credentials are configured. A button that 500s
  // reads as a bug in the app; a missing one reads as a feature not set up.
  ? `<div class="settings-actions">
       <button class="capture-skip" id="auth-github">Continue with GitHub</button>
     </div>`
  : '';

const form = (mode, providers) => `
  <div class="today-block-title">${mode === 'up' ? 'Create an account' : 'Sign in'}</div>
  <label class="capture-label">Email</label>
  <input class="capture-input" id="auth-email" type="email" autocomplete="email">
  <label class="capture-label">Password</label>
  <input class="capture-input" id="auth-password" type="password"
         autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}">
  <div class="settings-actions">
    <button class="today-review-btn" id="auth-submit">
      ${mode === 'up' ? 'Sign up' : 'Sign in'}</button>
    <button class="capture-skip" id="auth-toggle">
      ${mode === 'up' ? 'I already have an account' : 'Create an account'}</button>
    <span class="capture-status" id="auth-status"></span>
  </div>
  ${mode === 'in'
    ? `<div class="settings-actions">
         <button class="capture-skip" id="auth-forgot">Forgot password</button>
       </div>`
    : ''}
  ${githubButton(providers)}`;

const unverified = (email) => `
  <div class="today-block-title">Check your inbox</div>
  <p class="settings-note">A verification link is on its way to
    <strong>${esc(email)}</strong>. You can read the whole plan now; tracking
    progress and writing cards start once the address is confirmed.</p>
  <div class="settings-actions">
    <button class="capture-skip" id="auth-resend">Send it again</button>
    <span class="capture-status" id="auth-resend-status"></span>
  </div>`;

export function renderAuthView(onChanged) {
  const panel = document.getElementById('auth-panel');
  if (!panel) return;

  const current = me();

  if (current.user && !current.user.emailVerified) {
    panel.innerHTML = unverified(current.user.email);

    // Without this a failed send is unrecoverable: the account exists, the
    // address is taken, and no link ever arrived.
    document.getElementById('auth-resend').addEventListener('click', async () => {
      const status = document.getElementById('auth-resend-status');
      status.textContent = 'Sending…';
      await API.resendVerification(current.user.email).catch(() => {});
      status.textContent = 'Sent. Check your inbox again.';
    });
    return;
  }

  if (current.user) {
    panel.innerHTML =
      `<div class="today-block-title">Signed in</div>
       <p class="settings-note">You are signed in as
         <strong>${esc(current.user.email)}</strong>.</p>`;
    return;
  }

  let mode = 'in';

  function paint() {
    panel.innerHTML = form(mode, current.providers);

    document.getElementById('auth-toggle').addEventListener('click', () => {
      mode = mode === 'in' ? 'up' : 'in';
      paint();
    });

    document.getElementById('auth-submit').addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const status = document.getElementById('auth-status');

      if (!email || !password) {
        status.textContent = 'Email and password, both.';
        return;
      }

      status.textContent = mode === 'up' ? 'Creating…' : 'Signing in…';
      try {
        if (mode === 'up') await API.signUp(email, password);
        else await API.signIn(email, password);
        await onChanged();
      } catch {
        // Deliberately the same message for a wrong password and an unknown
        // address: distinguishing them tells a stranger which emails have
        // accounts here.
        status.textContent = mode === 'up'
          ? 'Could not create that account.'
          : 'That email and password do not match.';
      }
    });

    const github = document.getElementById('auth-github');
    if (github) {
      github.addEventListener('click', async () => {
        const res = await API.signInWithGithub().catch(() => null);
        // Better Auth answers with the URL to send the browser to.
        if (res?.url) window.location.href = res.url;
      });
    }

    const forgot = document.getElementById('auth-forgot');
    if (forgot) {
      forgot.addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value.trim();
        const status = document.getElementById('auth-status');
        if (!email) { status.textContent = 'Enter your email first.'; return; }
        await API.forgotPassword(email).catch(() => {});
        // Always the same answer, for the same reason as above.
        status.textContent = 'If that address has an account, a reset link is on its way.';
      });
    }
  }

  paint();
}
