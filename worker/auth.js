/**
 * The seam. Sub-project 1 always resolves to the seeded user; sub-project 2
 * replaces this body with a signed-session-cookie lookup and returns null so
 * routes can answer 401. Nothing else in the Worker changes.
 */
export async function getUser(request, env) {
  return env.DB
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(env.DEV_USER_ID)
    .first();
}
