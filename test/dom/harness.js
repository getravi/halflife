import fs from 'node:fs';
import { vi } from 'vitest';
import path from '../../paths/frontier-lab.json';

const PATH_URL = '/paths/frontier-lab-test.json';

/**
 * Boots the real app against a stubbed network.
 *
 * The document is the real index.html read off disk — the DOM project runs in
 * Node, so the filesystem is available. A harness with hand-written markup
 * would pass happily while the actual shell was missing the element a handler
 * looks up by id, which is exactly the bug six sub-projects of unverified
 * wiring could be hiding.
 */
export async function mountApp(state = {}) {
  const {
    signedIn = false,
    verified = true,
    enrolled = false,
    cards = [],
    notes = [],
    progress = [],
    providers = { github: false }
  } = state;

  const html = fs.readFileSync('index.html', 'utf8');
  const body = html
    .slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
    // Drop the module script tag. happy-dom would try to load it off disk and
    // fail; the test imports boot itself, and a noisy DOMException here would
    // mask a real one.
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.body.innerHTML = body;

  window.location.hash = '';
  localStorage.clear();

  const me = signedIn
    ? {
        user: { id: 'u1', email: 'ravi@example.com', name: 'ravi', emailVerified: verified },
        enrollments: enrolled
          ? [{ pathId: 'frontier-lab', startedOn: '2026-07-01' }]
          : [],
        providers
      }
    : { user: null, enrollments: [], providers };

  const requests = [];

  const json = (value) => new Response(JSON.stringify(value), {
    status: 200, headers: { 'content-type': 'application/json' }
  });

  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    const u = String(url);
    requests.push({
      method: opts.method ?? 'GET',
      url: u,
      body: opts.body ? JSON.parse(opts.body) : null
    });

    if (u.includes('/paths/index.json')) {
      return json({ paths: [{ id: 'frontier-lab', title: path.title, url: PATH_URL }] });
    }
    if (u.includes(PATH_URL)) return json(path);
    if (u.includes('/api/me')) return json(me);
    if (u.includes('/api/progress')) return json({ nodeIds: progress });
    if (u.includes('/api/cards')) return json({ cards });
    if (u.includes('/api/notes')) return json({ notes });
    if (u.includes('/api/reviews')) return json({ card: {} });
    if (u.includes('/api/enrollments')) return json({ ok: true });
    return json({ ok: true });
  });

  // No Cache API in happy-dom; content.js is guarded for exactly this.
  delete globalThis.caches;

  const { boot } = await import('../../src/main.js');
  await boot();

  return { requests, path };
}

/** A card shaped like a real row, for tests that need one to exist. */
export function cardFor(subtaskId, over = {}) {
  const now = Date.now();
  return {
    id: `card-${subtaskId}`,
    subtask_id: subtaskId,
    path_id: 'frontier-lab',
    prompt: 'a prompt',
    answer: 'an answer',
    created_at: now, last_reviewed_at: null, due_at: now,
    stability: 0, reps: 0, lapses: 0,
    r: 0, due: true,
    ...over
  };
}
