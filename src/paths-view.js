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

function card(p, enrolledIds, signedIn) {
  return `
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
    </div>`;
}

export function pathCardsHtml(catalogue, enrolledIds, signedIn) {
  const all = catalogue.paths ?? [];
  const mine = all.filter(p => enrolledIds.has(p.id));
  const rest = all.filter(p => !enrolledIds.has(p.id));
  const cards = ps => ps.map(p => card(p, enrolledIds, signedIn)).join('');

  // Sections only when there is something of yours to put on top; an
  // unenrolled visitor gets one plain list, not an empty "My paths".
  if (!mine.length) return cards(all);
  return `<div class="path-section-title">My paths</div>${cards(mine)}${
    rest.length ? `<div class="path-section-title">Explore</div>${cards(rest)}` : ''}`;
}

export function renderPaths(catalogue, enrolledIds, signedIn, onEnrol) {
  const list = document.getElementById('paths-list');
  if (!list) return;

  list.innerHTML = pathCardsHtml(catalogue, enrolledIds, signedIn);

  list.querySelectorAll('.path-enrol').forEach(btn => {
    btn.addEventListener('click', () => onEnrol(btn.dataset.pathId));
  });
}
