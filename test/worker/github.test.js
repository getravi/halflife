import { describe, it, expect } from 'vitest';
import { authorizeUrl, exchangeCode, fetchUser } from '../../worker/github.js';

const ENV = {
  GITHUB_CLIENT_ID: 'client-abc',
  GITHUB_CLIENT_SECRET: 'secret-xyz',
  APP_URL: 'https://app.example'
};

const jsonResponse = body => new Response(JSON.stringify(body), {
  status: 200, headers: { 'content-type': 'application/json' }
});

describe('authorizeUrl', () => {
  it('carries the client id, the callback and the state', () => {
    const u = new URL(authorizeUrl(ENV, 'state-123'));
    expect(u.origin + u.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(u.searchParams.get('client_id')).toBe('client-abc');
    expect(u.searchParams.get('state')).toBe('state-123');
    expect(u.searchParams.get('redirect_uri')).toBe('https://app.example/api/auth/callback');
  });

  it('requests no scope at all, which is the smallest consent screen and blast radius', () => {
    const u = new URL(authorizeUrl(ENV, 's'));
    expect(u.searchParams.get('scope')).toBeNull();
  });
});

describe('exchangeCode', () => {
  it('posts the code and returns the access token', async () => {
    let seen = null;
    const fake = async (url, opts) => {
      seen = { url, body: JSON.parse(opts.body) };
      return jsonResponse({ access_token: 'gho_token' });
    };
    expect(await exchangeCode(ENV, 'the-code', fake)).toBe('gho_token');
    expect(seen.url).toBe('https://github.com/login/oauth/access_token');
    expect(seen.body.code).toBe('the-code');
    expect(seen.body.client_secret).toBe('secret-xyz');
  });

  it('throws when GitHub answers with an error rather than a token', async () => {
    const fake = async () => jsonResponse({ error: 'bad_verification_code' });
    await expect(exchangeCode(ENV, 'stale', fake)).rejects.toThrow(/bad_verification_code/);
  });

  it('throws on a non-200, rather than treating undefined as a token', async () => {
    const fake = async () => new Response('nope', { status: 500 });
    await expect(exchangeCode(ENV, 'c', fake)).rejects.toThrow();
  });
});

describe('fetchUser', () => {
  it('maps the GitHub profile onto our own field names', async () => {
    const fake = async (url, opts) => {
      expect(url).toBe('https://api.github.com/user');
      expect(opts.headers.authorization).toBe('Bearer gho_token');
      return jsonResponse({ id: 4242, login: 'ravi', avatar_url: 'https://x/a.png' });
    };
    expect(await fetchUser('gho_token', fake)).toEqual({
      githubId: 4242, login: 'ravi', avatarUrl: 'https://x/a.png'
    });
  });

  it('throws on a non-200 rather than returning a user with an undefined id', async () => {
    const fake = async () => new Response('unauthorized', { status: 401 });
    await expect(fetchUser('bad', fake)).rejects.toThrow();
  });
});
