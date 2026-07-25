/**
 * Hash routing. Today is the default: the app opens on what is due, not on
 * an overview of what exists.
 */
export function initNav() {
  const apply = () => {
    const hash = window.location.hash || '#today';
    const id = 'view-' + hash.slice(1);
    document.querySelectorAll('.view-panel').forEach(v =>
      v.classList.toggle('active', v.id === id));
    document.querySelectorAll('.nav a').forEach(a =>
      a.classList.toggle('active', a.getAttribute('href') === hash));
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', apply);
  apply();
}
