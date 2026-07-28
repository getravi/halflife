/**
 * Prerequisites, both directions. Pure string builders so they are testable
 * without a browser — the house pattern, and the only reason the renderer,
 * the card list and the keymap could be verified at all.
 */
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Buttons rather than links. Subtasks are opened with openSidebar(id) and have
 * no hash of their own — nav.js reads `#x` as the panel `view-x`, so an href
 * here would deactivate every panel and leave the page blank behind the
 * sidebar.
 *
 * doneSet may be null, meaning progress is unknown — signed out, or
 * unverified. Links still render; tick state does not, because guessing at
 * somebody's progress is worse than staying quiet about it.
 */
export function prereqHtml(subtask, ctx, doneSet) {
  const ids = (subtask?.prereqs ?? []).filter(id => ctx.index.subtasks.has(id));
  if (!ids.length) return '';

  const items = ids.map(id => {
    const s = ctx.index.subtasks.get(id);
    if (!doneSet) {
      return `<button class="prereq-item" data-subtask-id="${esc(id)}"
                >${esc(s.title)}</button>`;
    }
    const done = doneSet.has(id);
    return `<button class="prereq-item ${done ? 'prereq-done' : 'prereq-undone'}"
              data-subtask-id="${esc(id)}">${done ? '✓' : '✗'} ${esc(s.title)}</button>`;
  }).join(' · ');

  return `<div class="sidebar-section prereq-block">
    <div class="sidebar-section-title">Assumes</div>
    <div class="prereq-list">${items}</div>
  </div>`;
}

export function neededByHtml(subtask, ctx) {
  if (!subtask) return '';

  const dependents = [];
  for (const [id, s] of ctx.index.subtasks) {
    if ((s.prereqs ?? []).includes(subtask.id)) dependents.push({ id, title: s.title });
  }
  if (!dependents.length) return '';

  return `<div class="sidebar-section prereq-block">
    <div class="sidebar-section-title">Needed by</div>
    <div class="prereq-list">${dependents
      .map(d => `<button class="prereq-item" data-subtask-id="${esc(d.id)}"
                   >${esc(d.title)}</button>`)
      .join(' · ')}</div>
  </div>`;
}
