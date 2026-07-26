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

export function isSignedIn() {
  return Boolean(current.user);
}

export function renderHeader() {
  const slot = document.getElementById('auth-slot');
  if (!slot) return;

  if (!current.user) {
    slot.innerHTML =
      `<a class="auth-signin" href="/api/auth/github">Sign in with GitHub</a>`;
    return;
  }

  const { login, avatarUrl } = current.user;
  slot.innerHTML = `
    ${avatarUrl ? `<img class="auth-avatar" src="${avatarUrl}" alt="">` : ''}
    <span class="auth-login">${login ?? ''}</span>
    <button class="auth-signout" id="auth-signout">Sign out</button>`;

  document.getElementById('auth-signout').addEventListener('click', async () => {
    await API.signout();
    window.location.href = '/';
  });
}
