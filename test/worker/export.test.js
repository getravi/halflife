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

describe('export route', () => {
  let A, B;

  beforeEach(async () => {
    await resetDb();
    A = await signUp('alice@example.com');
    B = await signUp('bob@example.com');
  });

  it('401s without a session, because an export is the worst route to leave open', async () => {
    expect((await SELF.fetch('https://x/api/export')).status).toBe(401);
  });

  it('returns all six collections', async () => {
    const body = await (await as(A, '/api/export')).json();
    expect(Object.keys(body).sort())
      .toEqual(['cards', 'enrollments', 'exportedAt', 'notes', 'progress',
                'reviews', 'user']);
  });

  it('carries only the email, not the internal id', async () => {
    const body = await (await as(A, '/api/export')).json();
    expect(body.user).toEqual({ email: 'alice@example.com' });
  });

  it('includes the cards, progress, enrolments and reviews the user owns', async () => {
    const card = (await (await makeCard(A, 'alice-card')).json()).card;
    await as(A, '/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ cardId: card.id, grade: 'good', latencyMs: 1 })
    });
    await as(A, '/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ pathId: 'frontier-lab', nodeId: 'n1', done: true })
    });
    await as(A, '/api/enrollments', {
      method: 'POST',
      body: JSON.stringify({ pathId: 'frontier-lab', startedOn: '2026-07-25' })
    });

    const body = await (await as(A, '/api/export')).json();
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].prompt).toBe('alice-card');
    expect(body.reviews).toHaveLength(1);
    expect(body.progress).toHaveLength(1);
    expect(body.enrollments).toHaveLength(1);
  });

  it('contains nothing belonging to another signed-in user', async () => {
    await makeCard(A, 'alice-card');
    await makeCard(B, 'bob-card');
    await as(B, '/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ pathId: 'frontier-lab', nodeId: 'bob-node', done: true })
    });

    const body = await (await as(A, '/api/export')).json();
    // Serialise the whole response: a leak into an unexpected field would
    // sail past a check on collection lengths.
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain('bob-card');
    expect(serialised).not.toContain('bob-node');
  });

  it('is empty but well-formed for a user who has done nothing', async () => {
    const body = await (await as(A, '/api/export')).json();
    expect(body.cards).toEqual([]);
    expect(body.reviews).toEqual([]);
    expect(body.progress).toEqual([]);
    expect(body.enrollments).toEqual([]);
    expect(body.exportedAt).toBeGreaterThan(0);
  });
});
