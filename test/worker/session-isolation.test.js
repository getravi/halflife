import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, signUp } from '../helpers.js';

const as = (cookie, path, init = {}) => SELF.fetch(`https://x${path}`, {
  ...init, headers: { ...(init.headers ?? {}), cookie, 'content-type': 'application/json' }
});

const makeCard = (cookie, prompt) => as(cookie, '/api/cards', {
  method: 'POST',
  body: JSON.stringify({
    pathId: 'frontier-lab', subtaskId: 'p2-serving-s01', prompt, answer: 'a'
  })
});

describe('isolation through real sessions', () => {
  let A, B;

  beforeEach(async () => {
    await resetDb();
    A = await signUp('alice@example.com');
    B = await signUp('bob@example.com');
  });

  it("does not list one signed-in user another's cards", async () => {
    await makeCard(A, 'alice-card');
    await makeCard(B, 'bob-card');

    const forA = await (await as(A, '/api/cards?pathId=frontier-lab')).json();
    expect(forA.cards).toHaveLength(1);
    expect(forA.cards[0].prompt).toBe('alice-card');
  });

  it("refuses to grade another user's card, answering exactly as for one that does not exist", async () => {
    const bob = (await (await makeCard(B, 'bob-card')).json()).card;

    const theirs = await as(A, '/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ cardId: bob.id, grade: 'good', latencyMs: 1 })
    });
    const missing = await as(A, '/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ cardId: 'no-such-card', grade: 'good', latencyMs: 1 })
    });

    expect(theirs.status).toBe(404);
    expect(await theirs.json()).toEqual(await missing.json());

    const row = await env.DB.prepare('SELECT reps FROM cards WHERE id = ?')
      .bind(bob.id).first();
    expect(row.reps).toBe(0);
  });

  it('keeps progress separate between two signed-in users', async () => {
    await as(A, '/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ pathId: 'frontier-lab', nodeId: 'n1', done: true })
    });

    const forB = await (await as(B, '/api/progress?pathId=frontier-lab')).json();
    expect(forB.nodeIds).toEqual([]);
  });

  it('keeps enrolments separate', async () => {
    await as(A, '/api/enrollments', {
      method: 'POST',
      body: JSON.stringify({ pathId: 'frontier-lab', startedOn: '2026-07-25' })
    });

    const meB = await (await as(B, '/api/me')).json();
    expect(meB.enrollments).toEqual([]);
  });

  it("deleting one account leaves the other's data and session intact", async () => {
    await makeCard(A, 'alice-card');
    await makeCard(B, 'bob-card');

    expect((await as(A, '/api/me', { method: 'DELETE' })).status).toBe(200);

    // Alice's session died with her account.
    expect((await as(A, '/api/cards?pathId=frontier-lab')).status).toBe(401);

    const forB = await (await as(B, '/api/cards?pathId=frontier-lab')).json();
    expect(forB.cards).toHaveLength(1);
    expect(forB.cards[0].prompt).toBe('bob-card');
  });

  it("refuses to rewrite another user's card, and leaves its text alone", async () => {
    const bob = (await (await makeCard(B, 'bob-card')).json()).card;

    const res = await as(A, '/api/cards', {
      method: 'PATCH',
      body: JSON.stringify({ cardId: bob.id, prompt: 'hijacked', answer: 'hijacked' })
    });
    expect(res.status).toBe(404);

    const row = await env.DB.prepare('SELECT prompt FROM cards WHERE id = ?')
      .bind(bob.id).first();
    expect(row.prompt).toBe('bob-card');
  });

  it("refuses to delete another user's card, and leaves it in place", async () => {
    const bob = (await (await makeCard(B, 'bob-card')).json()).card;

    const res = await as(A, `/api/cards?cardId=${bob.id}`, { method: 'DELETE' });
    expect(res.status).toBe(404);

    const row = await env.DB.prepare('SELECT id FROM cards WHERE id = ?')
      .bind(bob.id).first();
    expect(row).toBeTruthy();
  });
});
