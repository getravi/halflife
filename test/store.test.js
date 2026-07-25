import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../server/store.js';

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'flp-store-'));
}

const CARD = {
  id: 'c1', page: 'phase2.html', taskId: 'p2-stats',
  subtaskTitle: 'Bootstrap a confidence interval',
  prompt: 'Why paired?', answer: 'Removes item-level variance.',
  createdAt: 1, lastReviewedAt: null, dueAt: 1, stability: 0, reps: 0, lapses: 0
};

test('a fresh directory reads as empty rather than throwing', () => {
  const s = createStore(tmpdir());
  assert.deepStrictEqual(s.listCards(), []);
  assert.deepStrictEqual(s.listReviews(), []);
  assert.deepStrictEqual(s.getState(), {});
});

test('cards round-trip through a new store instance, because the process will restart', () => {
  const dir = tmpdir();
  createStore(dir).addCard(CARD);
  assert.deepStrictEqual(createStore(dir).listCards(), [CARD]);
});

test('putCard replaces by id and does not duplicate', () => {
  const dir = tmpdir();
  const s = createStore(dir);
  s.addCard(CARD);
  s.putCard({ ...CARD, reps: 3 });
  const all = s.listCards();
  assert.strictEqual(all.length, 1);
  assert.strictEqual(all[0].reps, 3);
});

test('putCard on an unknown id throws, because a silent no-op would lose a review', () => {
  const s = createStore(tmpdir());
  assert.throws(() => s.putCard(CARD), /unknown card/);
});

test('reviews append and never rewrite, so card state stays replayable', () => {
  const dir = tmpdir();
  const s = createStore(dir);
  s.appendReview({ cardId: 'c1', ts: 10, grade: 'good', latencyMs: 4200 });
  s.appendReview({ cardId: 'c1', ts: 20, grade: 'again', latencyMs: 9100 });
  const lines = fs.readFileSync(path.join(dir, 'reviews.jsonl'), 'utf8').trim().split('\n');
  assert.strictEqual(lines.length, 2);
  assert.deepStrictEqual(createStore(dir).listReviews().map(r => r.grade), ['good', 'again']);
});

test('state merges shallowly rather than replacing, so one writer cannot drop another key', () => {
  const dir = tmpdir();
  const s = createStore(dir);
  s.patchState({ planStartDate: '2026-01-05' });
  s.patchState({ dailyCap: 30 });
  assert.deepStrictEqual(createStore(dir).getState(), { planStartDate: '2026-01-05', dailyCap: 30 });
});

test('a corrupt cards file throws on read instead of reading as empty', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'cards.json'), '{ this is not json');
  assert.throws(() => createStore(dir).listCards(), /cards\.json/);
});

test('a crash mid-write cannot truncate the existing file, because writes rename into place', () => {
  const dir = tmpdir();
  const s = createStore(dir);
  s.addCard(CARD);
  // simulate a crash that left a temp file behind
  fs.writeFileSync(path.join(dir, 'cards.json.tmp'), '{ partial');
  assert.deepStrictEqual(createStore(dir).listCards(), [CARD]);
});
