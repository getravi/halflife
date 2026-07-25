import { json, error } from '../http.js';
import { listProgress, setProgress } from '../db.js';

const str = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

export async function list(request, env, user, url) {
  const pathId = str(url.searchParams.get('pathId'));
  if (!pathId) return error('pathId is required', 400);
  return json({ nodeIds: await listProgress(env, user.id, pathId) });
}

export async function set(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error('body is not valid JSON', 400);
  }

  const pathId = str(body.pathId);
  const nodeId = str(body.nodeId);
  // Explicitly boolean: the string "false" is truthy, and accepting it would
  // silently tick a step the user was trying to untick.
  if (!pathId || !nodeId || typeof body.done !== 'boolean') {
    return error('pathId, nodeId and a boolean done are required', 400);
  }

  await setProgress(env, user.id, pathId, nodeId, body.done, Date.now());
  return json({ ok: true });
}
