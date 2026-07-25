import { SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '../helpers.js';

const BODY = {
  pathId: 'frontier-lab',
  subtaskId: 'p2-serving-s01',
  prompt: 'Why does a paired bootstrap beat two independent ones?',
  answer: 'Pairing removes item-level variance.'
};

const post = (body) => SELF.fetch('https://x/api/cards', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

describe('cards routes', () => {
  beforeEach(resetDb);

  it('creates and lists a card', async () => {
    const res = await post(BODY);
    expect(res.status).toBe(201);
    const { card } = await res.json();
    expect(card.id).toBeTruthy();

    const list = await (await SELF.fetch('https://x/api/cards?pathId=frontier-lab')).json();
    expect(list.cards).toHaveLength(1);
    expect(list.cards[0].prompt).toBe(BODY.prompt);
  });

  it('computes retrievability server-side, so the browser never reimplements the scheduler', async () => {
    await post(BODY);
    const { cards } = await (await SELF.fetch('https://x/api/cards?pathId=frontier-lab')).json();
    expect(cards[0].r).toBe(0);
    expect(cards[0].due).toBe(true);
  });

  it('a brand-new card is due immediately, because unreviewed is not the same as known', async () => {
    await post(BODY);
    const { cards } = await (await SELF.fetch('https://x/api/cards?pathId=frontier-lab')).json();
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
    const { cards } = await (await SELF.fetch('https://x/api/cards?pathId=other')).json();
    expect(cards).toEqual([]);
  });
});
