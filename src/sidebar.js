/**
 * The reading pane and the capture form.
 *
 * Step checkboxes carry a node id rather than a key built from page, task id,
 * subtask title and step index. That string was the reason a rename destroyed
 * progress; it no longer exists.
 */
import { API } from './api.js';
import { isDone, toggle, rollup, allDone } from './progress.js';
import { isSignedIn } from './auth.js';
import { prereqHtml, neededByHtml } from './prereq-view.js';
import { mountSidebarNotes } from './notes-view.js';

let ctx = null;                       // { path, index, weights, pathId }
export const CAPTURE_STATE = { cards: [] };
if (typeof window !== 'undefined') window.CAPTURE_STATE = CAPTURE_STATE;

export function initSidebar(context) {
  ctx = context;
  if (document.getElementById('resources-sidebar')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'sidebar-backdrop';
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  const sidebar = document.createElement('div');
  sidebar.id = 'resources-sidebar';
  sidebar.className = 'resources-sidebar';
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-title" id="sidebar-title"></div>
      <button class="sidebar-close-btn" id="sidebar-close-btn">&times;</button>
    </div>
    <div class="sidebar-body" id="sidebar-body"></div>`;
  document.body.appendChild(sidebar);

  document.getElementById('sidebar-close-btn').addEventListener('click', closeSidebar);
  backdrop.addEventListener('click', closeSidebar);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

  // Delegated, because the phase panels are built after this runs.
  document.addEventListener('click', e => {
    // Prerequisites and glossary references both jump to a subtask. Matching
    // the button rather than either class leaves the glossary's outbound <a>
    // links alone — they go to somebody else's docs, not into the sidebar.
    // Checked first: a prerequisite sits inside the open sidebar, so it must
    // replace what is showing rather than fall through to the panel behind it.
    const jump = e.target.closest('button[data-subtask-id]');
    if (jump) { openSidebar(jump.dataset.subtaskId); return; }

    const item = e.target.closest('.task-item');
    if (item && !e.target.closest('a') && !e.target.closest('input')) {
      openSidebar(item.dataset.subtaskId);
    }
  });

  // Milestones are ticked from the phase view, not from a sidebar.
  document.addEventListener('change', async e => {
    const cb = e.target.closest('.milestone-checkbox');
    if (!cb) return;
    if (!isSignedIn()) { cb.checked = false; return; }
    await toggle(ctx.pathId, cb.dataset.nodeId, cb.checked);
    refreshTaskBadges();
    window.TODAY?.render();
  });
}

export function refreshTaskBadges() {
  const calc = rollup(ctx.path, ctx.weights, allDone());
  for (const [taskId, pct] of Object.entries(calc.tasks)) {
    const el = document.getElementById(`task-pct-${taskId}`);
    if (el) el.textContent = `${Math.round(pct)}%`;
  }
  for (const cb of document.querySelectorAll('.milestone-checkbox')) {
    cb.checked = isDone(cb.dataset.nodeId);
  }
  return calc;
}

export function hasCardFor(subtaskId) {
  return CAPTURE_STATE.cards.some(c => c.subtask_id === subtaskId);
}

export function closeSidebar() {
  document.getElementById('sidebar-backdrop')?.classList.remove('active');
  document.getElementById('resources-sidebar')?.classList.remove('active');
}

const KINDS = [
  ['courses', 'Courses &amp; Tutorials'],
  ['papers', 'Research Papers'],
  ['lectures', 'Lecture Notes'],
  ['docs', 'Documentation'],
  ['videos', 'Videos'],
  ['podcasts', 'Podcasts']
];

export function openSidebar(subtaskId) {
  const s = ctx.index.subtasks.get(subtaskId);
  if (!s) return;

  document.getElementById('sidebar-title').innerHTML =
    `<div style="font-size:14px">${s.title}</div>
     <div class="sidebar-subtask-weight"><span>Subtask Weight: ${
       (ctx.weights.subtasks[s.id] ?? 0).toFixed(1)}</span></div>`;

  const steps = s.steps ?? [];
  let html = `<div class="sidebar-section">
      <div class="sidebar-section-title">Overview &amp; Goal</div>
      <p class="sidebar-desc">${s.desc}</p></div>`;

  // Progress is only known for a signed-in, verified person. Anyone else sees
  // the links without tick state.
  html += prereqHtml(s, ctx, isSignedIn() ? allDone() : null);

  html += `<div class="sidebar-section">
     <div class="sidebar-section-title">${steps.length ? 'Step-by-Step Guide' : 'Status'}</div>
     <ul class="sidebar-steps" style="list-style:none">`;

  if (steps.length) {
    for (const st of steps) {
      html += `<li class="sidebar-step-item">
        <label class="step-check-label">
          <input type="checkbox" class="step-checkbox" data-node-id="${st.id}"
                 data-subtask-id="${s.id}" ${isDone(st.id) ? 'checked' : ''}
                 ${isSignedIn() ? '' : 'disabled'}>
          <span class="step-text">${st.text}</span>
        </label>
        <div class="weight-input-container"><span>w: ${ctx.weights.steps[st.id]}</span></div>
      </li>`;
    }
  } else {
    html += `<li class="sidebar-step-item">
      <label class="step-check-label">
        <input type="checkbox" class="step-checkbox" data-node-id="${s.id}"
               data-subtask-id="${s.id}" ${isDone(s.id) ? 'checked' : ''}
               ${isSignedIn() ? '' : 'disabled'}>
        <span class="step-text">Mark this subtask as completed</span>
      </label></li>`;
  }
  html += '</ul></div>';

  html += neededByHtml(s, ctx);

  // Notes are entirely user data. Unlike the term index, there is nothing
  // here worth showing to someone who cannot write one.
  if (isSignedIn()) html += `<div class="sidebar-section" id="notes-slot"></div>`;

  for (const [key, heading] of KINDS) {
    const list = s.resources?.[key];
    if (!list?.length) continue;
    html += `<div class="sidebar-section">
      <div class="sidebar-section-title">${heading}</div>
      ${list.map(r => `<div class="sidebar-resource-card">
        <div class="sidebar-resource-name">${r.name ?? r.title ?? ''}</div>
        <a class="sidebar-resource-link" href="${r.url}" target="_blank">Open ↗</a>
      </div>`).join('')}</div>`;
  }

  const body = document.getElementById('sidebar-body');
  body.innerHTML = html;

  body.querySelectorAll('.step-checkbox').forEach(cb => {
    cb.addEventListener('change', async () => {
      await toggle(ctx.pathId, cb.dataset.nodeId, cb.checked);
      const calc = refreshTaskBadges();
      window.TODAY?.render();

      const sid = cb.dataset.subtaskId;
      if (cb.checked && calc.subtasks[sid] === 100 && !hasCardFor(sid)) {
        renderCaptureForm(sid);
      }
    });
  });

  if (isSignedIn()) mountSidebarNotes(ctx, s.id);

  document.getElementById('sidebar-backdrop').classList.add('active');
  document.getElementById('resources-sidebar').classList.add('active');
}

// Writing the card is itself the strongest available study act, which is why
// it happens at the moment the work is finished rather than being authored up
// front against material not yet learned.
export function renderCaptureForm(subtaskId) {
  const body = document.getElementById('sidebar-body');
  if (!body || body.querySelector('.capture-form')) return;

  const form = document.createElement('div');
  form.className = 'capture-form sidebar-section';
  form.innerHTML = `
    <div class="sidebar-section-title">Capture what stuck</div>
    <p class="sidebar-desc">Finished. Write it down now, in your own words —
      this is the part that makes it survive.</p>
    <label class="capture-label">What do you now know?</label>
    <textarea class="capture-input" id="capture-answer" rows="4"></textarea>
    <label class="capture-label">One question that would catch you if you forgot it</label>
    <textarea class="capture-input" id="capture-prompt" rows="2"></textarea>
    <div class="capture-actions">
      <button class="capture-save" id="capture-save">Save card</button>
      <button class="capture-skip" id="capture-skip">Skip</button>
      <span class="capture-status" id="capture-status"></span>
    </div>`;
  body.prepend(form);

  document.getElementById('capture-skip').addEventListener('click', () => form.remove());
  document.getElementById('capture-save').addEventListener('click', async () => {
    const answer = document.getElementById('capture-answer').value.trim();
    const prompt = document.getElementById('capture-prompt').value.trim();
    const status = document.getElementById('capture-status');
    if (!answer || !prompt) {
      status.textContent = 'Both fields, or it is not reviewable.';
      return;
    }
    status.textContent = 'Saving…';
    const card = await API.createCard({ pathId: ctx.pathId, subtaskId, prompt, answer });
    CAPTURE_STATE.cards = await API.getCards(ctx.pathId);
    status.textContent = card ? 'Saved.' : 'Queued — you are offline.';
    window.TODAY?.render();
    setTimeout(() => form.remove(), 1200);
  });
}
