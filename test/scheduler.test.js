import test from 'node:test';
import assert from 'node:assert';
import * as S from '../server/scheduler.js';

const DAY = 86400000;
const T0 = 1750000000000; // fixed epoch — never call Date.now() in a test

function make(now = T0) {
  return S.newCard({
    page: 'phase2.html',
    taskId: 'p2-stats',
    subtaskTitle: 'Bootstrap a confidence interval',
    prompt: 'Why does a paired bootstrap beat two independent ones here?',
    answer: 'Pairing removes item-level variance, so the CI reflects the model difference rather than the item mix.'
  }, now);
}

test('a brand-new card is due immediately, because unreviewed is not the same as known', () => {
  const c = make();
  assert.strictEqual(S.isDue(c, T0), true);
  assert.strictEqual(S.retrievability(c, T0), 0);
});

test('grading good the first time schedules four days out', () => {
  const c = S.review(make(), 'good', T0);
  assert.strictEqual(c.stability, 4);
  assert.strictEqual(c.dueAt, T0 + 4 * DAY);
  assert.strictEqual(c.reps, 1);
  assert.strictEqual(c.lapses, 0);
});

test('retrievability is exactly 0.9 at the due date, because that is what due means', () => {
  const c = S.review(make(), 'good', T0);
  assert.ok(Math.abs(S.retrievability(c, c.dueAt) - 0.9) < 1e-9);
  assert.strictEqual(S.isDue(c, c.dueAt - 1), false);
  assert.strictEqual(S.isDue(c, c.dueAt), true);
});

test('retrievability decays continuously between reviews, so a stale card reads as stale', () => {
  const c = S.review(make(), 'good', T0);
  const r1 = S.retrievability(c, T0 + 1 * DAY);
  const r2 = S.retrievability(c, T0 + 3 * DAY);
  assert.ok(r1 > r2, 'later means lower');
  assert.ok(r1 < 1, 'a day after review you no longer hold it perfectly');
});

test('a lapse returns the card inside a day, because the memory is gone rather than weak', () => {
  let c = S.review(make(), 'good', T0);         // S = 4
  c = S.review(c, 'good', T0 + 4 * DAY);        // S = 8.8
  const lapsed = S.review(c, 'again', T0 + 12 * DAY);
  assert.ok(lapsed.dueAt - (T0 + 12 * DAY) <= DAY,
    'a forgotten card must come back within a day; multiplying an 8.8-day stability by anything above 0.12 would not');
  assert.strictEqual(lapsed.lapses, 1);
});

test('stability never falls below one day, so a card cannot become due in the past', () => {
  let c = S.review(make(), 'again', T0);
  for (let i = 1; i <= 5; i++) c = S.review(c, 'again', T0 + i * DAY);
  assert.ok(c.stability >= 1);
  assert.ok(c.dueAt > T0 + 5 * DAY);
});

test('easy spaces further than good, which spaces further than hard', () => {
  const base = S.review(make(), 'good', T0);
  const at = T0 + 4 * DAY;
  const hard = S.review(base, 'hard', at).stability;
  const good = S.review(base, 'good', at).stability;
  const easy = S.review(base, 'easy', at).stability;
  assert.ok(hard < good && good < easy);
});

test('an unknown grade throws rather than silently scheduling something wrong', () => {
  assert.throws(() => S.review(make(), 'ok', T0), /grade/);
});

test('the queue puts the most overdue first, so long days spend attention on what rotted most', () => {
  const a = { ...S.review(make(), 'good', T0), id: 'a' };            // due T0+4d
  const b = { ...S.review(make(), 'easy', T0), id: 'b' };            // due T0+7d
  const q = S.orderQueue([b, a], () => 1, T0 + 30 * DAY);
  assert.deepStrictEqual(q.map(c => c.id), ['a', 'b']);
});

test('equal overdueness is broken by subtask weight, so load-bearing material wins', () => {
  const a = { ...S.review(make(), 'good', T0), id: 'light' };
  const b = { ...S.review(make(), 'good', T0), id: 'heavy' };
  const weightOf = c => (c.id === 'heavy' ? 10 : 1);
  const q = S.orderQueue([a, b], weightOf, T0 + 10 * DAY);
  assert.deepStrictEqual(q.map(c => c.id), ['heavy', 'light']);
});

test('cards that are not due are excluded from the queue entirely', () => {
  const c = S.review(make(), 'easy', T0);
  assert.deepStrictEqual(S.orderQueue([c], () => 1, T0 + 1 * DAY), []);
});
