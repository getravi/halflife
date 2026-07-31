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
    <div class="user-menu">
      <button class="user-menu-btn auth-login" id="user-menu-btn">${email ?? ''} &#9662;</button>
      <div class="user-menu-list" id="user-menu-list" hidden>
        <a href="#settings">Settings</a>
        <a href="#account">Account${emailVerified ? '' : ' &middot; verify'}</a>
        <button class="auth-signout" id="auth-signout">Sign out</button>
      </div>
    </div>`;

  const btn = document.getElementById('user-menu-btn');
  const list = document.getElementById('user-menu-list');
  btn.addEventListener('click', () => { list.hidden = !list.hidden; });
  // A menu that stays open over content is worse than no menu: close on any
  // choice and on any click that lands outside it.
  list.addEventListener('click', e => {
    if (e.target.closest('a')) list.hidden = true;
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.user-menu')) list.hidden = true;
  });

  document.getElementById('auth-signout').addEventListener('click', async () => {
    await API.signout();
    window.location.href = '/';
  });
}
