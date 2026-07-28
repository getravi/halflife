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
