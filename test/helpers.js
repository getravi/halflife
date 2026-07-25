import { env } from 'cloudflare:test';

/**
 * Truncate everything and restore the seeded dev user.
 *
 * The pool applies migrations once per test file, and writes made by one test
 * are still visible to the next, so each test resets explicitly rather than
 * trusting storage isolation to undo them.
 *
 * Deleting from users is enough — every other table cascades from it.
 */
export async function resetDb() {
  await env.DB.prepare('DELETE FROM users').run();
}

/** Adds extra users on top of the seeded one, for isolation checks. */
export async function seedUsers(...ids) {
  for (const id of ids) {
    await env.DB.prepare(
      'INSERT INTO users (id, login, created_at) VALUES (?, ?, ?)'
    ).bind(id, id, 0).run();
  }
}
