/**
 * The card list. cardsHtml is a pure string builder and renderCards mounts it,
 * which is what lets the markup be tested without a browser — the same split
 * that made render-path.js testable after the Chrome tooling failed.
 */
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const DAY = 86400000;

function dueLabel(card, now) {
  const days = Math.round((card.due_at - now) / DAY);
  if (days < 0) return `<span class="card-overdue">overdue by ${-days}d</span>`;
  if (days === 0) return 'due today';
  return `due in ${days}d`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function row(card, now) {
  return `
    <div class="card-row" data-card-id="${esc(card.id)}">
      <div class="card-display">
        <div class="card-prompt">${esc(card.prompt)}</div>
        <div class="card-answer">${esc(card.answer)}</div>
        <div class="card-meta">
          ${dueLabel(card, now)} · ${plural(card.reps ?? 0, 'review')} ·
          ${plural(card.lapses ?? 0, 'lapse')}
        </div>
        <div class="card-actions">
          <button class="card-btn" data-action="edit">Edit</button>
          <button class="card-btn" data-action="delete">Delete</button>
        </div>
      </div>
    </div>`;
}

const EMPTY =
  `<p class="signed-out-note">No cards yet — finish a subtask and capture one.</p>`;

/**
 * Grouped by phase then subtask, in path order — you come here because you
 * remember roughly where in the plan a bad card came from. Due order is what
 * the runner is for.
 */
export function cardsHtml(ctx, cards, now) {
  if (!cards.length) return EMPTY;

  const bySubtask = new Map();
  for (const c of cards) {
    // Ids are append-only so a stale one should not happen, but a list that
    // crashes is worse than one that is quietly short.
    if (!ctx.index.subtasks.has(c.subtask_id)) continue;
    if (!bySubtask.has(c.subtask_id)) bySubtask.set(c.subtask_id, []);
    bySubtask.get(c.subtask_id).push(c);
  }

  let html = '';
  for (const ph of ctx.path.phases ?? []) {
    const groups = [];
    for (const t of ph.tasks ?? []) {
      for (const s of t.subtasks ?? []) {
        const group = bySubtask.get(s.id);
        if (group) groups.push({ subtask: s, cards: group });
      }
    }
    if (!groups.length) continue;

    html += `<div class="card-phase"><div class="card-phase-title">${esc(ph.title)}</div>`;
    for (const g of groups) {
      html += `<div class="card-group">
        <div class="card-group-title">${esc(g.subtask.title)}</div>
        ${g.cards.map(c => row(c, now)).join('')}
      </div>`;
    }
    html += '</div>';
  }

  return html || EMPTY;
}

const editForm = card => `
  <div class="card-edit">
    <label class="capture-label">Question</label>
    <textarea class="capture-input" data-field="prompt" rows="2">${esc(card.prompt)}</textarea>
    <label class="capture-label">Answer</label>
    <textarea class="capture-input" data-field="answer" rows="4">${esc(card.answer)}</textarea>
    <div class="capture-actions">
      <button class="capture-save" data-action="save">Save</button>
      <button class="capture-skip" data-action="cancel">Cancel</button>
      <span class="capture-status" data-role="status"></span>
    </div>
  </div>`;

export function renderCards(ctx, cards, handlers) {
  const list = document.getElementById('cards-list');
  if (!list) return;

  const byId = new Map(cards.map(c => [c.id, c]));
  list.innerHTML = cardsHtml(ctx, cards, Date.now());

  list.onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const rowEl = btn.closest('.card-row');
    if (!rowEl) return;

    const id = rowEl.dataset.cardId;
    const card = byId.get(id);
    const action = btn.dataset.action;

    if (action === 'edit') {
      rowEl.insertAdjacentHTML('beforeend', editForm(card));
      rowEl.querySelector('.card-display').hidden = true;
      return;
    }

    if (action === 'cancel') {
      rowEl.querySelector('.card-edit').remove();
      rowEl.querySelector('.card-display').hidden = false;
      return;
    }

    if (action === 'save') {
      const prompt = rowEl.querySelector('[data-field="prompt"]').value.trim();
      const answer = rowEl.querySelector('[data-field="answer"]').value.trim();
      const status = rowEl.querySelector('[data-role="status"]');
      if (!prompt || !answer) {
        status.textContent = 'Both fields, or it is not reviewable.';
        return;
      }
      status.textContent = 'Saving…';
      await handlers.onSave(id, prompt, answer);
      return;
    }

    // Two steps rather than window.confirm: a modal blocks the page, and a
    // reflex-dismissed popup is worse friction design than a second click.
    if (action === 'delete') {
      btn.outerHTML = `<span class="card-confirm">Delete?
        <button class="card-btn" data-action="confirm-delete">yes</button>
        <button class="card-btn" data-action="cancel-delete">no</button></span>`;
      return;
    }

    if (action === 'cancel-delete') {
      btn.closest('.card-confirm').outerHTML =
        `<button class="card-btn" data-action="delete">Delete</button>`;
      return;
    }

    if (action === 'confirm-delete') {
      await handlers.onDelete(id);
    }
  };
}
