import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../worker/db.js';
import { newCard } from '../../worker/scheduler.js';
import { resetDb, seedUsers } from '../helpers.js';

const A = 'user-a';
const B = 'user-b';
const PATH = 'frontier-lab';

function card(userId, prompt) {
  return {
    ...newCard({ prompt, answer: 'answer' }, 1000),
    user_id: userId,
    path_id: PATH,
    subtask_id: 'p2-serving-s01'
  };
}

describe('tenant isolation', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers(A, B);
  });

  it("does not show one user another user's cards", async () => {
    await db.insertCard(env, card(A, 'a-prompt'));
    await db.insertCard(env, card(B, 'b-prompt'));

    const forA = await db.listCards(env, A, PATH);
    expect(forA).toHaveLength(1);
    expect(forA[0].prompt).toBe('a-prompt');
  });

  it('refuses to hand over a card the caller does not own, because that is what guards every review', async () => {
    const bCard = await db.insertCard(env, card(B, 'b-prompt'));
    expect(await db.getOwnedCard(env, A, bCard.id)).toBeUndefined();
    expect(await db.getOwnedCard(env, B, bCard.id)).toBeDefined();
  });

  it('keeps progress separate per user', async () => {
    await db.setProgress(env, A, PATH, 'node-1', true, 1);
    expect(await db.listProgress(env, A, PATH)).toEqual(['node-1']);
    expect(await db.listProgress(env, B, PATH)).toEqual([]);
  });

  it('keeps progress separate per path, so enrolling in a second path starts empty', async () => {
    await db.setProgress(env, A, PATH, 'node-1', true, 1);
    expect(await db.listProgress(env, A, 'other-path')).toEqual([]);
  });

  it('deletes a row rather than storing done=false, so unticking leaves no tombstone', async () => {
    await db.setProgress(env, A, PATH, 'node-1', true, 1);
    await db.setProgress(env, A, PATH, 'node-1', false, 2);
    expect(await db.listProgress(env, A, PATH)).toEqual([]);
  });

  it("deleting an account removes that user's data and touches nobody else's", async () => {
    const aCard = await db.insertCard(env, card(A, 'a-prompt'));
    await db.insertReview(env, {
      id: 'r1', card_id: aCard.id, user_id: A, ts: 1, grade: 'good', latency_ms: 0
    });
    await db.setProgress(env, A, PATH, 'node-1', true, 1);
    await db.insertCard(env, card(B, 'b-prompt'));
    await db.setProgress(env, B, PATH, 'node-2', true, 1);

    await db.deleteUser(env, A);

    expect(await db.listCards(env, A, PATH)).toEqual([]);
    expect(await db.listProgress(env, A, PATH)).toEqual([]);
    const reviews = await env.DB.prepare('SELECT * FROM reviews').all();
    expect(reviews.results).toHaveLength(0);

    expect(await db.listCards(env, B, PATH)).toHaveLength(1);
    expect(await db.listProgress(env, B, PATH)).toEqual(['node-2']);
  });
});
