import { json, error } from '../http.js';
import {
  userIdForToken, insertAttempt, listAttempts, setProgress, newId
} from '../db.js';
import { hashToken } from './tokens.js';
import EXERCISES from '../../exercises/index.json';

/**
 * The only route in this app that authenticates by something other than a
 * session. It is registered as public so the router does not demand a cookie,
 * and then does its own bearer check here — which has to be the first thing
 * in the handler and impossible to miss, because "public" in the route table
 * would otherwise read as "unauthenticated".
 */
export async function create(request, env) {
  const header = request.headers.get('authorization') ?? '';
  const raw = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!raw) return error('an exercise token is required', 401);

  const userId = await userIdForToken(env, await hashToken(raw));
  if (!userId) return error('unknown or revoked token', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('body is not valid JSON', 400);
  }

  const definition = EXERCISES[body.exerciseId];
  if (!definition) return error('no such exercise', 400);

  const { passed, total } = body;
  if (!Number.isInteger(passed) || !Number.isInteger(total)) {
    return error('passed and total must be integers', 400);
  }
  if (passed < 0 || passed > total) return error('passed must be within total', 400);
  // Without this a notebook reporting 1/1 would satisfy a five-test exercise,
  // which is the cheapest possible way to defeat the gate.
  if (total !== definition.tests) {
    return error(`this exercise has ${definition.tests} tests`, 400);
  }

  const attempt = {
    id: newId(),
    user_id: userId,
    exercise_id: body.exerciseId,
    passed,
    total,
    ran_at: Date.now()
  };
  await insertAttempt(env, attempt);

  // The only writer of a gated node. PUT /api/progress refuses it outright,
  // so this is the sole path by which that step is ever ticked.
  if (passed >= total) {
    await setProgress(env, userId, definition.pathId,
      definition.gatedNodeId, true, attempt.ran_at);
  }

  return json({ attempt }, 201);
}

export async function list(request, env, user) {
  return json({ attempts: await listAttempts(env, user.id) });
}
