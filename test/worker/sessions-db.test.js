import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../worker/db.js';
import { resetDb, seedUsers } from '../helpers.js';

const DAY = 86400000;
const T = 1_800_000_000_000;

describe('session queries', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUsers('u1', 'u2');
  });

  it('resolves a live session to its user', async () => {
    await db.createSession(env, 'u1', 'hash-1', T, 30 * DAY, 'agent');
    const user = await db.findSessionUser(env, 'hash-1', T + DAY);
    expect(user.id).toBe('u1');
  });

  it('does not resolve an expired session, because that is the whole point of storing them', async () => {
    await db.createSession(env, 'u1', 'hash-1', T, DAY, 'agent');
    expect(await db.findSessionUser(env, 'hash-1', T + 2 * DAY)).toBeNull();
  });

  it('does not resolve an unknown token', async () => {
    expect(await db.findSessionUser(env, 'never-issued', T)).toBeNull();
  });

  it('stops resolving after the session is deleted — a signed cookie could not do this', async () => {
    await db.createSession(env, 'u1', 'hash-1', T, 30 * DAY, 'agent');
    await db.deleteSession(env, 'hash-1');
    expect(await db.findSessionUser(env, 'hash-1', T)).toBeNull();
  });

  it('leaves other sessions alone when one is deleted', async () => {
    await db.createSession(env, 'u1', 'hash-1', T, 30 * DAY, 'a');
    await db.createSession(env, 'u2', 'hash-2', T, 30 * DAY, 'b');
    await db.deleteSession(env, 'hash-1');
    expect(await db.findSessionUser(env, 'hash-2', T)).not.toBeNull();
  });

  it('sweeps only expired rows', async () => {
    await db.createSession(env, 'u1', 'old', T, DAY, 'a');
    await db.createSession(env, 'u2', 'new', T, 30 * DAY, 'b');
    await db.deleteExpiredSessions(env, T + 2 * DAY);
    expect(await db.findSessionUser(env, 'old', T + 2 * DAY)).toBeNull();
    expect(await db.findSessionUser(env, 'new', T + 2 * DAY)).not.toBeNull();
  });

  it('deleting a user removes their sessions, so account deletion signs out every device', async () => {
    await db.createSession(env, 'u1', 'hash-1', T, 30 * DAY, 'a');
    await db.deleteUser(env, 'u1');
    const { results } = await env.DB.prepare('SELECT * FROM sessions').all();
    expect(results).toHaveLength(0);
  });
});

describe('upsertGithubUser', () => {
  beforeEach(resetDb);

  it('creates a user the first time that github id is seen', async () => {
    const u = await db.upsertGithubUser(env,
      { githubId: 4242, login: 'ravi', avatarUrl: 'https://x/a.png' }, T);
    expect(u.id).toBeTruthy();
    expect(u.login).toBe('ravi');
  });

  it('returns the same row on a second sign-in rather than creating a duplicate', async () => {
    const first = await db.upsertGithubUser(env,
      { githubId: 4242, login: 'ravi', avatarUrl: 'a' }, T);
    const second = await db.upsertGithubUser(env,
      { githubId: 4242, login: 'ravi', avatarUrl: 'a' }, T + DAY);
    expect(second.id).toBe(first.id);
    const { results } = await env.DB.prepare('SELECT * FROM users WHERE github_id = 4242').all();
    expect(results).toHaveLength(1);
  });

  it('updates a changed login and avatar, because people rename themselves', async () => {
    const first = await db.upsertGithubUser(env,
      { githubId: 4242, login: 'old', avatarUrl: 'old.png' }, T);
    const second = await db.upsertGithubUser(env,
      { githubId: 4242, login: 'new', avatarUrl: 'new.png' }, T + DAY);
    expect(second.id).toBe(first.id);
    expect(second.login).toBe('new');
    expect(second.avatar_url).toBe('new.png');
  });

  it('keeps two different github ids as two different accounts', async () => {
    const a = await db.upsertGithubUser(env, { githubId: 1, login: 'a', avatarUrl: '' }, T);
    const b = await db.upsertGithubUser(env, { githubId: 2, login: 'b', avatarUrl: '' }, T);
    expect(a.id).not.toBe(b.id);
  });
});
