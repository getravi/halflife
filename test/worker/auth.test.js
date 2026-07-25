import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '../helpers.js';
import * as db from '../../worker/db.js';
import { sha256Hex } from '../../worker/crypto.js';

const DAY = 86400000;

async function signIn(userId = 'u1') {
  await env.DB.prepare('INSERT INTO users (id, login, created_at) VALUES (?, ?, 0)')
    .bind(userId, userId).run();
  const token = `tok-${userId}`;
  await db.createSession(env, userId, await sha256Hex(token), Date.now(), 30 * DAY, 'test');
  return `flp_session=${token}`;
}

const withCookie = (path, cookie, init = {}) =>
  SELF.fetch(`https://x${path}`, { ...init, headers: { ...(init.headers ?? {}), cookie } });

describe('session resolution', () => {
  beforeEach(resetDb);

  it('401s a protected route with no cookie at all', async () => {
    expect((await SELF.fetch('https://x/api/cards?pathId=p')).status).toBe(401);
  });

  it('401s a protected route with a cookie that was never issued', async () => {
    expect((await withCookie('/api/cards?pathId=p', 'flp_session=made-up')).status).toBe(401);
  });

  it('allows a protected route with a live session', async () => {
    const cookie = await signIn();
    expect((await withCookie('/api/cards?pathId=p', cookie)).status).toBe(200);
  });

  it('401s once the session has expired', async () => {
    await env.DB.prepare('INSERT INTO users (id, login, created_at) VALUES (?, ?, 0)')
      .bind('u1', 'u1').run();
    await db.createSession(env, 'u1', await sha256Hex('tok'), Date.now() - 2 * DAY, DAY, 't');
    expect((await withCookie('/api/cards?pathId=p', 'flp_session=tok')).status).toBe(401);
  });
});

describe('public routes', () => {
  beforeEach(resetDb);

  it('answers /api/me with a null user instead of 401, so the frontend branches on state', async () => {
    const res = await SELF.fetch('https://x/api/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null, enrollments: [] });
  });

  it('answers /api/me with the user when signed in', async () => {
    const cookie = await signIn();
    const body = await (await withCookie('/api/me', cookie)).json();
    expect(body.user.id).toBe('u1');
  });
});

describe('sign-in start', () => {
  beforeEach(resetDb);

  it('redirects to GitHub and plants a state cookie', async () => {
    const res = await SELF.fetch('https://x/api/auth/github', { redirect: 'manual' });
    expect(res.status).toBe(302);

    const location = new URL(res.headers.get('location'));
    expect(location.host).toBe('github.com');
    const state = location.searchParams.get('state');
    expect(state).toBeTruthy();

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain(`flp_oauth_state=${state}`);
    expect(setCookie).toMatch(/HttpOnly/);
  });
});

describe('callback CSRF', () => {
  beforeEach(resetDb);

  it('rejects a callback with no state cookie, because that is a forged sign-in', async () => {
    const res = await SELF.fetch('https://x/api/auth/callback?code=c&state=s',
      { redirect: 'manual' });
    expect(res.status).toBe(400);
  });

  it('rejects a state that does not match the cookie', async () => {
    const res = await withCookie('/api/auth/callback?code=c&state=attacker',
      'flp_oauth_state=mine', { redirect: 'manual' });
    expect(res.status).toBe(400);
  });

  it('rejects a callback with no state parameter', async () => {
    const res = await withCookie('/api/auth/callback?code=c',
      'flp_oauth_state=mine', { redirect: 'manual' });
    expect(res.status).toBe(400);
  });

  it('does not create a session when the state check fails', async () => {
    await withCookie('/api/auth/callback?code=c&state=attacker',
      'flp_oauth_state=mine', { redirect: 'manual' });
    const { results } = await env.DB.prepare('SELECT * FROM sessions').all();
    expect(results).toHaveLength(0);
  });
});

describe('sign out', () => {
  beforeEach(resetDb);

  it('deletes the session so the same cookie stops working', async () => {
    const cookie = await signIn();
    expect((await withCookie('/api/cards?pathId=p', cookie)).status).toBe(200);

    const out = await withCookie('/api/auth/signout', cookie, { method: 'POST' });
    expect(out.status).toBe(200);
    expect(out.headers.get('set-cookie')).toMatch(/Max-Age=0/);

    expect((await withCookie('/api/cards?pathId=p', cookie)).status).toBe(401);
  });

  it('leaves another user signed in', async () => {
    const a = await signIn('u1');
    const b = await signIn('u2');
    await withCookie('/api/auth/signout', a, { method: 'POST' });
    expect((await withCookie('/api/cards?pathId=p', b)).status).toBe(200);
  });
});
