import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, seedUsers, signUp } from '../helpers.js';
import { newCard, review as applyGrade } from '../../worker/scheduler.js';

let COOKIE;

// Every request in this file goes through a real session now. Before auth
// landed these tests passed because the app authenticated nobody.
const api = (path, init = {}) => SELF.fetch(`https://x${path}`, {
  ...init,
  headers: { ...(init.headers ?? {}), cookie: COOKIE }
});


const DAY = 86400000;

async function makeCard() {
  const res = await api('/api/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      pathId: 'frontier-lab', subtaskId: 'p2-serving-s01',
      prompt: 'p', answer: 'a'
    })
  });
  return (await res.json()).card;
}

const grade = (cardId, g) => api('/api/reviews', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ cardId, grade: g, latencyMs: 3300 })
});

describe('reviews route', () => {
  beforeEach(async () => {
    await resetDb();
    COOKIE = await signUp();
  });

  it('grading good schedules four days out on the first review', async () => {
    const created = await makeCard();
    const { card } = await (await grade(created.id, 'good')).json();
    expect(card.reps).toBe(1);
    expect(card.stability).toBe(4);
    expect(card.dueAt - Date.now()).toBeGreaterThan(3.9 * DAY);
  });

  it('a lapse returns the card inside a day, because the memory is gone rather than weak', async () => {
    const created = await makeCard();
    await grade(created.id, 'good');
    const { card } = await (await grade(created.id, 'again')).json();
    expect(card.stability).toBe(1);
    expect(card.lapses).toBe(1);
    expect(card.dueAt - Date.now()).toBeLessThanOrEqual(DAY + 1000);
  });

  it('writes exactly one review row per grade and never updates one', async () => {
    const created = await makeCard();
    await grade(created.id, 'good');
    await grade(created.id, 'again');
    const { results } = await env.DB
      .prepare('SELECT grade FROM reviews WHERE card_id = ? ORDER BY ts, rowid')
      .bind(created.id).all();
    expect(results.map(r => r.grade)).toEqual(['good', 'again']);
  });

  it('card state can be rebuilt from the review log, which is what append-only buys', async () => {
    const created = await makeCard();
    await grade(created.id, 'good');
    await grade(created.id, 'again');
    await grade(created.id, 'hard');

    const stored = await env.DB.prepare('SELECT * FROM cards WHERE id = ?')
      .bind(created.id).first();
    const log = (await env.DB
      .prepare('SELECT grade, ts FROM reviews WHERE card_id = ? ORDER BY ts, rowid')
      .bind(created.id).all()).results;

    let replayed = newCard({ prompt: 'p', answer: 'a' }, stored.created_at);
    for (const r of log) replayed = applyGrade(replayed, r.grade, r.ts);

    expect(replayed.stability).toBe(stored.stability);
    expect(replayed.reps).toBe(stored.reps);
    expect(replayed.lapses).toBe(stored.lapses);
    expect(replayed.dueAt).toBe(stored.due_at);
  });

  it('rejects an unknown grade rather than scheduling something wrong', async () => {
    const created = await makeCard();
    expect((await grade(created.id, 'ok')).status).toBe(400);
  });

  it('404s an unknown card', async () => {
    expect((await grade('nope', 'good')).status).toBe(404);
  });

  it("404s another user's card with the same response as a missing one, so the endpoint is not an existence oracle", async () => {
    await seedUsers('someone-else');
    await env.DB.prepare(
      `INSERT INTO cards (id,user_id,path_id,subtask_id,prompt,answer,created_at,due_at)
       VALUES ('theirs','someone-else','frontier-lab','s','p','a',0,0)`
    ).run();

    const missing = await grade('nope', 'good');
    const theirs = await grade('theirs', 'good');
    expect(theirs.status).toBe(404);
    expect(await theirs.json()).toEqual(await missing.json());

    const row = await env.DB.prepare("SELECT reps FROM cards WHERE id = 'theirs'").first();
    expect(row.reps).toBe(0);
  });
});
