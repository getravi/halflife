import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '../helpers.js';

const enrol = (body) => SELF.fetch('https://x/api/enrollments', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

describe('me and enrolment', () => {
  beforeEach(resetDb);

  it('reports the signed-in user with no enrolments initially', async () => {
    const body = await (await SELF.fetch('https://x/api/me')).json();
    expect(body.user.login).toBe('dev');
    expect(body.enrollments).toEqual([]);
  });

  it('enrolling records the start date the plan week is derived from', async () => {
    expect((await enrol({ pathId: 'frontier-lab', startedOn: '2026-07-25' })).status).toBe(200);
    const body = await (await SELF.fetch('https://x/api/me')).json();
    expect(body.enrollments).toEqual([{ pathId: 'frontier-lab', startedOn: '2026-07-25' }]);
  });

  it('re-enrolling updates the date rather than erroring on the primary key', async () => {
    await enrol({ pathId: 'frontier-lab', startedOn: '2026-07-25' });
    await enrol({ pathId: 'frontier-lab', startedOn: '2026-08-01' });
    const body = await (await SELF.fetch('https://x/api/me')).json();
    expect(body.enrollments).toEqual([{ pathId: 'frontier-lab', startedOn: '2026-08-01' }]);
  });

  it('rejects a timestamp where a calendar date belongs, because week maths is in local days', async () => {
    expect((await enrol({ pathId: 'p', startedOn: '2026-07-25T00:00:00Z' })).status).toBe(400);
    expect((await enrol({ pathId: 'p', startedOn: '25/07/2026' })).status).toBe(400);
  });

  it('deleting the account removes everything the user wrote', async () => {
    await enrol({ pathId: 'frontier-lab', startedOn: '2026-07-25' });
    await SELF.fetch('https://x/api/progress', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pathId: 'frontier-lab', nodeId: 'n1', done: true })
    });
    await SELF.fetch('https://x/api/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pathId: 'frontier-lab', subtaskId: 's', prompt: 'p', answer: 'a'
      })
    });

    expect((await SELF.fetch('https://x/api/me', { method: 'DELETE' })).status).toBe(200);

    for (const table of ['users', 'enrollments', 'progress', 'cards', 'reviews']) {
      const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
      expect(results, `${table} should be empty`).toHaveLength(0);
    }
  });
});
