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
const CACHE_NOTES = 'flp_cache_notes';
const CACHE_ATTEMPTS = 'flp_cache_attempts';
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
    onUnverified: null,

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
      // 403 here means signed in but not verified. Distinct from 401 so the
      // frontend can say "check your inbox" rather than showing a sign-in form.
      if (res.status === 403) {
        const err = new Error(`${method} ${path} — 403`);
        err.unverified = true;
        throw err;
      }
      if (!res.ok) throw new Error(`${method} ${path} — ${res.status}`);
      return res.json();
    },

    async signout() {
      try { await API.request('POST', '/api/auth/sign-out', {}); } catch {}
    },

    async signUp(email, password) {
      return API.request('POST', '/api/auth/sign-up/email',
        { email, password, name: email });
    },

    async signIn(email, password) {
      return API.request('POST', '/api/auth/sign-in/email', { email, password });
    },

    async signInWithGithub() {
      return API.request('POST', '/api/auth/sign-in/social',
        { provider: 'github', callbackURL: '/' });
    },

    async resendVerification(email) {
      return API.request('POST', '/api/auth/send-verification-email',
        { email, callbackURL: '/' });
    },

    async forgotPassword(email) {
      return API.request('POST', '/api/auth/forget-password',
        { email, redirectTo: `${window.location.origin}/#account` });
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

    async getNotes(pathId) {
      try {
        const { notes } = await API.request(
          'GET', `/api/notes?pathId=${encodeURIComponent(pathId)}`);
        API.online = true;
        write(CACHE_NOTES, notes);
        return notes;
      } catch {
        API.online = false;
        return read(CACHE_NOTES, []);
      }
    },

    async createNote(fields) {
      const res = await API.mutate('POST', '/api/notes', fields);
      return res ? res.note : null;
    },

    async updateNote(noteId, body) {
      const res = await API.mutate('PATCH', '/api/notes', { noteId, body });
      return res ? res.note : null;
    },

    async deleteNote(noteId) {
      return API.mutate('DELETE', `/api/notes?noteId=${encodeURIComponent(noteId)}`);
    },

    async getAttempts() {
      try {
        const { attempts } = await API.request('GET', '/api/attempts');
        API.online = true;
        write(CACHE_ATTEMPTS, attempts);
        return attempts;
      } catch {
        API.online = false;
        return read(CACHE_ATTEMPTS, []);
      }
    },

    // Not outbox mutations: a token you never saw is worse than an error, and
    // there is nothing sensible to replay later.
    async mintToken() {
      return API.request('POST', '/api/exercise-token');
    },

    async revokeToken() {
      return API.request('DELETE', '/api/exercise-token');
    },

    // A read, so it is not an outbox mutation: a failure must surface rather
    // than silently exporting the cache, which would produce a file that looks
    // like a backup and is not one.
    async getExport() {
      return API.request('GET', '/api/export');
    },

    async deleteAccount() {
      return API.mutate('DELETE', '/api/me');
    },

    clearOutbox() {
      write(OUTBOX, []);
    },

    async createCard(fields) {
      const res = await API.mutate('POST', '/api/cards', fields);
      return res ? res.card : null;
    },

    async updateCard(cardId, prompt, answer) {
      const res = await API.mutate('PATCH', '/api/cards', { cardId, prompt, answer });
      return res ? res.card : null;
    },

    async deleteCard(cardId) {
      return API.mutate('DELETE', `/api/cards?cardId=${encodeURIComponent(cardId)}`);
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
        // Neither 401 nor 403 is retryable. Queueing a write that can never
        // land leaves an offline banner that never clears.
        if (e.unverified) {
          API.dequeue(entry);
          API.onUnverified?.();
          return null;
        }
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
          if (e.unverified) {
            API.dequeue(entry);
            API.onUnverified?.();
            continue;
          }
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
