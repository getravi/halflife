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
  // Better Auth owns the user table now; the cascades still do the rest.
  await env.DB.prepare('DELETE FROM user WHERE id = ?').bind(userId).run();
}

export async function listAllCards(env, userId) {
  const { results } = await env.DB
    .prepare('SELECT * FROM cards WHERE user_id = ? ORDER BY path_id, subtask_id, created_at')
    .bind(userId).all();
  return results;
}

export async function listAllProgress(env, userId) {
  const { results } = await env.DB
    .prepare('SELECT path_id, node_id, updated_at FROM progress WHERE user_id = ? ORDER BY path_id, node_id')
    .bind(userId).all();
  return results;
}

export async function listUserReviews(env, userId) {
  const { results } = await env.DB
    .prepare('SELECT * FROM reviews WHERE user_id = ? ORDER BY ts')
    .bind(userId).all();
  return results;
}

/**
 * Only prompt and answer appear in the SET clause. The scheduling columns are
 * not preserved by care — they are unreachable from here, so fixing a typo
 * cannot silently reschedule a card reviewed for six months.
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

export async function listNotes(env, userId, pathId) {
  const { results } = await env.DB
    .prepare(`SELECT * FROM notes WHERE user_id = ? AND path_id = ?
              ORDER BY created_at DESC`)
    .bind(userId, pathId).all();
  return results;
}

export async function insertNote(env, note) {
  await env.DB.prepare(
    `INSERT INTO notes (id, user_id, path_id, subtask_id, body, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    note.id, note.user_id, note.path_id, note.subtask_id,
    note.body, note.created_at, note.updated_at
  ).run();
  return note;
}

// The user_id in the WHERE clause is the whole access check. Doing it here
// rather than in the handler means no future route can forget it.
export async function updateNoteBody(env, userId, noteId, body, now) {
  const { meta } = await env.DB.prepare(
    'UPDATE notes SET body = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).bind(body, now, noteId, userId).run();

  if (!meta.changes) return null;
  return env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(noteId).first();
}

export async function deleteNote(env, userId, noteId) {
  const { meta } = await env.DB
    .prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
    .bind(noteId, userId).run();
  return meta.changes > 0;
}

export async function listAllNotes(env, userId) {
  const { results } = await env.DB
    .prepare(`SELECT * FROM notes WHERE user_id = ?
              ORDER BY path_id, subtask_id, created_at`)
    .bind(userId).all();
  return results;
}

export async function upsertToken(env, userId, hash, now) {
  // One token per user: minting again replaces rather than accumulates, so a
  // token you thought you had rotated away cannot still be live. D1 has no
  // interactive transactions, so this is a batch.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM exercise_tokens WHERE user_id = ?').bind(userId),
    env.DB.prepare(
      'INSERT INTO exercise_tokens (token_hash, user_id, created_at) VALUES (?, ?, ?)'
    ).bind(hash, userId, now)
  ]);
}

export async function deleteToken(env, userId) {
  const { meta } = await env.DB
    .prepare('DELETE FROM exercise_tokens WHERE user_id = ?').bind(userId).run();
  return meta.changes > 0;
}

export async function userIdForToken(env, hash) {
  const row = await env.DB
    .prepare('SELECT user_id FROM exercise_tokens WHERE token_hash = ?')
    .bind(hash).first();
  return row?.user_id ?? null;
}

export async function insertAttempt(env, attempt) {
  await env.DB.prepare(
    `INSERT INTO attempts (id, user_id, exercise_id, passed, total, ran_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(attempt.id, attempt.user_id, attempt.exercise_id,
         attempt.passed, attempt.total, attempt.ran_at).run();
  return attempt;
}

export async function listAttempts(env, userId) {
  const { results } = await env.DB
    .prepare('SELECT * FROM attempts WHERE user_id = ? ORDER BY ran_at DESC')
    .bind(userId).all();
  return results;
}

export async function hasPassingAttempt(env, userId, exerciseId) {
  const row = await env.DB.prepare(
    `SELECT 1 AS ok FROM attempts
     WHERE user_id = ? AND exercise_id = ? AND passed >= total LIMIT 1`
  ).bind(userId, exerciseId).first();
  return Boolean(row);
}
