/**
 * Every D1 statement in the application. Nothing else knows SQL.
 *
 * Every function that touches user-owned data takes a userId and puts it in
 * the WHERE clause. That is not defence in depth — it is the only thing
 * standing between two accounts, and it is written this way before auth
 * exists so there is never a sweep later hunting for the query that forgot.
 */

let counter = 0;

/** Monotonic, sortable, dependency-free. Not a real ULID; close enough. */
export function newId() {
  counter = (counter + 1) % 0xffff;
  return Date.now().toString(36).padStart(9, '0')
       + counter.toString(36).padStart(4, '0')
       + Math.floor(Math.random() * 0xffffff).toString(36).padStart(5, '0');
}

export async function listProgress(env, userId, pathId) {
  const { results } = await env.DB
    .prepare('SELECT node_id FROM progress WHERE user_id = ? AND path_id = ?')
    .bind(userId, pathId).all();
  return results.map(r => r.node_id);
}

export async function setProgress(env, userId, pathId, nodeId, done, now) {
  if (done) {
    await env.DB.prepare(
      `INSERT INTO progress (user_id, path_id, node_id, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, path_id, node_id) DO UPDATE SET updated_at = ?`
    ).bind(userId, pathId, nodeId, now, now).run();
  } else {
    await env.DB.prepare(
      'DELETE FROM progress WHERE user_id = ? AND path_id = ? AND node_id = ?'
    ).bind(userId, pathId, nodeId).run();
  }
}

export async function listCards(env, userId, pathId) {
  const { results } = await env.DB
    .prepare('SELECT * FROM cards WHERE user_id = ? AND path_id = ? ORDER BY due_at')
    .bind(userId, pathId).all();
  return results;
}

export async function insertCard(env, card) {
  await env.DB.prepare(
    `INSERT INTO cards
       (id, user_id, path_id, subtask_id, prompt, answer,
        created_at, last_reviewed_at, due_at, stability, reps, lapses)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    card.id, card.user_id, card.path_id, card.subtask_id,
    card.prompt, card.answer, card.createdAt, card.lastReviewedAt,
    card.dueAt, card.stability, card.reps, card.lapses
  ).run();
  return card;
}

export async function getOwnedCard(env, userId, cardId) {
  const row = await env.DB
    .prepare('SELECT * FROM cards WHERE id = ? AND user_id = ?')
    .bind(cardId, userId).first();
  return row ?? undefined;
}

export async function updateCardSchedule(env, card) {
  await env.DB.prepare(
    `UPDATE cards
        SET last_reviewed_at = ?, due_at = ?, stability = ?, reps = ?, lapses = ?
      WHERE id = ? AND user_id = ?`
  ).bind(
    card.lastReviewedAt, card.dueAt, card.stability,
    card.reps, card.lapses, card.id, card.user_id
  ).run();
}

export async function insertReview(env, review) {
  await env.DB.prepare(
    `INSERT INTO reviews (id, card_id, user_id, ts, grade, latency_ms)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    review.id, review.card_id, review.user_id,
    review.ts, review.grade, review.latency_ms
  ).run();
}

export async function getEnrollments(env, userId) {
  const { results } = await env.DB
    .prepare('SELECT path_id, started_on FROM enrollments WHERE user_id = ?')
    .bind(userId).all();
  return results;
}

export async function upsertEnrollment(env, userId, pathId, startedOn) {
  await env.DB.prepare(
    `INSERT INTO enrollments (user_id, path_id, started_on)
     VALUES (?, ?, ?)
     ON CONFLICT (user_id, path_id) DO UPDATE SET started_on = ?`
  ).bind(userId, pathId, startedOn, startedOn).run();
}

export async function deleteUser(env, userId) {
  // The cascades do the rest.
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}

export async function createSession(env, userId, tokenHash, now, ttlMs, userAgent) {
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, user_agent)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(tokenHash, userId, now, now + ttlMs, userAgent ?? null).run();
}

export async function findSessionUser(env, tokenHash, now) {
  const row = await env.DB.prepare(
    `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?`
  ).bind(tokenHash, now).first();
  return row ?? null;
}

export async function deleteSession(env, tokenHash) {
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(tokenHash).run();
}

/** Swept on sign-in rather than by a cron: these rows can no longer be used. */
export async function deleteExpiredSessions(env, now) {
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run();
}

export async function upsertGithubUser(env, { githubId, login, avatarUrl }, now) {
  const existing = await env.DB
    .prepare('SELECT * FROM users WHERE github_id = ?').bind(githubId).first();

  if (existing) {
    // A login or avatar can change between sign-ins; the id must not, because
    // every card and progress row points at it.
    await env.DB.prepare('UPDATE users SET login = ?, avatar_url = ? WHERE id = ?')
      .bind(login, avatarUrl ?? null, existing.id).run();
    return { ...existing, login, avatar_url: avatarUrl ?? null };
  }

  const id = newId();
  await env.DB.prepare(
    `INSERT INTO users (id, github_id, login, avatar_url, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, githubId, login, avatarUrl ?? null, now).run();

  return { id, github_id: githubId, login, avatar_url: avatarUrl ?? null, created_at: now };
}

/**
 * Only prompt and answer appear in the SET clause. The scheduling columns are
 * not preserved by care — they are unreachable from here, so fixing a typo
 * cannot silently reschedule a card reviewed for six months.
 *
 * Returns null rather than throwing when the card is absent or owned by
 * somebody else, so the route can answer 404 identically in both cases.
 */
export async function updateCardText(env, userId, cardId, prompt, answer) {
  const { meta } = await env.DB.prepare(
    'UPDATE cards SET prompt = ?, answer = ? WHERE id = ? AND user_id = ?'
  ).bind(prompt, answer, cardId, userId).run();

  if (!meta.changes) return null;
  return env.DB.prepare('SELECT * FROM cards WHERE id = ?').bind(cardId).first();
}

export async function deleteCard(env, userId, cardId) {
  const { meta } = await env.DB
    .prepare('DELETE FROM cards WHERE id = ? AND user_id = ?')
    .bind(cardId, userId).run();
  return meta.changes > 0;
}
