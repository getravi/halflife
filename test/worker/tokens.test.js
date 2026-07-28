import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, signUp } from '../helpers.js';

let COOKIE;
const api = (path, init = {}) => SELF.fetch(`https://x${path}`, {
  ...init, headers: { ...(init.headers ?? {}), cookie: COOKIE }
});

describe('exercise tokens', () => {
  beforeEach(async () => {
    await resetDb();
    COOKIE = await signUp();
  });

  it('mints a token and returns it exactly once', async () => {
    const res = await api('/api/exercise-token', { method: 'POST' });
    expect(res.status).toBe(200);

    const { token } = await res.json();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });

  it('never stores the token in the clear', async () => {
    const { token } = await (await api('/api/exercise-token', { method: 'POST' })).json();

    const { results } = await env.DB.prepare('SELECT * FROM exercise_tokens').all();
    expect(results).toHaveLength(1);
    // The digest, not the secret. A database dump must hand over nothing usable.
    expect(JSON.stringify(results)).not.toContain(token);
  });

  it('replaces rather than accumulates, so a rotated token cannot still be live', async () => {
    await api('/api/exercise-token', { method: 'POST' });
    await api('/api/exercise-token', { method: 'POST' });

    const { results } = await env.DB.prepare('SELECT * FROM exercise_tokens').all();
    expect(results).toHaveLength(1);
  });

  it('revokes', async () => {
    await api('/api/exercise-token', { method: 'POST' });
    expect((await api('/api/exercise-token', { method: 'DELETE' })).status).toBe(200);

    const { results } = await env.DB.prepare('SELECT * FROM exercise_tokens').all();
    expect(results).toHaveLength(0);
  });

  it('vanishes with the account, like everything else the user owns', async () => {
    await api('/api/exercise-token', { method: 'POST' });
    expect((await api('/api/me', { method: 'DELETE' })).status).toBe(200);

    const { results } = await env.DB.prepare('SELECT * FROM exercise_tokens').all();
    expect(results).toHaveLength(0);
  });

  it('answers 401 to a stranger', async () => {
    const res = await SELF.fetch('https://x/api/exercise-token', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});
