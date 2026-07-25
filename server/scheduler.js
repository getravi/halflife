/**
 * Spaced-repetition scheduling. Pure — no I/O, no clock. `now` is always
 * a parameter so that every behaviour here is testable at a fixed instant.
 *
 * One number per card: `stability`, in days. Retrievability decays as
 * R = 0.9 ^ (elapsed / stability), which puts R at exactly 0.9 on the due
 * date. The retention target is therefore not a second free parameter.
 */
const DAY_MS = 86400000;

const GRADES = ['again', 'hard', 'good', 'easy'];
const FIRST = { hard: 2, good: 4, easy: 7 };
const MULT = { hard: 1.2, good: 2.2, easy: 3.5 };

// A lapse resets rather than shrinks. Multiplying an existing stability would
// leave a card you just forgot scheduled days out — an 8.8-day card times 0.3
// is still 2.6 days away. Forgotten means back tomorrow, whatever it was
// worth yesterday. Resetting also keeps dueAt derived from stability, which is
// what makes R exactly 0.9 on the due date.
const LAPSE_STABILITY = 1;

let seq = 0;

function newCard(fields, now) {
  seq += 1;
  return {
    id: `c${now.toString(36)}${seq.toString(36)}`,
    page: fields.page,
    taskId: fields.taskId,
    subtaskTitle: fields.subtaskTitle,
    prompt: fields.prompt,
    answer: fields.answer,
    createdAt: now,
    lastReviewedAt: null,
    dueAt: now,
    stability: 0,
    reps: 0,
    lapses: 0
  };
}

function review(card, grade, now) {
  if (!GRADES.includes(grade)) {
    throw new Error(`unknown grade "${grade}"`);
  }
  const stability = grade === 'again'
    ? LAPSE_STABILITY
    : card.reps === 0
      ? FIRST[grade]
      : Math.max(1, card.stability * MULT[grade]);

  return {
    ...card,
    stability,
    reps: card.reps + 1,
    lapses: card.lapses + (grade === 'again' ? 1 : 0),
    lastReviewedAt: now,
    dueAt: now + Math.round(stability * DAY_MS)
  };
}

function retrievability(card, now) {
  if (!card.lastReviewedAt || card.stability <= 0) return 0;
  const elapsedDays = (now - card.lastReviewedAt) / DAY_MS;
  if (elapsedDays <= 0) return 1;
  return Math.pow(0.9, elapsedDays / card.stability);
}

function isDue(card, now) {
  return now >= card.dueAt;
}

function orderQueue(cards, weightOf, now) {
  return cards
    .filter(c => isDue(c, now))
    .sort((a, b) => (a.dueAt - b.dueAt) || (weightOf(b) - weightOf(a)));
}

const SCHEDULER = { DAY_MS, newCard, review, retrievability, isDue, orderQueue };

if (typeof module !== 'undefined' && module.exports) module.exports = SCHEDULER;
if (typeof window !== 'undefined') window.SCHEDULER = SCHEDULER;
