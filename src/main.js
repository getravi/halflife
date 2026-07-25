/**
 * Vite entry point. Boot order is explicit here rather than spread across
 * competing DOMContentLoaded handlers: the path has to exist before anything
 * can render, and progress and cards have to be loaded before Today can
 * describe them.
 */
import '../style.css';
import { loadPath } from './content.js';
import { indexPath, computeWeights } from './weights.js';
import { setProgressState } from './progress.js';
import { renderPath, renderNav } from './render-path.js';
import { initNav } from './nav.js';
import { initSidebar, CAPTURE_STATE } from './sidebar.js';
import { initToday } from './today.js';
import { API } from './api.js';

const PATH_ID = 'frontier-lab';

async function boot() {
  await API.flushOutbox();

  const path = await loadPath(PATH_ID);
  const ctx = {
    path,
    pathId: PATH_ID,
    index: indexPath(path),
    weights: computeWeights(path)
  };

  renderPath(path, document.getElementById('phase-views'));
  renderNav(path, document.querySelector('.nav'));
  initSidebar(ctx);
  initNav();

  setProgressState(await API.getProgress(PATH_ID));
  CAPTURE_STATE.cards = await API.getCards(PATH_ID);

  initToday(ctx);
  await window.TODAY.render();
}

document.addEventListener('DOMContentLoaded', boot);
