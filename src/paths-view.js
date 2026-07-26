/**
 * The path picker. A list, deliberately — with one path it is a list of one,
 * and the richer browsing design needs a second path to be honest about.
 */
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderPaths(catalogue, enrolledIds, onEnrol) {
  const list = document.getElementById('paths-list');
  if (!list) return;

  list.innerHTML = (catalogue.paths ?? []).map(p => `
    <div class="path-row">
      <span class="path-title">${esc(p.title)}</span>
      ${enrolledIds.has(p.id)
        ? `<a class="today-review-btn" href="#today">Continue</a>`
        : `<button class="today-review-btn path-enrol" data-path-id="${esc(p.id)}">Enrol</button>`}
    </div>`).join('');

  list.querySelectorAll('.path-enrol').forEach(btn => {
    btn.addEventListener('click', () => onEnrol(btn.dataset.pathId));
  });
}
