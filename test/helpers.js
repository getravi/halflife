import { env, SELF } from 'cloudflare:test';

/**
 * Truncating `user` is enough: cards, progress, reviews, enrollments, sessions
 * and accounts all cascade from it.
 */
export async function resetDb() {
  await env.DB.prepare('DELETE FROM user').run();
  env.SENT_MAIL.length = 0;
}

export function sentMail() {
  return env.SENT_MAIL;
}

/**
 * Bare rows in Better Auth's user table, for the tests that call db.js
 * directly and only need a valid foreign key. They do not need a session, so
 * signing them up through the routes would be slower and prove nothing extra.
 */
export async function seedUsers(...ids) {
  for (const id of ids) {
    await env.DB.prepare(
      `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
       VALUES (?, ?, ?, 1, 0, 0)`
    ).bind(id, id, `${id}@example.com`).run();
  }
}

/**
 * A real account: signed up, verified through the link Better Auth actually
 * generated, and signed in. Returns the cookie header to send with requests.
 *
 * Verifying through the recorded mail rather than by setting emailVerified in
 * the database means the test exercises the flow a person goes through.
 */
export async function signUp(email = 'a@example.com', password = 'correct-horse-battery') {
  const before = env.SENT_MAIL.length;

  // Origin is required: Better Auth rejects state-changing requests without
  // one as CSRF (MISSING_OR_NULL_ORIGIN). Browsers always send it on
  // same-origin POSTs; a test using fetch directly must say so explicitly.
  await SELF.fetch('https://x/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://x' },
    body: JSON.stringify({ email, password, name: email })
  });

  const mail = env.SENT_MAIL[before];
  if (!mail) throw new Error(`no verification mail was sent to ${email}`);

  const url = mail.text.match(/https?:\/\/\S+/)[0];
  const verify = await SELF.fetch(url, { redirect: 'manual' });

  // Verification signs the user in, so the cookie may come back on that
  // response; if not, sign in explicitly.
  const verified = verify.headers.get('set-cookie');
  if (verified && verified.includes('session')) return verified.split(';')[0];

  const signIn = await SELF.fetch('https://x/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://x' },
    body: JSON.stringify({ email, password })
  });
  const cookie = signIn.headers.get('set-cookie');
  if (!cookie) throw new Error(`could not sign in as ${email} after verifying`);
  return cookie.split(';')[0];
}
