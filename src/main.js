/**
 * Vite entry point. Boot resolves one of four states — signed out, signed in
 * but unverified, verified without an enrolment, and verified and enrolled —
 * each landing somewhere different. The curriculum renders in every case;
 * only writing is gated.
 */
import '../style.css';
import { loadPath, loadCatalogue, resolvePathId } from './content.js';
import { indexPath, computeWeights } from './weights.js';
import { setProgressState } from './progress.js';
import { renderPath, renderNav } from './render-path.js';
import { initNav } from './nav.js';
import { initSidebar, CAPTURE_STATE, ATTEMPTS_STATE } from './sidebar.js';
import { initToday } from './today.js';
import { renderPaths } from './paths-view.js';
import { renderCards } from './cards-view.js';
import { renderGlossary, initTermJumps } from './glossary-view.js';
import { NOTES_STATE, renderNotesView } from './notes-view.js';
import { renderSettings } from './settings-view.js';
import { setMe, renderHeader, isSignedIn } from './auth.js';
import { renderAuthView } from './auth-view.js';
import { API } from './api.js';

// The local calendar day. toISOString returns the UTC day and would shift the
// plan start for anyone west of UTC.
function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function boot() {
  // A 401 anywhere flips the header back to signed out rather than leaving a
  // dead session that silently drops every write.
  API.onUnauthorized = () => {
    setMe({ user: null, enrollments: [] });
    renderHeader();
  };
  // A stale verification state must not queue writes that can never land.
  API.onUnverified = () => { window.location.hash = '#account'; };

  await API.flushOutbox();

  const me = await API.getMe();
  setMe(me);
  renderHeader();

  const catalogue = await loadCatalogue();
  const PATH_ID = resolvePathId(window.location.search, catalogue, me.enrollments);

  const path = await loadPath(PATH_ID);
  const ctx = {
    path,
    pathId: PATH_ID,
    index: indexPath(path),
    weights: computeWeights(path)
  };

  renderPath(path, document.getElementById('phase-views'));
  renderNav(path, document.getElementById('path-bar'));
  initSidebar(ctx);

  // Content, not user data — it renders whether or not anyone is signed in.
  renderGlossary(ctx);
  initTermJumps();

  // isSignedIn means signed in AND verified: an unverified account must not
  // request the data it is not allowed to change.
  if (isSignedIn()) {
    setProgressState(await API.getProgress(PATH_ID));
    CAPTURE_STATE.cards = await API.getCards(PATH_ID);
    NOTES_STATE.notes = await API.getNotes(PATH_ID);
    ATTEMPTS_STATE.attempts = await API.getAttempts();
  } else {
    // Cleared rather than left alone. Today this only shows up in tests, since
    // signing out reloads the page and module state starts empty — but relying
    // on that means one view rendered without a reload would show the previous
    // person's writing.
    CAPTURE_STATE.cards = [];
    NOTES_STATE.notes = [];
    ATTEMPTS_STATE.attempts = [];
  }

  // Outside the signed-in branch on purpose. The #notes panel exists in the
  // markup for everyone, so if this only ran for a signed-in person the view
  // would be a blank page rather than one saying there is nothing here.
  renderNotesView(ctx);

  // Re-boot after a successful sign-in or sign-up rather than patching state
  // in place: every view depends on who is asking.
  renderAuthView(async () => { window.location.reload(); });

  const enrolled = new Set((me.enrollments ?? []).map(e => e.pathId));
  renderPaths(catalogue, enrolled, isSignedIn(), async pathId => {
    await API.enrol(pathId, localDate(new Date()));
    // A changed query string is a navigation, so the reload comes free.
    window.location.href = `/?path=${encodeURIComponent(pathId)}#today`;
  });

  // Cards are edited in place rather than refetched: the outbox guarantees
  // delivery, and a refetch while offline would serve the cached list and make
  // the edit appear to vanish.
  function paintCards() {
    renderCards(ctx, CAPTURE_STATE.cards, {
      async onSave(cardId, prompt, answer) {
        await API.updateCard(cardId, prompt, answer);
        const card = CAPTURE_STATE.cards.find(c => c.id === cardId);
        if (card) { card.prompt = prompt; card.answer = answer; }
        paintCards();
        await window.TODAY.render();
      },
      async onDelete(cardId) {
        await API.deleteCard(cardId);
        CAPTURE_STATE.cards = CAPTURE_STATE.cards.filter(c => c.id !== cardId);
        paintCards();
        await window.TODAY.render();
      }
    });
  }
  paintCards();

  if (isSignedIn()) {
    renderSettings(ctx, me);
  } else {
    // Signed out we know nothing about anyone's cards or account, so say that
    // rather than showing empty panels that read as "you have none".
    document.getElementById('cards-list').innerHTML =
      `<span class="signed-out-note">Sign in to see your cards.</span>`;
    document.querySelector('#view-settings .container').innerHTML =
      `<section class="today-block"><span class="signed-out-note">Sign in to export or delete your data.</span></section>`;
  }

  initToday(ctx);

  if (me.user && !me.user.emailVerified) {
    window.location.hash = '#account';
  } else if (!window.location.hash) {
    // The app is its paths; everyone starts at the catalogue. Explicit
    // hashes are always respected — browsing needs no enrolment.
    window.location.hash = '#paths';
  }

  initNav();
  await window.TODAY.render();
}

// Exported so tests can drive it directly: by the time a test module imports
// this file, DOMContentLoaded has already fired and the listener would never
// run. Separating the function from its registration is how a boot sequence
// should be written regardless.
export { boot };

document.addEventListener('DOMContentLoaded', boot);
