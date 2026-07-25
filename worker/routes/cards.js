import { json, error } from '../http.js';
import { listCards, insertCard, newId } from '../db.js';
import { newCard, retrievability, isDue } from '../scheduler.js';

const str = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Database rows are snake_case; the scheduler works in camelCase. */
export function toScheduler(row) {
  return {
    id: row.id,
    prompt: row.prompt,
    answer: row.answer,
    createdAt: row.created_at,
    lastReviewedAt: row.last_reviewed_at,
    dueAt: row.due_at,
    stability: row.stability,
    reps: row.reps,
    lapses: row.lapses
  };
}

export function fromScheduler(card, userId, pathId, subtaskId) {
  return {
    id: card.id,
    user_id: userId,
    path_id: pathId,
    subtask_id: subtaskId,
    prompt: card.prompt,
    answer: card.answer,
    createdAt: card.createdAt,
    lastReviewedAt: card.lastReviewedAt,
    dueAt: card.dueAt,
    stability: card.stability,
    reps: card.reps,
    lapses: card.lapses
  };
}

export async function list(request, env, user, url) {
  const pathId = str(url.searchParams.get('pathId'));
  if (!pathId) return error('pathId is required', 400);

  const now = Date.now();
  const rows = await listCards(env, user.id, pathId);
  return json({
    cards: rows.map(row => {
      const c = toScheduler(row);
      return { ...row, r: retrievability(c, now), due: isDue(c, now) };
    })
  });
}

export async function create(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error('body is not valid JSON', 400);
  }

  const pathId = str(body.pathId);
  const subtaskId = str(body.subtaskId);
  const prompt = str(body.prompt);
  const answer = str(body.answer);
  if (!pathId || !subtaskId || !prompt || !answer) {
    return error('pathId, subtaskId, prompt and answer are all required', 400);
  }

  const card = newCard({ prompt, answer }, Date.now());
  card.id = newId();
  const row = fromScheduler(card, user.id, pathId, subtaskId);
  await insertCard(env, row);

  return json({ card: row }, 201);
}
