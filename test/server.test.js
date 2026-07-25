const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server/index.js');

function start() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flp-srv-'));
  const root = path.join(__dirname, '..');
  const server = createServer({ dir, root });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      resolve({ server, base, dir, stop: () => new Promise(r => server.close(r)) });
    });
  });
}

const CARD_BODY = {
  page: 'phase2.html',
  taskId: 'p2-stats',
  subtaskTitle: 'Bootstrap a confidence interval',
  prompt: 'Why does a paired bootstrap beat two independent ones?',
  answer: 'Pairing removes item-level variance.'
};

const post = (base, p, body) => fetch(base + p, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

test('a posted card comes back from the list, having survived the store', async () => {
  const s = await start();
  const created = await (await post(s.base, '/api/cards', CARD_BODY)).json();
  assert.ok(created.id);
  const list = await (await fetch(s.base + '/api/cards')).json();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].prompt, CARD_BODY.prompt);
  await s.stop();
});

test('a card with an empty prompt is rejected, because a blank card is unreviewable', async () => {
  const s = await start();
  const res = await post(s.base, '/api/cards', { ...CARD_BODY, prompt: '   ' });
  assert.strictEqual(res.status, 400);
  await s.stop();
});

test('the list carries server-computed retrievability, so the scheduler lives in one place', async () => {
  const s = await start();
  await post(s.base, '/api/cards', CARD_BODY);
  const [c] = await (await fetch(s.base + '/api/cards')).json();
  assert.strictEqual(c.r, 0);
  assert.strictEqual(c.due, true);
  await s.stop();
});

test('reviewing a card advances it and writes one log line', async () => {
  const s = await start();
  const created = await (await post(s.base, '/api/cards', CARD_BODY)).json();
  const updated = await (await post(s.base, '/api/reviews',
    { cardId: created.id, grade: 'good', latencyMs: 3300 })).json();
  assert.strictEqual(updated.reps, 1);
  assert.ok(updated.dueAt > created.dueAt);
  const log = fs.readFileSync(path.join(s.dir, 'reviews.jsonl'), 'utf8').trim().split('\n');
  assert.strictEqual(log.length, 1);
  assert.strictEqual(JSON.parse(log[0]).grade, 'good');
  await s.stop();
});

test('an unknown grade is rejected rather than scheduled', async () => {
  const s = await start();
  const created = await (await post(s.base, '/api/cards', CARD_BODY)).json();
  const res = await post(s.base, '/api/reviews', { cardId: created.id, grade: 'ok', latencyMs: 1 });
  assert.strictEqual(res.status, 400);
  await s.stop();
});

test('reviewing an unknown card is a 404, not a silent success', async () => {
  const s = await start();
  const res = await post(s.base, '/api/reviews', { cardId: 'nope', grade: 'good', latencyMs: 1 });
  assert.strictEqual(res.status, 404);
  await s.stop();
});

test('state patches merge', async () => {
  const s = await start();
  await fetch(s.base + '/api/state', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ planStartDate: '2026-01-05' })
  });
  const state = await (await fetch(s.base + '/api/state')).json();
  assert.strictEqual(state.planStartDate, '2026-01-05');
  await s.stop();
});

test('the static site is still served, because this replaces make serve', async () => {
  const s = await start();
  const res = await fetch(s.base + '/');
  assert.strictEqual(res.status, 200);
  assert.ok((await res.text()).includes('view-overview'));
  await s.stop();
});

test('a path outside the root is refused, so a stray request cannot read the filesystem', async () => {
  const s = await start();
  const res = await fetch(s.base + '/../../etc/passwd');
  assert.ok(res.status === 403 || res.status === 404);
  await s.stop();
});
