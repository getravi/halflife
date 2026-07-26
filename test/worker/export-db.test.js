import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../worker/db.js';
import { resetDb, seedUsers } from '../helpers.js';

const card = (id, userId, pathId) => ({
  id, user_id: userId, path_id: pathId, subtask_id: 's1',
  prompt: `prompt ${id}`, answer: `answer ${id}`,
  createdAt: 1, lastReviewedAt: null, dueAt: 1,
  stability: 0, reps: 0, lapses: 0
});

describe('export queries', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers('alice', 'bob');
  });

  it('returns cards across every path, not just one', async () => {
    await db.insertCard(env, card('a1', 'alice', 'frontier-lab'));
    await db.insertCard(env, card('a2', 'alice', 'other-path'));

    const cards = await db.listAllCards(env, 'alice');
    expect(cards.map(c => c.id).sort()).toEqual(['a1', 'a2']);
  });

  it("never returns another user's cards, because an export is the easiest place to leak everything at once", async () => {
    await db.insertCard(env, card('a1', 'alice', 'frontier-lab'));
    await db.insertCard(env, card('b1', 'bob', 'frontier-lab'));

    const cards = await db.listAllCards(env, 'alice');
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe('a1');
  });

  it('returns progress across every path', async () => {
    await db.setProgress(env, 'alice', 'frontier-lab', 'n1', true, 1);
    await db.setProgress(env, 'alice', 'other-path', 'n2', true, 1);
    await db.setProgress(env, 'bob', 'frontier-lab', 'n3', true, 1);

    const rows = await db.listAllProgress(env, 'alice');
    expect(rows.map(r => r.node_id).sort()).toEqual(['n1', 'n2']);
  });

  it('returns every review the user made, and nobody else', async () => {
    await db.insertCard(env, card('a1', 'alice', 'frontier-lab'));
    await db.insertCard(env, card('b1', 'bob', 'frontier-lab'));
    await db.insertReview(env, {
      id: 'r1', card_id: 'a1', user_id: 'alice', ts: 1, grade: 'good', latency_ms: 0
    });
    await db.insertReview(env, {
      id: 'r2', card_id: 'b1', user_id: 'bob', ts: 2, grade: 'hard', latency_ms: 0
    });

    const rows = await db.listUserReviews(env, 'alice');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('r1');
  });

  it('returns empty arrays rather than throwing for a user with nothing', async () => {
    expect(await db.listAllCards(env, 'alice')).toEqual([]);
    expect(await db.listAllProgress(env, 'alice')).toEqual([]);
    expect(await db.listUserReviews(env, 'alice')).toEqual([]);
  });
});
