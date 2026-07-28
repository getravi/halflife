/**
 * The exercise panel. Pure string builder, mounted by the sidebar.
 */
const REPO = 'getravi/halflife';

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const ago = (ms, now) => {
  const days = Math.floor((now - ms) / 86400000);
  if (days <= 0) return 'today';
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

export function exerciseHtml(exercise, attempts, now) {
  const mine = (attempts ?? [])
    .filter(a => a.exercise_id === exercise.id)
    .sort((a, b) => b.ran_at - a.ran_at);

  const latest = mine[0];
  // Earned is earned. The route agrees: a later failure never clears the tick.
  const passed = mine.some(a => a.passed >= a.total);

  const url = `https://colab.research.google.com/github/${REPO}`
    + `/blob/main/exercises/${encodeURIComponent(exercise.notebook)}`;

  const status = !latest
    ? `<span class="exercise-pending">Not run yet</span>`
    : `<span class="${passed ? 'exercise-passed' : 'exercise-failed'}">${
        latest.passed} / ${latest.total}${passed ? ' · passed' : ''}</span>
       <span class="exercise-when">${esc(ago(latest.ran_at, now))}</span>`;

  return `<div class="sidebar-section exercise-block">
    <div class="sidebar-section-title">Graded exercise</div>
    <div class="exercise-name">${esc(exercise.title)}</div>
    <div class="exercise-status">${status}</div>
    <a class="today-review-btn" href="${esc(url)}" target="_blank" rel="noopener"
      >Open in Colab</a>
    <p class="settings-note">The graded cell is editable, so a pass records
      that you ran it and it passed. It is not proof, and pretending otherwise
      would make it worth less than nothing.</p>
  </div>`;
}
