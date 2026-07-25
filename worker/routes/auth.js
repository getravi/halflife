import { randomToken, sha256Hex, readCookie, cookieHeader } from '../crypto.js';
import { authorizeUrl, exchangeCode, fetchUser } from '../github.js';
import {
  createSession, deleteSession, deleteExpiredSessions, upsertGithubUser
} from '../db.js';

const SESSION_COOKIE = 'flp_session';
const STATE_COOKIE = 'flp_oauth_state';
const SESSION_TTL = 30 * 86400000;
const STATE_TTL_SECONDS = 600;

const isHttps = request => new URL(request.url).protocol === 'https:';

const badRequest = (message, clearState) => new Response(
  JSON.stringify({ error: message }),
  {
    status: 400,
    headers: { 'content-type': 'application/json; charset=utf-8', 'set-cookie': clearState }
  }
);

export async function start(request, env) {
  const state = randomToken();
  return new Response(null, {
    status: 302,
    headers: {
      location: authorizeUrl(env, state),
      'set-cookie': cookieHeader(STATE_COOKIE, state, {
        maxAge: STATE_TTL_SECONDS, secure: isHttps(request)
      })
    }
  });
}

export async function callback(request, env) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const expected = readCookie(request, STATE_COOKIE);

  // The state cookie is single use, so it is cleared whatever happens next.
  const clearState = cookieHeader(STATE_COOKIE, '', { maxAge: 0, secure: isHttps(request) });

  // Without this check anyone can hand you a prepared callback URL that signs
  // you into their account, and every card you write afterwards is theirs.
  if (!expected || !state || state !== expected) {
    return badRequest('bad oauth state', clearState);
  }
  if (!code) return badRequest('missing code', clearState);

  const token = await exchangeCode(env, code);
  const profile = await fetchUser(token);
  // The access token has done its only job. It is never stored or logged.

  const now = Date.now();
  const user = await upsertGithubUser(env, profile, now);

  await deleteExpiredSessions(env, now);

  const sessionToken = randomToken();
  await createSession(env, user.id, await sha256Hex(sessionToken), now, SESSION_TTL,
    request.headers.get('user-agent'));

  // append twice: both Set-Cookie headers must survive. An object literal
  // would keep only the last, and the session cookie would be lost.
  const headers = new Headers({ location: env.APP_URL || '/' });
  headers.append('set-cookie', clearState);
  headers.append('set-cookie', cookieHeader(SESSION_COOKIE, sessionToken, {
    maxAge: SESSION_TTL / 1000, secure: isHttps(request)
  }));
  return new Response(null, { status: 302, headers });
}

export async function signout(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await deleteSession(env, await sha256Hex(token));

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': cookieHeader(SESSION_COOKIE, '', { maxAge: 0, secure: isHttps(request) })
    }
  });
}
