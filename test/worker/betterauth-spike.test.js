import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';

const config = {
  database: env.DB,
  secret: 'spike-secret-not-used-anywhere-else-0123456789',
  baseURL: 'https://x',
  emailAndPassword: { enabled: true, requireEmailVerification: false }
};

beforeAll(async () => {
  // Better Auth's own tables, created programmatically. Task 2 captures the
  // resulting SQL as a committed migration; this proves the schema can be
  // stood up inside the pool at all.
  const { runMigrations } = await getMigrations(config);
  await runMigrations();
});

describe('better auth inside the workers test pool', () => {
  it('creates its four tables', async () => {
    const { results } = await env.DB
      .prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const names = results.map(r => r.name);
    for (const t of ['user', 'session', 'account', 'verification']) {
      expect(names, `missing table ${t}`).toContain(t);
    }
  });

  it('signs a user up and hands back a user with an id', async () => {
    const auth = betterAuth(config);
    const res = await auth.api.signUpEmail({
      body: { email: 'spike@example.com', password: 'correct-horse-battery', name: 'Spike' }
    });
    expect(res.user?.id).toBeTruthy();
    expect(res.user.email).toBe('spike@example.com');
  });

  it('signs that user in and resolves a session from the returned headers', async () => {
    const auth = betterAuth(config);
    await auth.api.signUpEmail({
      body: { email: 'two@example.com', password: 'correct-horse-battery', name: 'Two' }
    });

    const signIn = await auth.api.signInEmail({
      body: { email: 'two@example.com', password: 'correct-horse-battery' },
      asResponse: true
    });
    const cookie = signIn.headers.get('set-cookie');
    expect(cookie).toBeTruthy();

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookie.split(';')[0] })
    });
    expect(session?.user?.email).toBe('two@example.com');
  });

  it('rejects a wrong password', async () => {
    const auth = betterAuth(config);
    await auth.api.signUpEmail({
      body: { email: 'three@example.com', password: 'correct-horse-battery', name: 'Three' }
    });
    await expect(auth.api.signInEmail({
      body: { email: 'three@example.com', password: 'wrong' }
    })).rejects.toBeTruthy();
  });
});
