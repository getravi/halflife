/**
 * The only module that talks to the server. localStorage is a read cache and
 * a write outbox here — never the source of truth.
 *
 * Writes go into the outbox before the network call. Losing a card you just
 * wrote is the single unrecoverable failure in this system; everything else
 * can be recomputed from the review log.
 */
const CACHE_CARDS = 'flp_cache_cards';
const CACHE_PROGRESS = 'flp_cache_progress';
const CACHE_ME = 'flp_cache_me';
const OUTBOX = 'flp_outbox';

const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
};
const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

// Outbox entries need an identity that survives a reload and cannot collide.
// Date.now() alone does: two mutations in the same millisecond would dequeue
// each other, silently dropping one write.
let seq = 0;
const nextId = () => `${Date.now()}-${++seq}`;

export const API = {
    online: true,
    onUnauthorized: null,

    pendingCount() {
      return read(OUTBOX, []).length;
    },

    async request(method, path, body) {
      const res = await fetch(path, {
        method,
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
      });
      if (res.status === 401) {
        const err = new Error(`${method} ${path} — 401`);
        err.unauthorized = true;
        throw err;
      }
      if (!res.ok) throw new Error(`${method} ${path} — ${res.status}`);
      return res.json();
    },

    async signout() {
      try { await API.request('POST', '/api/auth/signout'); } catch {}
    },

    async getMe() {
      try {
        const me = await API.request('GET', '/api/me');
        API.online = true;
        write(CACHE_ME, me);
        return me;
      } catch {
        API.online = false;
        return read(CACHE_ME, { user: null, enrollments: [] });
      }
    },

    async enrol(pathId, startedOn) {
      return API.mutate('POST', '/api/enrollments', { pathId, startedOn });
    },

    async getProgress(pathId) {
      try {
        const { nodeIds } = await API.request(
          'GET', `/api/progress?pathId=${encodeURIComponent(pathId)}`);
        API.online = true;
        write(CACHE_PROGRESS, nodeIds);
        return nodeIds;
      } catch {
        API.online = false;
        return read(CACHE_PROGRESS, []);
      }
    },

    async setProgress(pathId, nodeId, done) {
      return API.mutate('PUT', '/api/progress', { pathId, nodeId, done });
    },

    async getCards(pathId) {
      try {
        const { cards } = await API.request(
          'GET', `/api/cards?pathId=${encodeURIComponent(pathId)}`);
        API.online = true;
        write(CACHE_CARDS, cards);
        return cards;
      } catch {
        API.online = false;
        return read(CACHE_CARDS, []);
      }
    },

    async createCard(fields) {
      const res = await API.mutate('POST', '/api/cards', fields);
      return res ? res.card : null;
    },

    async review(cardId, grade, latencyMs) {
      const res = await API.mutate('POST', '/api/reviews', { cardId, grade, latencyMs });
      return res ? res.card : null;
    },

    // Queue first, then send. If the send fails the entry is already durable.
    async mutate(method, path, body) {
      const outbox = read(OUTBOX, []);
      const entry = { method, path, body, queuedAt: nextId() };
      outbox.push(entry);
      write(OUTBOX, outbox);

      try {
        const result = await API.request(method, path, body);
        API.online = true;
        API.dequeue(entry);
        return result;
      } catch (e) {
        // A 401 is not a retryable failure. Queueing it would mean every tick
        // piles up a write that can never succeed, behind an offline banner
        // that never clears. Drop it and let the caller re-authenticate.
        if (e.unauthorized) {
          API.dequeue(entry);
          API.onUnauthorized?.();
          return null;
        }
        API.online = false;
        return null;
      }
    },

    dequeue(entry) {
      write(OUTBOX, read(OUTBOX, []).filter(e => e.queuedAt !== entry.queuedAt));
    },

    async flushOutbox() {
      const pending = read(OUTBOX, []);
      let flushed = 0;
      for (const entry of pending) {
        try {
          await API.request(entry.method, entry.path, entry.body);
          API.dequeue(entry);
          flushed++;
        } catch (e) {
          if (e.unauthorized) {
            API.dequeue(entry);
            API.onUnauthorized?.();
            continue;
          }
          API.online = false;
          break; // preserve order; try again next time
        }
      }
      if (flushed) API.online = true;
      return flushed;
    }
  };

// Guarded because this module is imported by pure code the tests run outside
// a browser. A module that reaches for a global the moment it is imported
// cannot be depended on by anything that does not have one.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { API.flushOutbox(); });
}
