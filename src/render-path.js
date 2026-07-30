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

// Views that exist for every path, so a switch can keep you where you are.
// Anything else is a phase hash belonging to the old path, which would land
// on a blank panel — those switch to the target's first phase instead.
const SHARED_VIEWS = new Set(
  ['#today', '#paths', '#cards', '#glossary', '#notes', '#settings', '#account']);

export function renderNav(path, nav, catalogue) {
  const paths = catalogue?.paths ?? [];
  if (paths.length > 1) {
    nav.insertAdjacentHTML('beforeend',
      `<select class="nav-path-switcher" aria-label="Learning path">${
        paths.map(p =>
          `<option value="${esc(p.id)}"${p.id === path.id ? ' selected' : ''}>${esc(p.title)}</option>`
        ).join('')}</select>`);
    nav.querySelector('.nav-path-switcher').addEventListener('change', e => {
      const target = paths.find(p => p.id === e.target.value);
      const hash = SHARED_VIEWS.has(window.location.hash)
        ? window.location.hash
        : `#${target.phases?.[0]?.id ?? ''}`;
      window.location.href = `/?path=${encodeURIComponent(target.id)}${hash}`;
    });
  }

  nav.insertAdjacentHTML('beforeend',
    (path.phases ?? []).map(ph =>
      `<a href="#${esc(ph.id)}">${esc(ph.num || ph.id)}</a>`).join(''));
}
