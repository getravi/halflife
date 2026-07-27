import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, signUp, sentMail } from '../helpers.js';

// Origin is required on every state-changing Better Auth request: without it
// the library answers 403 MISSING_OR_NULL_ORIGIN, which is CSRF protection
// doing its job. Browsers send it automatically on same-origin POSTs.
const post = (path, body, cookie) => SELF.fetch(`https://x${path}`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    origin: 'https://x',
    ...(cookie ? { cookie } : {})
  },
  body: JSON.stringify(body)
});

describe('signing up', () => {
  beforeEach(resetDb);

  it('creates a user and sends exactly one verification mail', async () => {
    await post('/api/auth/sign-up/email',
      { email: 'new@example.com', password: 'correct-horse-battery', name: 'New' });

    const { results } = await env.DB.prepare('SELECT email FROM user').all();
    expect(results.map(r => r.email)).toEqual(['new@example.com']);
    expect(sentMail()).toHaveLength(1);
    expect(sentMail()[0].to).toBe('new@example.com');
  });

  it('starts unverified, so the mail is not decorative', async () => {
    await post('/api/auth/sign-up/email',
      { email: 'unv@example.com', password: 'correct-horse-battery', name: 'U' });

    const row = await env.DB.prepare('SELECT emailVerified FROM user WHERE email = ?')
      .bind('unv@example.com').first();
    expect(row.emailVerified).toBe(0);
  });

  it('will not let an unverified account write anything', async () => {
    await post('/api/auth/sign-up/email',
      { email: 'unv2@example.com', password: 'correct-horse-battery', name: 'U' });

    const signIn = await post('/api/auth/sign-in/email',
      { email: 'unv2@example.com', password: 'correct-horse-battery' });
    const cookie = signIn.headers.get('set-cookie')?.split(';')[0];

    // Better Auth may refuse the sign-in outright when verification is
    // required. Either way the account must not be able to write.
    if (!cookie) {
      expect(signIn.status).toBeGreaterThanOrEqual(400);
      return;
    }

    const res = await SELF.fetch('https://x/api/progress', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ pathId: 'frontier-lab', nodeId: 'n1', done: true })
    });
    expect(res.status).toBe(403);
  });

  it('lets a verified account write, using the link from the mail it actually sent', async () => {
    const cookie = await signUp('ok@example.com');

    const res = await SELF.fetch('https://x/api/progress', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ pathId: 'frontier-lab', nodeId: 'n1', done: true })
    });
    expect(res.status).toBe(200);
  });

  it('reports the signed-in user from /api/me', async () => {
    const cookie = await signUp('me@example.com');
    const body = await (await SELF.fetch('https://x/api/me', { headers: { cookie } })).json();
    expect(body.user.email).toBe('me@example.com');
    expect(body.user.emailVerified).toBe(true);
  });

  it('answers /api/me with a null user when signed out, and still reports providers', async () => {
    const body = await (await SELF.fetch('https://x/api/me')).json();
    expect(body.user).toBeNull();
    // No credentials in the test environment, so the button must stay hidden.
    expect(body.providers).toEqual({ github: false });
  });
});

describe('when the provider fails', () => {
  beforeEach(resetDb);

  it('still creates the account, because a thrown send would leave it unverifiable', async () => {
    // sendEmail never throws: Better Auth writes the user row before calling
    // the hook, so an exception would leave an address that is taken, cannot
    // be verified, and cannot be signed up with again.
    const res = await post('/api/auth/sign-up/email',
      { email: 'fail@example.com', password: 'correct-horse-battery', name: 'F' });
    expect(res.status).toBeLessThan(400);

    const row = await env.DB.prepare('SELECT email FROM user WHERE email = ?')
      .bind('fail@example.com').first();
    expect(row).toBeTruthy();
  });

  it('can send the verification again, which is the only way out of a failed send', async () => {
    await post('/api/auth/sign-up/email',
      { email: 'again@example.com', password: 'correct-horse-battery', name: 'A' });
    const before = sentMail().length;

    const res = await post('/api/auth/send-verification-email',
      { email: 'again@example.com', callbackURL: '/' });

    expect(res.status).toBeLessThan(400);
    expect(sentMail().length).toBeGreaterThan(before);
  });
});

describe('signing out', () => {
  beforeEach(resetDb);

  it('stops the cookie working', async () => {
    const cookie = await signUp('out@example.com');
    expect((await SELF.fetch('https://x/api/cards?pathId=p', { headers: { cookie } })).status)
      .toBe(200);

    await post('/api/auth/sign-out', {}, cookie);

    expect((await SELF.fetch('https://x/api/cards?pathId=p', { headers: { cookie } })).status)
      .toBe(401);
  });
});

describe('a wrong password', () => {
  beforeEach(resetDb);

  it('does not produce a usable session', async () => {
    await signUp('pw@example.com');
    const res = await post('/api/auth/sign-in/email',
      { email: 'pw@example.com', password: 'not-the-password' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
