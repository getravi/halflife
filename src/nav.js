/**
 * Hash routing. Paths is the default: the app is its paths, and everything
 * else hangs off the one you open.
 */

// The views that belong to the app rather than to a path. The path bar —
// row two of the header — hides on these, because showing one path's
// phases above the catalogue is how the old nav got confusing.
const APP_VIEWS = new Set(['#paths', '#settings', '#account']);

export function initNav() {
  const apply = () => {
    const hash = window.location.hash || '#paths';
    const id = 'view-' + hash.slice(1);
    document.querySelectorAll('.view-panel').forEach(v =>
      v.classList.toggle('active', v.id === id));
    document.querySelectorAll('.nav a, .path-bar a').forEach(a =>
      a.classList.toggle('active', a.getAttribute('href') === hash));
    const bar = document.getElementById('path-bar');
    if (bar) bar.hidden = APP_VIEWS.has(hash);
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', apply);
  apply();

  const nav = document.querySelector('.nav');
  document.querySelector('.nav-toggle').addEventListener('click', () =>
    nav.classList.toggle('nav-open'));
  // Hash navigation keeps the page alive, so the drawer closes itself.
  nav.addEventListener('click', e => {
    if (e.target.closest('a')) nav.classList.remove('nav-open');
  });
}
