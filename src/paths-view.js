/**
 * The homepage: one card per path. Cards render from catalogue metadata
 * alone — no full-path fetches — so this stays cheap however many paths
 * exist. The one button per card is the whole enrolment UI.
 */
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function cardButton(p, enrolledIds, signedIn) {
  if (enrolledIds.has(p.id)) {
    return `<a class="today-review-btn" href="/?path=${esc(p.id)}#today">Continue</a>`;
  }
  const first = p.phases?.[0]?.id ?? '';
  const view = `<a class="today-review-btn" href="/?path=${esc(p.id)}#${esc(first)}">View path</a>`;
  if (signedIn) {
    return `${view} <button class="today-review-btn path-enrol" data-path-id="${esc(p.id)}">Enrol</button>`;
  }
  return view;
}

export function pathCardsHtml(catalogue, enrolledIds, signedIn) {
  return (catalogue.paths ?? []).map(p => `
    <div class="path-card">
      <div class="path-card-head">
        <span class="path-title">${esc(p.title)}</span>
        ${cardButton(p, enrolledIds, signedIn)}
      </div>
      <p class="path-tagline">${esc(p.tagline)}</p>
      <div class="path-stats">${p.weeks} weeks · ${(p.phases ?? []).length} phases · ${p.tasks} tasks</div>
      <ol class="path-phase-list">
        ${(p.phases ?? []).map(ph => `<li>${esc(ph.title)}</li>`).join('')}
      </ol>
    </div>`).join('');
}

export function renderPaths(catalogue, enrolledIds, signedIn, onEnrol) {
  const list = document.getElementById('paths-list');
  if (!list) return;

  list.innerHTML = pathCardsHtml(catalogue, enrolledIds, signedIn);

  list.querySelectorAll('.path-enrol').forEach(btn => {
    btn.addEventListener('click', () => onEnrol(btn.dataset.pathId));
  });
}
