import { json, error } from '../http.js';
import { getOwnedCard, updateCardSchedule, insertReview, newId } from '../db.js';
import { review as applyGrade } from '../scheduler.js';
import { toScheduler, fromScheduler } from './cards.js';

export async function create(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error('body is not valid JSON', 400);
  }

  // Ownership is checked, not assumed. A card that belongs to someone else
  // gets the same answer as a card that does not exist — otherwise this
  // endpoint reports which ids are real.
  const row = await getOwnedCard(env, user.id, body.cardId);
  if (!row) return error('no such card', 404);

  const now = Date.now();
  let updated;
  try {
    updated = applyGrade(toScheduler(row), body.grade, now);
  } catch (e) {
    return error(e.message, 400);
  }

  const next = fromScheduler(updated, user.id, row.path_id, row.subtask_id);
  await updateCardSchedule(env, next);
  await insertReview(env, {
    id: newId(),
    card_id: row.id,
    user_id: user.id,
    ts: now,
    grade: body.grade,
    latency_ms: Number(body.latencyMs) || 0
  });

  return json({ card: updated });
}
