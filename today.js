/**
 * The Today view. Rendering only — every piece of state comes through
 * window.API. Shows three things in this order: what is due, what week you
 * are on, and what you finished without capturing.
 */
import {
  ALL_PHASES,
  CAPTURE_STATE,
  loadProgress,
  recalculateAllProgress,
  hasCardFor,
  getStaticSubtaskWeight,
  getStaticTaskWeight,
  getStaticPhaseWeight
} from './app.js';
import { API } from './api.js';
import { RESOURCES_DB } from './resources_db.js';
import * as SCHEDULER from './server/scheduler.js';

{
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

  function weightOf(card) {
    return getStaticSubtaskWeight(card.page, card.taskId, card.subtaskTitle) || 1;
  }

  function dueCards() {
    const now = Date.now();
    return SCHEDULER
      .orderQueue(CAPTURE_STATE.cards, weightOf, now)
      .slice(0, DAILY_CAP);
  }

  // The plan's week labels are validated by make check, so deriving the week
  // from a start date is safe. Drift is shown rather than hidden — a tracker
  // that conceals drift is the one that already exists.
  function renderWeek(state) {
    const el = document.getElementById('today-week');
    if (!state.planStartDate) {
      el.innerHTML = `<button class="today-review-btn" id="today-set-start">Set plan start date to today</button>`;
      document.getElementById('today-set-start').addEventListener('click', async () => {
        await API.patchState({ planStartDate: localDate(new Date()) });
        render();
      });
      return;
    }
    const start = parseLocalDate(state.planStartDate);
    const planWeek = Math.floor((Date.now() - start) / (7 * DAY_MS)) + 1;

    const calc = recalculateAllProgress(loadProgress());
    const workedWeek = currentWorkWeek(calc);

    el.innerHTML = workedWeek === null
      ? `Plan week ${planWeek}. Nothing started yet.`
      : `Plan week ${planWeek} · you're working week ${workedWeek}` +
        (planWeek > workedWeek ? ` <span class="today-drift">(${planWeek - workedWeek} behind)</span>` : '');
  }

  // The furthest-along task with any incomplete work, read off the week label
  // that render.py already put in the DOM.
  function currentWorkWeek(calc) {
    for (const ph of Object.keys(ALL_PHASES)) {
      for (const taskId of ALL_PHASES[ph].tasks) {
        if ((calc.tasks[taskId] || 0) >= 100) continue;
        const section = document.getElementById('sec-' + taskId);
        const timeEl = section && section.querySelector('.task-item-time');
        const n = timeEl && timeEl.textContent.match(/\d+/);
        if (n) return Number(n[0]);
      }
    }
    return null;
  }

  function renderDebt() {
    const el = document.getElementById('today-debt');
    const calc = recalculateAllProgress(loadProgress());
    const db = RESOURCES_DB;
    const debt = [];

    for (const ph of Object.keys(ALL_PHASES)) {
      const page = ALL_PHASES[ph].page;
      for (const taskId of ALL_PHASES[ph].tasks) {
        for (const title of Object.keys(db[page]?.[taskId] || {})) {
          const pct = calc.subtasks[`${page}::${taskId}::${title}`] || 0;
          if (pct === 100 && !hasCardFor(taskId, title)) debt.push({ taskId, title });
        }
      }
    }

    el.innerHTML = debt.length === 0
      ? `<span class="today-clear">None — everything you finished is captured.</span>`
      : `<div class="today-debt-count">${debt.length} finished without a card</div>` +
        debt.slice(0, 8).map(d =>
          `<a class="today-debt-item" href="#${d.taskId}">${d.title}</a>`).join('') +
        (debt.length > 8 ? `<div class="today-debt-more">…and ${debt.length - 8} more</div>` : '');
  }

  /**
   * Retained = weighted mean retrievability across every subtask in the plan.
   * A subtask with no cards contributes zero: unverified is not the same as
   * known, and that gap is the whole point of the second number.
   */
  function retained() {
    const now = Date.now();
    const db = RESOURCES_DB;
    const byCard = {};
    for (const c of CAPTURE_STATE.cards) {
      const key = `${c.page}::${c.taskId}::${c.subtaskTitle}`;
      (byCard[key] = byCard[key] || []).push(SCHEDULER.retrievability(c, now));
    }

    // This mirrors recalculateAllProgress exactly — same nesting, same weights,
    // same normalisation at each level — substituting mean retrievability for
    // completion at the leaves. A flat weighted mean over subtasks is a
    // different denominator, and it can read HIGHER than Covered, which makes
    // the pair meaningless. Two numbers shown side by side have to be on one
    // scale or they are worse than one number.
    let overallWeightedSum = 0, overallWeightTotal = 0;
    const byPhase = {};

    for (const [phaseId, phaseInfo] of Object.entries(ALL_PHASES)) {
      const page = phaseInfo.page;
      let phaseWeightedSum = 0, phaseWeightTotal = 0;

      for (const taskId of phaseInfo.tasks) {
        let taskWeightedSum = 0, taskWeightTotal = 0;
        const titles = Object.keys(db[page]?.[taskId] || {});

        if (titles.length > 0) {
          for (const title of titles) {
            const rs = byCard[`${page}::${taskId}::${title}`] || [];
            const subtaskPct = rs.length ? (rs.reduce((a, b) => a + b, 0) / rs.length) * 100 : 0;
            const w = getStaticSubtaskWeight(page, taskId, title);
            taskWeightedSum += subtaskPct * w;
            taskWeightTotal += w;
          }
        } else {
          // A milestone has no subtasks and so nothing to hold in memory. It
          // still occupies its weight, the same way it does in Covered.
          taskWeightTotal += 1;
        }

        const taskPct = taskWeightTotal > 0 ? taskWeightedSum / taskWeightTotal : 0;
        const taskW = getStaticTaskWeight(taskId);
        phaseWeightedSum += taskPct * taskW;
        phaseWeightTotal += taskW;
      }

      const phasePct = phaseWeightTotal > 0 ? phaseWeightedSum / phaseWeightTotal : 0;
      byPhase[phaseId] = phasePct;
      const phaseW = getStaticPhaseWeight(phaseId);
      overallWeightedSum += phasePct * phaseW;
      overallWeightTotal += phaseW;
    }

    return {
      overall: overallWeightTotal > 0 ? overallWeightedSum / overallWeightTotal : 0,
      byPhase
    };
  }

  /**
   * Decay becomes an actionable queue rather than a silent lie: name the phase
   * that rotted most and the cards that recover the most of it.
   */
  function renderPressure(ret) {
    const el = document.getElementById('today-retention-pressure');
    const started = Object.keys(ALL_PHASES).filter(ph => ret.byPhase[ph] > 0);
    if (started.length === 0) { el.textContent = ''; return; }

    const worst = started.sort((a, b) => ret.byPhase[a] - ret.byPhase[b])[0];
    const page = ALL_PHASES[worst].page;
    const now = Date.now();
    const stale = CAPTURE_STATE.cards
      .filter(c => c.page === page && SCHEDULER.isDue(c, now))
      .sort((a, b) => a.dueAt - b.dueAt);

    el.innerHTML = stale.length === 0
      ? `Phase ${worst.slice(1)} retention ${Math.round(ret.byPhase[worst])}% — nothing due yet.`
      : `Phase ${worst.slice(1)} retention ${Math.round(ret.byPhase[worst])}% — ` +
        `${stale.length} card${stale.length === 1 ? '' : 's'} would recover most of it.`;
  }

  async function render() {
    CAPTURE_STATE.cards = await API.getCards();
    const state = await API.getState();

    document.getElementById('today-offline').hidden = API.online;
    const due = dueCards().length;
    document.getElementById('today-due-count').textContent = due;
    document.getElementById('today-due-noun').textContent = due === 1 ? 'card' : 'cards';

    // Live only once there is something to review. Covers both the load race
    // and a genuinely empty queue, which would otherwise both read as a button
    // that does nothing when pressed.
    const btn = document.getElementById('today-start-review');
    btn.disabled = due === 0;
    btn.textContent = due === 0 ? 'Nothing due' : 'Start review';

    const calc = recalculateAllProgress(loadProgress());
    const ret = retained();
    document.getElementById('today-covered').textContent = Math.round(calc.overall) + '%';
    document.getElementById('today-retained').textContent = Math.round(ret.overall) + '%';
    renderPressure(ret);
    renderWeek(state);
    renderDebt();
  }

  let queue = [];
  let shownAt = 0;

  const el = id => document.getElementById(id);

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
      if (i !== -1) CAPTURE_STATE.cards[i] = updated;
    }
    // A forgotten card that is not seen again the same session is theatre.
    if (g === 'again') queue.push(updated || card);
    next();
  }

  document.addEventListener('DOMContentLoaded', () => {
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
  });

  window.TODAY = { render, dueCards, startReview, retained };
}
