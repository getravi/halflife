/**
 * Notes: the list, the editor, and the mount points.
 *
 * notesHtml is a pure string builder and the mount functions are thin, the
 * same split as cardsHtml and glossaryHtml.
 */
import { API } from './api.js';
import { renderNote } from './markdown.js';

export const NOTES_STATE = { notes: [] };

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const day = ms => new Date(ms).toISOString().slice(0, 10);

const EMPTY = `<p class="signed-out-note">No notes on this yet.</p>`;

export function notesHtml(notes, ctx, subtaskId) {
  const mine = (notes ?? [])
    .filter(n => n.subtask_id === subtaskId)
    .sort((a, b) => b.created_at - a.created_at);

  if (!mine.length) return EMPTY;

  return mine.map(n => `
    <div class="note-row" data-note-id="${esc(n.id)}">
      <div class="note-body">${renderNote(n.body, ctx)}</div>
      <div class="note-meta">
        ${esc(day(n.created_at))}
        ${n.updated_at > n.created_at ? `· edited ${esc(day(n.updated_at))}` : ''}
        <button class="card-btn" data-action="edit">Edit</button>
        <button class="card-btn" data-action="delete">Delete</button>
      </div>
    </div>`).join('');
}

/**
 * Every note for the path, grouped by subtask in path order — you come here
 * remembering roughly where in the plan you wrote something.
 *
 * The filter matches the markdown source and the subtask title, not the
 * rendered HTML: searching for "code" should not match every note that
 * happens to contain a code block.
 */
export function allNotesHtml(notes, ctx, filter) {
  const needle = String(filter ?? '').trim().toLowerCase();
  const groups = [];

  for (const ph of ctx.path.phases ?? []) {
    for (const t of ph.tasks ?? []) {
      for (const s of t.subtasks ?? []) {
        const mine = (notes ?? [])
          .filter(n => n.subtask_id === s.id)
          .filter(n => !needle
            || n.body.toLowerCase().includes(needle)
            || String(s.title).toLowerCase().includes(needle))
          .sort((a, b) => b.created_at - a.created_at);

        if (mine.length) groups.push({ subtask: s, notes: mine });
      }
    }
  }

  if (!groups.length) return `<p class="signed-out-note">No notes match.</p>`;

  return groups.map(g => `
    <div class="notes-group">
      <button class="notes-group-title" data-subtask-id="${esc(g.subtask.id)}"
        >${esc(g.subtask.title)}</button>
      ${g.notes.map(n => `
        <div class="note-row" data-note-id="${esc(n.id)}">
          <div class="note-body">${renderNote(n.body, ctx)}</div>
          <div class="note-meta">${esc(day(n.created_at))}</div>
        </div>`).join('')}
    </div>`).join('');
}

/**
 * No editing here on purpose: the subtask heading is a button that opens the
 * sidebar, where editing already lives. One place to change a note beats two.
 */
export function renderNotesView(ctx) {
  const list = document.getElementById('notes-list-all');
  const box = document.getElementById('notes-filter');
  if (!list || !box) return;

  const paint = () => {
    list.innerHTML = allNotesHtml(NOTES_STATE.notes, ctx, box.value);
  };
  box.addEventListener('input', paint);
  paint();
}

/**
 * Renders into the slot the sidebar leaves, and wires add, edit and delete.
 * Rebuilt from NOTES_STATE after every mutation rather than patched in place:
 * the list is small and a patch that drifts from the server is a bug you find
 * a week later.
 */
export function mountSidebarNotes(ctx, subtaskId) {
  const slot = document.getElementById('notes-slot');
  if (!slot) return;

  const paint = () => {
    slot.innerHTML = `
      <div class="sidebar-section-title">Notes</div>
      <div id="notes-list">${notesHtml(NOTES_STATE.notes, ctx, subtaskId)}</div>
      <textarea class="capture-input" id="note-input" rows="3"
                placeholder="Markdown. [[Subtask name]] links into the plan."></textarea>
      <div class="capture-actions">
        <button class="capture-save" id="note-save">Add note</button>
        <span class="capture-status" id="note-status"></span>
      </div>`;

    document.getElementById('note-save').addEventListener('click', async () => {
      const input = document.getElementById('note-input');
      const status = document.getElementById('note-status');
      const body = input.value.trim();
      if (!body) { status.textContent = 'Nothing to save.'; return; }

      status.textContent = 'Saving…';
      const note = await API.createNote({ pathId: ctx.pathId, subtaskId, body });
      NOTES_STATE.notes = await API.getNotes(ctx.pathId);
      paint();
      if (!note) {
        document.getElementById('note-status').textContent = 'Queued — you are offline.';
      }
    });

    slot.querySelectorAll('.note-row .card-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.note-row');
        const id = row.dataset.noteId;

        if (btn.dataset.action === 'delete') {
          await API.deleteNote(id);
          NOTES_STATE.notes = await API.getNotes(ctx.pathId);
          paint();
          return;
        }

        const current = NOTES_STATE.notes.find(n => n.id === id);
        row.innerHTML = `
          <textarea class="capture-input note-edit" rows="4">${esc(current?.body)}</textarea>
          <div class="capture-actions">
            <button class="capture-save" data-action="save">Save</button>
            <button class="capture-skip" data-action="cancel">Cancel</button>
          </div>`;

        row.querySelector('[data-action="cancel"]')
          .addEventListener('click', () => paint());
        row.querySelector('[data-action="save"]').addEventListener('click', async () => {
          const body = row.querySelector('.note-edit').value.trim();
          if (body) await API.updateNote(id, body);
          NOTES_STATE.notes = await API.getNotes(ctx.pathId);
          paint();
        });
      });
    });
  };

  paint();
}
