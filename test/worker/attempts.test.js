import { SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, signUp } from '../helpers.js';

let COOKIE, TOKEN;

const api = (path, init = {}) => SELF.fetch(`https://x${path}`, {
  ...init, headers: { ...(init.headers ?? {}), cookie: COOKIE }
});

const submit = (body, token = TOKEN) => SELF.fetch('https://x/api/attempts', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {})
  },
  body: JSON.stringify(body)
});

const RUN = { exerciseId: 'attention-einsum', passed: 5, total: 5 };

describe('attempts', () => {
  beforeEach(async () => {
    await resetDb();
    COOKIE = await signUp();
    TOKEN = (await (await api('/api/exercise-token', { method: 'POST' })).json()).token;
  });

  it('records a run and lists it back', async () => {
    expect((await submit(RUN)).status).toBe(201);

    const { attempts } = await (await api('/api/attempts')).json();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].passed).toBe(5);
  });

  it('records a failing run too, because the failures are the record', async () => {
    expect((await submit({ ...RUN, passed: 2 })).status).toBe(201);

    const { attempts } = await (await api('/api/attempts')).json();
    expect(attempts[0].passed).toBe(2);
  });

  it('refuses a missing token', async () => {
    expect((await submit(RUN, null)).status).toBe(401);
  });

  it('refuses an unknown token', async () => {
    expect((await submit(RUN, 'not-a-real-token')).status).toBe(401);
  });

  it('refuses after the token is revoked', async () => {
    await api('/api/exercise-token', { method: 'DELETE' });
    expect((await submit(RUN)).status).toBe(401);
  });

  it('refuses an unknown exercise id, rather than recording a phantom', async () => {
    expect((await submit({ ...RUN, exerciseId: 'no-such-exercise' })).status).toBe(400);
  });

  it('refuses a passed count above the total', async () => {
    expect((await submit({ ...RUN, passed: 99 })).status).toBe(400);
  });

  it('refuses a total that disagrees with the definition', async () => {
    // Otherwise a notebook reporting 1/1 would satisfy a five-test exercise,
    // which is the cheapest possible way to defeat the gate.
    expect((await submit({ ...RUN, passed: 1, total: 1 })).status).toBe(400);
  });

  it('records against the token owner and nobody else', async () => {
    const otherCookie = await signUp('bob@example.com');
    await submit(RUN);

    const forBob = await (await SELF.fetch('https://x/api/attempts',
      { headers: { cookie: otherCookie } })).json();
    expect(forBob.attempts).toHaveLength(0);
  });

  it('answers 401 to a session-less list', async () => {
    expect((await SELF.fetch('https://x/api/attempts')).status).toBe(401);
  });
});
