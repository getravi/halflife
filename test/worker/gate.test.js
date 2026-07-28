import { SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, signUp } from '../helpers.js';
import EXERCISES from '../../exercises/index.json';

const EX = 'attention-einsum';
const GATED = EXERCISES[EX].gatedNodeId;
const TESTS = EXERCISES[EX].tests;
const ORDINARY = 'p0-numpy-s03-01';

let COOKIE, TOKEN;

const api = (path, init = {}) => SELF.fetch(`https://x${path}`, {
  ...init,
  headers: { ...(init.headers ?? {}), cookie: COOKIE, 'content-type': 'application/json' }
});

const tick = (nodeId, done = true) => api('/api/progress', {
  method: 'PUT',
  body: JSON.stringify({ pathId: 'frontier-lab', nodeId, done })
});

const submit = (passed) => SELF.fetch('https://x/api/attempts', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({ exerciseId: EX, passed, total: TESTS })
});

const done = async () =>
  (await (await api('/api/progress?pathId=frontier-lab')).json()).nodeIds;

describe('the exercise gate', () => {
  beforeEach(async () => {
    await resetDb();
    COOKIE = await signUp();
    TOKEN = (await (await api('/api/exercise-token', { method: 'POST' })).json()).token;
  });

  it('refuses to tick a graded step, even from a valid signed-in session', async () => {
    // The whole point. A disabled checkbox is a courtesy; curl is the threat.
    expect((await tick(GATED)).status).toBe(409);
    expect(await done()).not.toContain(GATED);
  });

  it('refuses to untick it too, so it cannot be cleared by hand', async () => {
    expect((await tick(GATED, false)).status).toBe(409);
  });

  it('still accepts every ordinary step, which is 154 of 158 subtasks', async () => {
    expect((await tick(ORDINARY)).status).toBe(200);
    expect(await done()).toContain(ORDINARY);
  });

  it('does not tick the step on a failing attempt', async () => {
    expect((await submit(TESTS - 1)).status).toBe(201);
    expect(await done()).not.toContain(GATED);
  });

  it('ticks the step on a passing attempt', async () => {
    expect((await submit(TESTS)).status).toBe(201);
    expect(await done()).toContain(GATED);
  });

  it('leaves it ticked after a later failing attempt, because it was earned', async () => {
    await submit(TESTS);
    await submit(0);
    expect(await done()).toContain(GATED);
  });

  it('ticks it for the token owner and for nobody else', async () => {
    const bob = await signUp('bob@example.com');
    await submit(TESTS);

    const forBob = await (await SELF.fetch(
      'https://x/api/progress?pathId=frontier-lab', { headers: { cookie: bob } })).json();
    expect(forBob.nodeIds).not.toContain(GATED);
  });
});
