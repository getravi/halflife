import { describe, it, expect } from 'vitest';
import { sha256Hex, randomToken, readCookie, cookieHeader } from '../../worker/crypto.js';

describe('sha256Hex', () => {
  it('matches the known digest of the empty string', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('is stable, because the stored session id is derived from it every request', async () => {
    expect(await sha256Hex('abc')).toBe(await sha256Hex('abc'));
  });

  it('differs for different input', async () => {
    expect(await sha256Hex('abc')).not.toBe(await sha256Hex('abd'));
  });
});

describe('randomToken', () => {
  it('is url-safe, so it survives a Set-Cookie header unescaped', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is long enough not to be guessed', () => {
    // 32 bytes base64url with no padding
    expect(randomToken().length).toBeGreaterThanOrEqual(43);
  });

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 200 }, () => randomToken()));
    expect(seen.size).toBe(200);
  });
});

describe('readCookie', () => {
  const req = header => new Request('https://x/', { headers: header ? { cookie: header } : {} });

  it('returns null when there is no cookie header at all', () => {
    expect(readCookie(req(null), 'flp_session')).toBeNull();
  });

  it('finds a cookie among several', () => {
    expect(readCookie(req('a=1; flp_session=tok; b=2'), 'flp_session')).toBe('tok');
  });

  it('does not match a cookie whose name merely ends with the one asked for', () => {
    // "x_flp_session" must not satisfy a request for "flp_session"
    expect(readCookie(req('x_flp_session=nope'), 'flp_session')).toBeNull();
  });

  it('returns null for a name that is absent', () => {
    expect(readCookie(req('other=1'), 'flp_session')).toBeNull();
  });
});

describe('cookieHeader', () => {
  it('is HttpOnly and Lax, because Strict is not sent on the redirect back from GitHub', () => {
    const h = cookieHeader('flp_session', 'tok', { maxAge: 60, secure: true });
    expect(h).toMatch(/HttpOnly/);
    expect(h).toMatch(/SameSite=Lax/);
    expect(h).toMatch(/Path=\//);
    expect(h).toMatch(/Max-Age=60/);
    expect(h).toMatch(/Secure/);
  });

  it('omits Secure on plain http, so local development can sign in', () => {
    expect(cookieHeader('flp_session', 'tok', { maxAge: 60, secure: false }))
      .not.toMatch(/Secure/);
  });

  it('clears with Max-Age=0 when given an empty value', () => {
    expect(cookieHeader('flp_session', '', { maxAge: 0, secure: false }))
      .toMatch(/Max-Age=0/);
  });
});
