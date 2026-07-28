import { json, error } from '../http.js';
import { listProgress, setProgress } from '../db.js';
import EXERCISES from '../../exercises/index.json';

const str = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

// Imported, not fetched. env.ASSETS is bound in the test pool but 404s without
// a build, which would make this gate untestable on a fresh clone and would
// let an unrelated build failure decide which way it fails.
const GATED = new Set(Object.values(EXERCISES).map(e => e.gatedNodeId));

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

  // Refused in both directions. This node is written by a passing attempt and
  // by nothing else, so there is no legitimate request to let through here.
  // The disabled checkbox in the sidebar is a courtesy; this is the gate.
  if (GATED.has(nodeId)) {
    return error('this step is set by the graded suite, not by hand', 409);
  }

  await setProgress(env, user.id, pathId, nodeId, body.done, Date.now());
  return json({ ok: true });
}
