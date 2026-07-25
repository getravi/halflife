/**
 * Static file serving plus the /api routes. Wires the store to the scheduler
 * and holds no business logic of its own: retrievability and due-ness are
 * computed here on read so the scheduler exists in exactly one place and the
 * frontend never reimplements it.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.js';
import * as S from './scheduler.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function serveStatic(root, urlPath, res) {
  const rel = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  if (!file.startsWith(path.resolve(root) + path.sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

export function createServer({ dir, root, clock = () => Date.now() }) {
  const store = createStore(dir);

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (!url.pathname.startsWith('/api/')) {
      if (!root) {
        res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('No build found. Run `pnpm build` then reload, '
              + 'or run `pnpm dev` and use http://localhost:5173 instead.\n'
              + 'The API on this port is up and serving either way.\n');
        return;
      }
      return serveStatic(root, url.pathname, res);
    }

    let body = {};
    if (req.method === 'POST' || req.method === 'PATCH') {
      try {
        body = await readBody(req);
      } catch {
        return send(res, 400, { error: 'body is not valid JSON' });
      }
    }

    const now = clock();

    try {
      if (url.pathname === '/api/cards' && req.method === 'GET') {
        return send(res, 200, store.listCards().map(c => ({
          ...c, r: S.retrievability(c, now), due: S.isDue(c, now)
        })));
      }

      if (url.pathname === '/api/cards' && req.method === 'POST') {
        const required = ['page', 'taskId', 'subtaskTitle', 'prompt', 'answer'];
        for (const f of required) {
          if (typeof body[f] !== 'string' || !body[f].trim()) {
            return send(res, 400, { error: `missing or empty field "${f}"` });
          }
        }
        return send(res, 201, store.addCard(S.newCard({
          page: body.page.trim(),
          taskId: body.taskId.trim(),
          subtaskTitle: body.subtaskTitle.trim(),
          prompt: body.prompt.trim(),
          answer: body.answer.trim()
        }, now)));
      }

      if (url.pathname === '/api/reviews' && req.method === 'POST') {
        const card = store.getCard(body.cardId);
        if (!card) return send(res, 404, { error: `unknown card "${body.cardId}"` });
        let updated;
        try {
          updated = S.review(card, body.grade, now);
        } catch (e) {
          return send(res, 400, { error: e.message });
        }
        store.putCard(updated);
        store.appendReview({
          cardId: card.id, ts: now, grade: body.grade,
          latencyMs: Number(body.latencyMs) || 0
        });
        return send(res, 200, updated);
      }

      if (url.pathname === '/api/state' && req.method === 'GET') {
        return send(res, 200, store.getState());
      }

      if (url.pathname === '/api/state' && req.method === 'PATCH') {
        return send(res, 200, store.patchState(body));
      }

      return send(res, 404, { error: 'no such route' });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  });
}

const thisFile = fileURLToPath(import.meta.url);

// process.argv[1] is the entry script. Comparing it to this file is the ESM
// equivalent of `require.main === module`.
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  const repo = path.dirname(path.dirname(thisFile));
  const dir = path.join(repo, 'data');

  // Serve the Vite build when one exists. Without it there is no page to
  // serve — index.html points at /main.js, which imports style.css, and a
  // browser cannot import CSS. Falling back to the repo root would hand out a
  // page that silently renders unstyled and dead, so this serves the API alone
  // and says why.
  const dist = path.join(repo, 'dist');
  const built = fs.existsSync(path.join(dist, 'index.html'));
  const root = built ? dist : null;
  const port = Number(process.env.PORT) || 8000;

  // Refuse to boot on a corrupt store. Starting empty and overwriting a
  // damaged cards.json on the first save is the one unrecoverable failure
  // here, so it must be impossible rather than merely unlikely.
  try {
    const probe = createStore(dir);
    probe.listCards();
    probe.listReviews();
    probe.getState();
  } catch (e) {
    console.error(`FATAL: ${e.message}`);
    console.error('Refusing to start. Fix the file or restore it from git.');
    process.exit(1);
  }

  createServer({ dir, root })
    .listen(port, () => console.log(`http://localhost:${port} — ctrl-c to stop`));
}
