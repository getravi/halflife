/**
 * Session state and the header. The signed-out branch is not an error state:
 * a visitor can read the whole curriculum, they simply cannot write to it.
 */
import { API } from './api.js';

let current = { user: null, enrollments: [] };

export function setMe(me) {
  current = me ?? { user: null, enrollments: [] };
}

export function me() {
  return current;
}

/**
 * Signed in AND verified. Everything that gates writing calls this, and an
 * unverified account must not be able to tick a step or capture a card.
 */
export function isSignedIn() {
  return Boolean(current.user?.emailVerified);
}

export function renderHeader() {
  const slot = document.getElementById('auth-slot');
  if (!slot) return;

  if (!current.user) {
    slot.innerHTML = `<a class="auth-signin" href="#account">Sign in</a>`;
    return;
  }

  const { email, emailVerified } = current.user;
  slot.innerHTML = `
    <span class="auth-login">${email ?? ''}</span>
    ${emailVerified ? '' : '<a class="auth-signin" href="#account">verify</a>'}
    <button class="auth-signout" id="auth-signout">Sign out</button>`;

  document.getElementById('auth-signout').addEventListener('click', async () => {
    await API.signout();
    window.location.href = '/';
  });
}
