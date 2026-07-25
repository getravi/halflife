import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '../helpers.js';

import * as db from '../../worker/db.js';
import { sha256Hex } from '../../worker/crypto.js';

const AUTH_DAY = 86400000;
let COOKIE;

async function signInAs(userId = 'u1') {
  await env.DB.prepare('INSERT INTO users (id, login, created_at) VALUES (?, ?, 0)')
    .bind(userId, userId).run();
  await db.createSession(env, userId, await sha256Hex(`tok-${userId}`),
    Date.now(), 30 * AUTH_DAY, 'test');
  return `flp_session=tok-${userId}`;
}

// Every request in this file goes through a real session now. Before auth
// landed these tests passed because the app authenticated nobody.
const api = (path, init = {}) => SELF.fetch(`https://x${path}`, {
  ...init,
  headers: { ...(init.headers ?? {}), cookie: COOKIE }
});


const put = (body) => api('/api/progress', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

describe('progress routes', () => {
  beforeEach(async () => {
    await resetDb();
    COOKIE = await signInAs();
  });

  it('round-trips a tick', async () => {
    expect((await put({ pathId: 'p', nodeId: 'n1', done: true })).status).toBe(200);
    const res = await api('/api/progress?pathId=p');
    expect(await res.json()).toEqual({ nodeIds: ['n1'] });
  });

  it('unticking removes it, because progress is presence rather than a flag', async () => {
    await put({ pathId: 'p', nodeId: 'n1', done: true });
    await put({ pathId: 'p', nodeId: 'n1', done: false });
    const res = await api('/api/progress?pathId=p');
    expect(await res.json()).toEqual({ nodeIds: [] });
  });

  it('ticking twice is idempotent rather than a constraint error', async () => {
    await put({ pathId: 'p', nodeId: 'n1', done: true });
    expect((await put({ pathId: 'p', nodeId: 'n1', done: true })).status).toBe(200);
    const res = await api('/api/progress?pathId=p');
    expect(await res.json()).toEqual({ nodeIds: ['n1'] });
  });

  it('scopes reads by path, so two paths cannot bleed into each other', async () => {
    await put({ pathId: 'p', nodeId: 'n1', done: true });
    const res = await api('/api/progress?pathId=other');
    expect(await res.json()).toEqual({ nodeIds: [] });
  });

  it('rejects a missing pathId rather than writing an orphan row', async () => {
    expect((await put({ nodeId: 'n1', done: true })).status).toBe(400);
  });

  it('rejects a non-boolean done, because a string "false" is truthy and would tick it', async () => {
    expect((await put({ pathId: 'p', nodeId: 'n1', done: 'false' })).status).toBe(400);
  });

  it('404s an unknown api route instead of falling through to assets', async () => {
    expect((await api('/api/nope')).status).toBe(404);
  });
});
