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


const enrol = (body) => api('/api/enrollments', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

describe('me and enrolment', () => {
  beforeEach(async () => {
    await resetDb();
    COOKIE = await signInAs();
  });

  it('reports the signed-in user with no enrolments initially', async () => {
    const body = await (await api('/api/me')).json();
    expect(body.user.login).toBe('u1');
    expect(body.enrollments).toEqual([]);
  });

  it('enrolling records the start date the plan week is derived from', async () => {
    expect((await enrol({ pathId: 'frontier-lab', startedOn: '2026-07-25' })).status).toBe(200);
    const body = await (await api('/api/me')).json();
    expect(body.enrollments).toEqual([{ pathId: 'frontier-lab', startedOn: '2026-07-25' }]);
  });

  it('re-enrolling updates the date rather than erroring on the primary key', async () => {
    await enrol({ pathId: 'frontier-lab', startedOn: '2026-07-25' });
    await enrol({ pathId: 'frontier-lab', startedOn: '2026-08-01' });
    const body = await (await api('/api/me')).json();
    expect(body.enrollments).toEqual([{ pathId: 'frontier-lab', startedOn: '2026-08-01' }]);
  });

  it('rejects a timestamp where a calendar date belongs, because week maths is in local days', async () => {
    expect((await enrol({ pathId: 'p', startedOn: '2026-07-25T00:00:00Z' })).status).toBe(400);
    expect((await enrol({ pathId: 'p', startedOn: '25/07/2026' })).status).toBe(400);
  });

  it('deleting the account removes everything the user wrote', async () => {
    await enrol({ pathId: 'frontier-lab', startedOn: '2026-07-25' });
    await api('/api/progress', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pathId: 'frontier-lab', nodeId: 'n1', done: true })
    });
    await api('/api/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pathId: 'frontier-lab', subtaskId: 's', prompt: 'p', answer: 'a'
      })
    });

    expect((await api('/api/me', { method: 'DELETE' })).status).toBe(200);

    for (const table of ['users', 'enrollments', 'progress', 'cards', 'reviews']) {
      const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
      expect(results, `${table} should be empty`).toHaveLength(0);
    }
  });
});
