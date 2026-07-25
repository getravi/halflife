/**
 * Session resolution. This is the only place that decides who is asking.
 *
 * Returns null rather than throwing when there is no valid session, because
 * index.js turns null into a 401 and /api/me turns it into a signed-out body.
 */
import { readCookie, sha256Hex } from './crypto.js';
import { findSessionUser } from './db.js';

export async function getUser(request, env) {
  const token = readCookie(request, 'flp_session');
  if (!token) return null;
  return findSessionUser(env, await sha256Hex(token), Date.now());
}
