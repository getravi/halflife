import { json, error } from '../http.js';
import {
  listNotes, insertNote, updateNoteBody, deleteNote, newId
} from '../db.js';

const str = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

export async function list(request, env, user, url) {
  const pathId = str(url.searchParams.get('pathId'));
  if (!pathId) return error('pathId is required', 400);

  return json({ notes: await listNotes(env, user.id, pathId) });
}

export async function create(request, env, user) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return error('body is not valid JSON', 400);
  }

  const pathId = str(payload.pathId);
  const subtaskId = str(payload.subtaskId);
  const body = str(payload.body);
  if (!pathId || !subtaskId || !body) {
    return error('pathId, subtaskId and body are all required', 400);
  }

  const now = Date.now();
  const note = {
    id: newId(),
    user_id: user.id,
    path_id: pathId,
    subtask_id: subtaskId,
    body,
    created_at: now,
    updated_at: now
  };
  await insertNote(env, note);

  return json({ note }, 201);
}

export async function update(request, env, user) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return error('body is not valid JSON', 400);
  }

  const noteId = str(payload.noteId);
  const body = str(payload.body);
  if (!noteId) return error('noteId is required', 400);
  if (!body) return error('body is required', 400);

  // Absent and not-yours are the same answer, so this cannot be used to
  // discover which note ids exist.
  const note = await updateNoteBody(env, user.id, noteId, body, Date.now());
  if (!note) return error('no such note', 404);

  return json({ note });
}

export async function destroy(request, env, user, url) {
  const noteId = str(url.searchParams.get('noteId'));
  // A missing id must not read as "delete nothing, report success".
  if (!noteId) return error('noteId is required', 400);

  const removed = await deleteNote(env, user.id, noteId);
  if (!removed) return error('no such note', 404);

  return json({ ok: true });
}
