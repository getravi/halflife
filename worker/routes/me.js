import { json, error } from '../http.js';
import { getEnrollments, upsertEnrollment, deleteUser } from '../db.js';

// A calendar day, not an instant. The plan-week calculation counts local days,
// so accepting an ISO timestamp here would silently shift the start by one day
// for anyone west of UTC.
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// The one handler that can receive a null user, because it is public. Every
// other route stays behind the 401 in index.js and may assume a user exists —
// the exemption is exactly one handler wide, deliberately.
export async function me(request, env, user) {
  if (!user) return json({ user: null, enrollments: [] });

  const rows = await getEnrollments(env, user.id);
  return json({
    user: { id: user.id, login: user.login, avatarUrl: user.avatar_url },
    enrollments: rows.map(r => ({ pathId: r.path_id, startedOn: r.started_on }))
  });
}

export async function enrol(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error('body is not valid JSON', 400);
  }

  const pathId = typeof body.pathId === 'string' ? body.pathId.trim() : '';
  const startedOn = typeof body.startedOn === 'string' ? body.startedOn.trim() : '';
  if (!pathId) return error('pathId is required', 400);
  if (!DATE.test(startedOn)) return error('startedOn must be YYYY-MM-DD', 400);

  await upsertEnrollment(env, user.id, pathId, startedOn);
  return json({ ok: true });
}

export async function destroy(request, env, user) {
  await deleteUser(env, user.id);
  return json({ ok: true });
}
