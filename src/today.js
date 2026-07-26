/**
 * The Today view and the review runner. Rendering only — every piece of state
 * comes through the API or the path. Shows three things in this order: what is
 * due, what week you are on, and what you finished without capturing.
 */
import { API } from './api.js';
import { CAPTURE_STATE, hasCardFor, refreshTaskBadges } from './sidebar.js';
import { rollup, allDone } from './progress.js';
import { isSignedIn } from './auth.js';
import { keyAction } from './keys.js';

const DAY_MS = 86400000;
const DAILY_CAP = 30;

// Plan dates are calendar days in the user's own timezone. toISOString would
// hand back the UTC day, so clicking "start today" on a July evening in the
// Americas records tomorrow and every week number is off by one from then on.
function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

const el = id => document.getElementById(id);

export function initToday(ctx) {
  let queue = [];
  let shownAt = 0;

  const weightOf = card => ctx.weights.subtasks[card.subtask_id] ?? 1;

  // Due-ness and retrievability come from the server, which computes them with
  // the scheduler on every read. The browser must not recompute them: the rows
  // it holds are snake_case database records, and the scheduler works in
  // camelCase, so calling it here silently yields undefined and no card is
  // ever due.
  function dueCards() {
    return CAPTURE_STATE.cards
      .filter(c => c.due)
      .sort((a, b) => (a.due_at - b.due_at) || (weightOf(b) - weightOf(a)))
      .slice(0, DAILY_CAP);
  }

  // The furthest-along task with any incomplete work, read off the week range
  // the path carries. Milestones have no weeks and are skipped.
  function currentWorkWeek(calc) {
    for (const ph of ctx.path.phases ?? []) {
      for (const t of ph.tasks ?? []) {
        if ((calc.tasks[t.id] ?? 0) >= 100) continue;
        if (t.weeks) return t.weeks[0];
      }
    }
    return null;
  }

  function renderWeek(me, calc) {
    const target = el('today-week');
    const enrolment = (me.enrollments ?? []).find(e => e.pathId === ctx.pathId);

    if (!enrolment) {
      target.innerHTML =
        `<button class="today-review-btn" id="today-set-start">Set plan start date to today</button>`;
      el('today-set-start').addEventListener('click', async () => {
        await API.enrol(ctx.pathId, localDate(new Date()));
        render();
      });
      return;
    }

    const planWeek = Math.floor(
      (Date.now() - parseLocalDate(enrolment.startedOn)) / (7 * DAY_MS)) + 1;
    const workedWeek = currentWorkWeek(calc);

    target.innerHTML = workedWeek === null
      ? `Plan week ${planWeek}. Nothing started yet.`
      : `Plan week ${planWeek} · you're working week ${workedWeek}` +
        (planWeek > workedWeek
          ? ` <span class="today-drift">(${planWeek - workedWeek} behind)</span>` : '');
  }

  function renderDebt(calc) {
    const target = el('today-debt');
    const debt = [];

    for (const ph of ctx.path.phases ?? []) {
      for (const t of ph.tasks ?? []) {
        for (const s of t.subtasks ?? []) {
          if ((calc.subtasks[s.id] ?? 0) === 100 && !hasCardFor(s.id)) {
            debt.push({ phaseId: ph.id, title: s.title });
          }
        }
      }
    }

    target.innerHTML = debt.length === 0
      ? `<span class="today-clear">None — everything you finished is captured.</span>`
      : `<div class="today-debt-count">${debt.length} finished without a card</div>` +
        debt.slice(0, 8).map(d =>
          `<a class="today-debt-item" href="#${d.phaseId}">${d.title}</a>`).join('') +
        (debt.length > 8
          ? `<div class="today-debt-more">…and ${debt.length - 8} more</div>` : '');
  }

  /**
   * Retained runs the same hierarchical bubble-up as Covered, substituting mean
   * retrievability for completion at the leaves. A flat weighted mean over
   * subtasks normalises over a different denominator and reads HIGHER than
   * Covered, which makes the pair meaningless — two numbers shown side by side
   * have to be on one scale or they are worse than one number.
   */
  function retained() {
    const byCard = {};
    for (const c of CAPTURE_STATE.cards) {
      (byCard[c.subtask_id] = byCard[c.subtask_id] || []).push(c.r ?? 0);
    }

    let overallSum = 0, overallTotal = 0;
    const byPhase = {};

    for (const ph of ctx.path.phases ?? []) {
      let phaseSum = 0, phaseTotal = 0;

      for (const t of ph.tasks ?? []) {
        const subs = t.subtasks ?? [];
        let taskPct = 0;

        if (subs.length) {
          let taskSum = 0, taskTotal = 0;
          for (const s of subs) {
            const rs = byCard[s.id] ?? [];
            const pct = rs.length ? (rs.reduce((a, b) => a + b, 0) / rs.length) * 100 : 0;
            const sw = ctx.weights.subtasks[s.id] ?? 1;
            taskSum += pct * sw;
            taskTotal += sw;
          }
          taskPct = taskTotal > 0 ? taskSum / taskTotal : 0;
        }
        // A milestone holds nothing in memory, so it contributes zero while
        // still occupying its weight — the same way it does in Covered.

        const tw = ctx.weights.tasks[t.id] ?? 1;
        phaseSum += taskPct * tw;
        phaseTotal += tw;
      }

      const phasePct = phaseTotal > 0 ? phaseSum / phaseTotal : 0;
      byPhase[ph.id] = phasePct;

      const pw = ctx.weights.phases[ph.id] ?? 1;
      overallSum += phasePct * pw;
      overallTotal += pw;
    }

    return { overall: overallTotal > 0 ? overallSum / overallTotal : 0, byPhase };
  }

  /**
   * Decay becomes an actionable queue rather than a silent lie: name the phase
   * that rotted most and the cards that recover the most of it.
   */
  function renderPressure(ret) {
    const target = el('today-retention-pressure');
    const started = Object.keys(ret.byPhase).filter(id => ret.byPhase[id] > 0);
    if (started.length === 0) { target.textContent = ''; return; }

    const worst = started.sort((a, b) => ret.byPhase[a] - ret.byPhase[b])[0];
    const subtaskIds = new Set();
    for (const ph of ctx.path.phases ?? []) {
      if (ph.id !== worst) continue;
      for (const t of ph.tasks ?? []) for (const s of t.subtasks ?? []) subtaskIds.add(s.id);
    }
    const stale = CAPTURE_STATE.cards
      .filter(c => subtaskIds.has(c.subtask_id) && c.due);

    const pct = Math.round(ret.byPhase[worst]);
    target.innerHTML = stale.length === 0
      ? `${worst.toUpperCase()} retention ${pct}% — nothing due yet.`
      : `${worst.toUpperCase()} retention ${pct}% — ` +
        `${stale.length} card${stale.length === 1 ? '' : 's'} would recover most of it.`;
  }

  async function render() {
    // Signed out is a state, not an error: the curriculum is readable and
    // nothing is tracked, so Today says so rather than showing zeroes that
    // look like a plan you have not started.
    if (!isSignedIn()) {
      el('today-covered').textContent = '—';
      el('today-retained').textContent = '—';
      el('today-due-count').textContent = '0';
      el('today-due-noun').textContent = 'cards';
      el('today-start-review').disabled = true;
      el('today-start-review').textContent = 'Sign in to review';
      el('today-week').innerHTML =
        `<span class="signed-out-note">Sign in with GitHub to track progress and write cards.</span>`;
      el('today-debt').innerHTML =
        `<span class="signed-out-note">Nothing tracked yet.</span>`;
      el('today-retention-pressure').textContent = '';
      el('today-offline').hidden = true;
      return;
    }

    const me = await API.getMe();
    const calc = rollup(ctx.path, ctx.weights, allDone());

    el('today-offline').hidden = API.online;

    const due = dueCards().length;
    el('today-due-count').textContent = due;
    el('today-due-noun').textContent = due === 1 ? 'card' : 'cards';

    // Live only once there is something to review. Covers both the load race
    // and a genuinely empty queue, which would otherwise both read as a button
    // that does nothing when pressed.
    const btn = el('today-start-review');
    btn.disabled = due === 0;
    btn.textContent = due === 0 ? 'Nothing due' : 'Start review';

    const ret = retained();
    el('today-covered').textContent = Math.round(calc.overall) + '%';
    el('today-retained').textContent = Math.round(ret.overall) + '%';
    renderPressure(ret);

    renderWeek(me, calc);
    renderDebt(calc);
    refreshTaskBadges();
  }

  function startReview() {
    queue = dueCards();
    if (queue.length === 0) return;
    el('runner').hidden = false;
    next();
  }

  function next() {
    if (queue.length === 0) {
      el('runner').hidden = true;
      render();
      return;
    }
    const card = queue[0];
    el('runner-remaining').textContent = queue.length;
    el('runner-prompt').textContent = card.prompt;
    el('runner-recall').value = '';
    el('runner-answer').textContent = card.answer;
    el('runner-answer').hidden = true;
    el('runner-grades').hidden = true;
    el('runner-reveal').hidden = false;
    shownAt = Date.now();
  }

  async function grade(g) {
    const card = queue.shift();
    const updated = await API.review(card.id, g, Date.now() - shownAt);
    if (updated) {
      const i = CAPTURE_STATE.cards.findIndex(c => c.id === updated.id);
      if (i !== -1) {
        // The route answers in the scheduler's camelCase; the cached rows are
        // snake_case, and the queue is rebuilt from them.
        CAPTURE_STATE.cards[i] = {
          ...CAPTURE_STATE.cards[i],
          last_reviewed_at: updated.lastReviewedAt,
          due_at: updated.dueAt,
          stability: updated.stability,
          reps: updated.reps,
          lapses: updated.lapses,
          // Just reviewed: not due, and fully retrievable. The server would
          // say the same on the next read.
          due: false,
          r: 1
        };
      }
    }
    // A forgotten card that is not seen again the same session is theatre.
    if (g === 'again') queue.push(card);
    next();
  }

  el('today-start-review').addEventListener('click', startReview);
  el('runner-close').addEventListener('click', () => {
    el('runner').hidden = true;
    render();
  });
  el('runner-reveal').addEventListener('click', () => {
    el('runner-answer').hidden = false;
    el('runner-grades').hidden = false;
    el('runner-reveal').hidden = true;
  });
  el('runner-grades').querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => grade(b.dataset.grade));
  });

  // One listener for the life of the page. It returns immediately when the
  // runner is hidden, so nothing fires while the plan is being read.
  document.addEventListener('keydown', (event) => {
    if (el('runner').hidden) return;

    const target = event.target;
    const typing = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT');
    const revealed = !el('runner-answer').hidden;

    const action = keyAction(event, { revealed, typing });
    if (!action) return;

    // Only once we are certain we are acting — otherwise space would scroll
    // the page underneath the runner even when the key was ignored.
    event.preventDefault();

    if (action === 'blur') { target.blur(); return; }
    if (action === 'close') { el('runner').hidden = true; render(); return; }
    if (action === 'reveal') { el('runner-reveal').click(); return; }

    grade(action);
  });

  window.TODAY = { render, dueCards, startReview, retained };
  return window.TODAY;
}
