import { json } from '../http.js';
import { upsertToken, deleteToken } from '../db.js';

const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * SHA-256 hex. The token is shown once and then only its digest exists, so
 * losing the database loses no working credential.
 */
export async function hashToken(raw) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function mint(request, env, user) {
  const raw = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await upsertToken(env, user.id, await hashToken(raw), Date.now());

  // Returned once and never again: there is nothing to return it from later.
  return json({ token: raw });
}

export async function revoke(request, env, user) {
  await deleteToken(env, user.id);
  return json({ ok: true });
}
