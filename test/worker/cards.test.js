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


const BODY = {
  pathId: 'frontier-lab',
  subtaskId: 'p2-serving-s01',
  prompt: 'Why does a paired bootstrap beat two independent ones?',
  answer: 'Pairing removes item-level variance.'
};

const post = (body) => api('/api/cards', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

describe('cards routes', () => {
  beforeEach(async () => {
    await resetDb();
    COOKIE = await signInAs();
  });

  it('creates and lists a card', async () => {
    const res = await post(BODY);
    expect(res.status).toBe(201);
    const { card } = await res.json();
    expect(card.id).toBeTruthy();

    const list = await (await api('/api/cards?pathId=frontier-lab')).json();
    expect(list.cards).toHaveLength(1);
    expect(list.cards[0].prompt).toBe(BODY.prompt);
  });

  it('computes retrievability server-side, so the browser never reimplements the scheduler', async () => {
    await post(BODY);
    const { cards } = await (await api('/api/cards?pathId=frontier-lab')).json();
    expect(cards[0].r).toBe(0);
    expect(cards[0].due).toBe(true);
  });

  it('a brand-new card is due immediately, because unreviewed is not the same as known', async () => {
    await post(BODY);
    const { cards } = await (await api('/api/cards?pathId=frontier-lab')).json();
    expect(cards[0].reps).toBe(0);
    expect(cards[0].due_at).toBeLessThanOrEqual(Date.now());
  });

  it('rejects a blank prompt, because a blank card is unreviewable', async () => {
    expect((await post({ ...BODY, prompt: '   ' })).status).toBe(400);
  });

  it('rejects a missing subtaskId, because a card with no anchor cannot count toward Retained', async () => {
    const { subtaskId, ...rest } = BODY;
    expect((await post(rest)).status).toBe(400);
  });

  it('scopes the list by path', async () => {
    await post(BODY);
    const { cards } = await (await api('/api/cards?pathId=other')).json();
    expect(cards).toEqual([]);
  });
});

describe('editing and deleting cards', () => {
  beforeEach(async () => {
    await resetDb();
    COOKIE = await signInAs();
  });

  const patch = (body) => api('/api/cards', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  async function created() {
    return (await (await post(BODY)).json()).card;
  }

  it('rewrites a card', async () => {
    const card = await created();
    const res = await patch({ cardId: card.id, prompt: 'sharper', answer: 'clearer' });
    expect(res.status).toBe(200);

    const { cards } = await (await api('/api/cards?pathId=frontier-lab')).json();
    expect(cards[0].prompt).toBe('sharper');
    expect(cards[0].answer).toBe('clearer');
  });

  it('does not reschedule the card it just rewrote', async () => {
    const card = await created();
    await api('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cardId: card.id, grade: 'good', latencyMs: 1 })
    });

    const before = (await (await api('/api/cards?pathId=frontier-lab')).json()).cards[0];
    await patch({ cardId: card.id, prompt: 'sharper', answer: 'clearer' });
    const after = (await (await api('/api/cards?pathId=frontier-lab')).json()).cards[0];

    expect(after.due_at).toBe(before.due_at);
    expect(after.stability).toBe(before.stability);
    expect(after.reps).toBe(before.reps);
    expect(after.lapses).toBe(before.lapses);
  });

  it('rejects a blank prompt, because a blank card is unreviewable', async () => {
    const card = await created();
    expect((await patch({ cardId: card.id, prompt: '  ', answer: 'a' })).status).toBe(400);
  });

  it('rejects a blank answer', async () => {
    const card = await created();
    expect((await patch({ cardId: card.id, prompt: 'p', answer: '' })).status).toBe(400);
  });

  it('404s an unknown card', async () => {
    expect((await patch({ cardId: 'nope', prompt: 'p', answer: 'a' })).status).toBe(404);
  });

  it('deletes a card', async () => {
    const card = await created();
    const res = await api(`/api/cards?cardId=${card.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);

    const { cards } = await (await api('/api/cards?pathId=frontier-lab')).json();
    expect(cards).toEqual([]);
  });

  it('404s deleting a card that is already gone', async () => {
    const card = await created();
    await api(`/api/cards?cardId=${card.id}`, { method: 'DELETE' });
    expect((await api(`/api/cards?cardId=${card.id}`, { method: 'DELETE' })).status).toBe(404);
  });

  it('400s a delete with no cardId, rather than deleting nothing and reporting success', async () => {
    expect((await api('/api/cards', { method: 'DELETE' })).status).toBe(400);
  });
});
