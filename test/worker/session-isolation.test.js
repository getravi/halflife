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

const makeNote = (cookie, body) => as(cookie, '/api/notes', {
  method: 'POST',
  body: JSON.stringify({ pathId: 'frontier-lab', subtaskId: 'p2-serving-s01', body })
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

  it("does not list one signed-in user another's notes", async () => {
    await makeNote(A, 'alice note');
    await makeNote(B, 'bob note');

    const forA = await (await as(A, '/api/notes?pathId=frontier-lab')).json();
    expect(forA.notes).toHaveLength(1);
    expect(forA.notes[0].body).toBe('alice note');
  });

  it("refuses to rewrite another user's note, and leaves its text alone", async () => {
    const mine = (await (await makeNote(B, 'bob note')).json()).note;

    const res = await as(A, '/api/notes', {
      method: 'PATCH',
      body: JSON.stringify({ noteId: mine.id, body: 'hijacked' })
    });
    expect(res.status).toBe(404);

    const forB = await (await as(B, '/api/notes?pathId=frontier-lab')).json();
    expect(forB.notes[0].body).toBe('bob note');
  });

  it("refuses to delete another user's note", async () => {
    const mine = (await (await makeNote(B, 'bob note')).json()).note;

    expect((await as(A, `/api/notes?noteId=${mine.id}`, { method: 'DELETE' })).status)
      .toBe(404);

    const forB = await (await as(B, '/api/notes?pathId=frontier-lab')).json();
    expect(forB.notes).toHaveLength(1);
  });

  it('deletes the notes of a deleted account, rather than orphaning them', async () => {
    await makeNote(A, 'alice note');

    const count = async () => (await env.DB
      .prepare('SELECT * FROM notes WHERE body = ?').bind('alice note').all()).results.length;

    // Asserted before as well as after, or the test passes just as happily
    // when the note was never written — which is exactly how it behaved
    // before the routes existed.
    expect(await count()).toBe(1);

    expect((await as(A, '/api/me', { method: 'DELETE' })).status).toBe(200);

    // Against the table, not through a route. Every route for this user now
    // answers 401, which would pass whether or not the row survived. The whole
    // suite's resetDb() leans on this cascade and nothing tested it.
    expect(await count()).toBe(0);
  });
});
