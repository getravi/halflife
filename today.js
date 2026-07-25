/**
 * The Today view. Rendering only — every piece of state comes through
 * window.API. Shows three things in this order: what is due, what week you
 * are on, and what you finished without capturing.
 */
(function () {
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
    return window.SCHEDULER
      .orderQueue(window.CAPTURE_STATE.cards, weightOf, now)
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
    const db = window.RESOURCES_DB || {};
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

  async function render() {
    window.CAPTURE_STATE.cards = await API.getCards();
    const state = await API.getState();

    document.getElementById('today-offline').hidden = API.online;
    const due = dueCards().length;
    document.getElementById('today-due-count').textContent = due;
    document.getElementById('today-due-noun').textContent = due === 1 ? 'card' : 'cards';
    renderWeek(state);
    renderDebt();
  }

  window.TODAY = { render, dueCards };
})();
