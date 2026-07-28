import { SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, signUp } from '../helpers.js';

let COOKIE;

const api = (path, init = {}) => SELF.fetch(`https://x${path}`, {
  ...init,
  headers: { ...(init.headers ?? {}), cookie: COOKIE }
});

const BODY = {
  pathId: 'frontier-lab',
  subtaskId: 'p2-serving-s01',
  body: 'KV cache memory bounds throughput, not compute.'
};

const post = (body) => api('/api/notes', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

describe('notes routes', () => {
  beforeEach(async () => {
    await resetDb();
    COOKIE = await signUp();
  });

  it('creates and lists a note', async () => {
    expect((await post(BODY)).status).toBe(201);

    const { notes } = await (await api('/api/notes?pathId=frontier-lab')).json();
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe(BODY.body);
    expect(notes[0].subtask_id).toBe('p2-serving-s01');
  });

  it('stores the markdown exactly as written, rather than anything rendered', async () => {
    const raw = '# Heading\n\n```\nValueError\n```\n\nSee [[Stand up vLLM]].';
    await post({ ...BODY, body: raw });

    const { notes } = await (await api('/api/notes?pathId=frontier-lab')).json();
    expect(notes[0].body).toBe(raw);
  });

  it('requires pathId on the list', async () => {
    expect((await api('/api/notes')).status).toBe(400);
  });

  it('rejects a note with no body, which would list as a blank row forever', async () => {
    expect((await post({ ...BODY, body: '   ' })).status).toBe(400);
  });

  it('rejects a create with no subtask, because every note has a home', async () => {
    expect((await post({ pathId: 'frontier-lab', body: 'orphan' })).status).toBe(400);
  });

  it('edits a note and moves updated_at without touching created_at', async () => {
    const { note } = await (await post(BODY)).json();

    const res = await api('/api/notes', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ noteId: note.id, body: 'rewritten' })
    });
    expect(res.status).toBe(200);

    const { note: after } = await res.json();
    expect(after.body).toBe('rewritten');
    expect(after.created_at).toBe(note.created_at);
    expect(after.updated_at).toBeGreaterThanOrEqual(note.created_at);
  });

  it('deletes a note, and says so only once', async () => {
    const { note } = await (await post(BODY)).json();

    expect((await api(`/api/notes?noteId=${note.id}`, { method: 'DELETE' })).status)
      .toBe(200);
    expect((await api(`/api/notes?noteId=${note.id}`, { method: 'DELETE' })).status)
      .toBe(404);
  });

  it('refuses a delete with no id, which must not read as success', async () => {
    expect((await api('/api/notes', { method: 'DELETE' })).status).toBe(400);
  });

  it('answers 401 to a stranger', async () => {
    const res = await SELF.fetch('https://x/api/notes?pathId=frontier-lab');
    expect(res.status).toBe(401);
  });
});
