/**
 * The only module that talks to github.com. fetch is injected so the routes
 * can be tested without reaching the network — and so a test cannot
 * accidentally hit GitHub's rate limit.
 */

export function authorizeUrl(env, state) {
  const u = new URL('https://github.com/login/oauth/authorize');
  u.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  u.searchParams.set('redirect_uri', `${env.APP_URL}/api/auth/callback`);
  u.searchParams.set('state', state);
  // No scope. id, login and avatar_url are public profile fields, so asking
  // for nothing gives both the smallest consent screen and the smallest
  // blast radius if a token ever leaks.
  return u.toString();
}

export async function exchangeCode(env, code, fetchImpl = fetch) {
  const res = await fetchImpl('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${env.APP_URL}/api/auth/callback`
    })
  });
  if (!res.ok) throw new Error(`github token exchange failed: ${res.status}`);

  const body = await res.json();
  // GitHub answers a bad code with HTTP 200 and an error field rather than a
  // status code, so reading access_token naively yields undefined and the
  // flow continues with a broken token.
  if (body.error) throw new Error(`github: ${body.error}`);
  if (!body.access_token) throw new Error('github: no access_token in response');
  return body.access_token;
}

export async function fetchUser(token, fetchImpl = fetch) {
  const res = await fetchImpl('https://api.github.com/user', {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'frontier-lab-plan'
    }
  });
  if (!res.ok) throw new Error(`github user fetch failed: ${res.status}`);

  const u = await res.json();
  return { githubId: u.id, login: u.login, avatarUrl: u.avatar_url };
}
