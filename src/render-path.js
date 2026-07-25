/**
 * Builds the phase views from a path. This replaces tools/render.py: the same
 * markup and the same class names style.css already targets, produced in the
 * browser from data instead of baked into index.html at build time.
 */
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function subtaskCard(s) {
  return `
    <div class="task-item" data-subtask-id="${esc(s.id)}">
      <div class="task-item-header">
        <div class="task-item-title">${esc(s.title)}</div>
      </div>
      <div class="task-item-desc">${esc(s.desc)}</div>
      <div class="task-item-time">${esc(s.time ?? '')}</div>
    </div>`;
}

function milestoneSection(t) {
  return `
    <div class="day-section" id="sec-${esc(t.id)}">
      <div class="day-header">
        <span class="day-num-badge">${esc(t.badge ?? 'Milestone')}</span>
        <span class="day-title-text">${esc(t.title)}</span>
        <label class="day-check">
          <input type="checkbox" class="milestone-checkbox" data-node-id="${esc(t.id)}">
        </label>
      </div>
      <div class="milestone-box">
        <div class="milestone-heading">${esc(t.milestone?.heading ?? '')}</div>
        <ul class="milestone-items">
          ${(t.milestone?.items ?? []).map(i => `<li>${esc(i)}</li>`).join('')}
        </ul>
        ${t.milestone?.next ? `<div class="milestone-next">${esc(t.milestone.next)}</div>` : ''}
      </div>
    </div>`;
}

function taskSection(t) {
  if (!(t.subtasks ?? []).length) return milestoneSection(t);
  return `
    <div class="day-section" id="sec-${esc(t.id)}">
      <div class="day-header">
        <span class="day-num-badge">${esc(t.badge ?? '')}</span>
        <span class="day-title-text">${esc(t.title)}</span>
        <span class="task-pct-badge" id="task-pct-${esc(t.id)}">0%</span>
      </div>
      <div class="task-grid">
        ${t.subtasks.map(subtaskCard).join('')}
      </div>
    </div>`;
}

function phasePanel(ph) {
  const range = ph.weeks ? ` · Weeks ${ph.weeks[0]}–${ph.weeks[1]}` : '';
  return `
    <div id="view-${esc(ph.id)}" class="view-panel">
      <div class="container">
        <div class="page-hero">
          <div class="page-hero-eyebrow">${esc(ph.num)}${range}</div>
          <h1>${esc(ph.title)}</h1>
          <p>${esc(ph.intro)}</p>
        </div>
        ${(ph.tasks ?? []).map(taskSection).join('')}
      </div>
    </div>`;
}

export function renderPath(path, root) {
  root.insertAdjacentHTML('beforeend',
    (path.phases ?? []).map(phasePanel).join(''));
}

export function renderNav(path, nav) {
  nav.insertAdjacentHTML('beforeend',
    (path.phases ?? []).map(ph =>
      `<a href="#${esc(ph.id)}">${esc(ph.num || ph.id)}</a>`).join(''));
}
