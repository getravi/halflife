import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../worker/db.js';
import { resetDb, seedUsers } from '../helpers.js';

const PATH = 'frontier-lab';

async function makeCard(userId, id, overrides = {}) {
  const card = {
    id,
    user_id: userId,
    path_id: PATH,
    subtask_id: 'p2-serving-s01',
    prompt: 'original prompt',
    answer: 'original answer',
    createdAt: 1000,
    lastReviewedAt: 5000,
    dueAt: 9000,
    stability: 4,
    reps: 3,
    lapses: 1,
    ...overrides
  };
  await db.insertCard(env, card);
  return card;
}

describe('updateCardText', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers('alice', 'bob');
  });

  it('changes the prompt and the answer', async () => {
    await makeCard('alice', 'c1');
    const updated = await db.updateCardText(env, 'alice', 'c1', 'new prompt', 'new answer');
    expect(updated.prompt).toBe('new prompt');
    expect(updated.answer).toBe('new answer');
  });

  it('leaves every scheduling field untouched, which is the whole point of editing', async () => {
    await makeCard('alice', 'c1');
    const updated = await db.updateCardText(env, 'alice', 'c1', 'new prompt', 'new answer');

    expect(updated.stability).toBe(4);
    expect(updated.reps).toBe(3);
    expect(updated.lapses).toBe(1);
    expect(updated.due_at).toBe(9000);
    expect(updated.last_reviewed_at).toBe(5000);
    expect(updated.created_at).toBe(1000);
  });

  it('returns null for a card that does not exist', async () => {
    expect(await db.updateCardText(env, 'alice', 'nope', 'p', 'a')).toBeNull();
  });

  it("returns null for another user's card AND leaves it unchanged", async () => {
    await makeCard('bob', 'c-bob');

    expect(await db.updateCardText(env, 'alice', 'c-bob', 'hijacked', 'hijacked')).toBeNull();

    const row = await db.getOwnedCard(env, 'bob', 'c-bob');
    expect(row.prompt).toBe('original prompt');
    expect(row.answer).toBe('original answer');
  });
});

describe('deleteCard', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers('alice', 'bob');
  });

  it('removes the card and reports that it did', async () => {
    await makeCard('alice', 'c1');
    expect(await db.deleteCard(env, 'alice', 'c1')).toBe(true);
    expect(await db.getOwnedCard(env, 'alice', 'c1')).toBeUndefined();
  });

  it('takes the review history with it, because the cascade is the design', async () => {
    await makeCard('alice', 'c1');
    await db.insertReview(env, {
      id: 'r1', card_id: 'c1', user_id: 'alice', ts: 1, grade: 'good', latency_ms: 0
    });

    await db.deleteCard(env, 'alice', 'c1');

    const { results } = await env.DB.prepare('SELECT * FROM reviews').all();
    expect(results).toHaveLength(0);
  });

  it('reports false for a card that does not exist', async () => {
    expect(await db.deleteCard(env, 'alice', 'nope')).toBe(false);
  });

  it("refuses another user's card AND leaves it in place", async () => {
    await makeCard('bob', 'c-bob');

    expect(await db.deleteCard(env, 'alice', 'c-bob')).toBe(false);
    expect(await db.getOwnedCard(env, 'bob', 'c-bob')).toBeDefined();
  });

  it('leaves the owner other cards alone', async () => {
    await makeCard('alice', 'c1');
    await makeCard('alice', 'c2');
    await db.deleteCard(env, 'alice', 'c1');
    expect(await db.listCards(env, 'alice', PATH)).toHaveLength(1);
  });
});
