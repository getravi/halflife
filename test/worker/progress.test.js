import { SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '../helpers.js';

const put = (body) => SELF.fetch('https://x/api/progress', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

describe('progress routes', () => {
  beforeEach(resetDb);

  it('round-trips a tick', async () => {
    expect((await put({ pathId: 'p', nodeId: 'n1', done: true })).status).toBe(200);
    const res = await SELF.fetch('https://x/api/progress?pathId=p');
    expect(await res.json()).toEqual({ nodeIds: ['n1'] });
  });

  it('unticking removes it, because progress is presence rather than a flag', async () => {
    await put({ pathId: 'p', nodeId: 'n1', done: true });
    await put({ pathId: 'p', nodeId: 'n1', done: false });
    const res = await SELF.fetch('https://x/api/progress?pathId=p');
    expect(await res.json()).toEqual({ nodeIds: [] });
  });

  it('ticking twice is idempotent rather than a constraint error', async () => {
    await put({ pathId: 'p', nodeId: 'n1', done: true });
    expect((await put({ pathId: 'p', nodeId: 'n1', done: true })).status).toBe(200);
    const res = await SELF.fetch('https://x/api/progress?pathId=p');
    expect(await res.json()).toEqual({ nodeIds: ['n1'] });
  });

  it('scopes reads by path, so two paths cannot bleed into each other', async () => {
    await put({ pathId: 'p', nodeId: 'n1', done: true });
    const res = await SELF.fetch('https://x/api/progress?pathId=other');
    expect(await res.json()).toEqual({ nodeIds: [] });
  });

  it('rejects a missing pathId rather than writing an orphan row', async () => {
    expect((await put({ nodeId: 'n1', done: true })).status).toBe(400);
  });

  it('rejects a non-boolean done, because a string "false" is truthy and would tick it', async () => {
    expect((await put({ pathId: 'p', nodeId: 'n1', done: 'false' })).status).toBe(400);
  });

  it('404s an unknown api route instead of falling through to assets', async () => {
    expect((await SELF.fetch('https://x/api/nope')).status).toBe(404);
  });
});
