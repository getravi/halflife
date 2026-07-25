/**
 * The Worker. Routing, a JSON envelope, and error mapping — no business
 * logic. Anything not under /api/ is handed to the assets binding, which
 * serves the Vite build.
 */
import { getUser } from './auth.js';
import { error } from './http.js';
import * as progress from './routes/progress.js';
import * as cards from './routes/cards.js';
import * as reviews from './routes/reviews.js';
import * as meRoutes from './routes/me.js';
import * as auth from './routes/auth.js';

// [method, path, handler, isPublic]
const ROUTES = [
  ['GET', '/api/auth/github', auth.start, true],
  ['GET', '/api/auth/callback', auth.callback, true],
  ['POST', '/api/auth/signout', auth.signout, true],
  ['GET', '/api/me', meRoutes.me, true],
  ['GET', '/api/progress', progress.list],
  ['PUT', '/api/progress', progress.set],
  ['GET', '/api/cards', cards.list],
  ['POST', '/api/cards', cards.create],
  ['POST', '/api/reviews', reviews.create],
  ['DELETE', '/api/me', meRoutes.destroy],
  ['POST', '/api/enrollments', meRoutes.enrol]
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    const match = ROUTES.find(
      ([method, path]) => method === request.method && path === url.pathname
    );
    if (!match) return error('no such route', 404);

    const user = await getUser(request, env);
    if (!user && !match[3]) return error('not signed in', 401);

    try {
      return await match[2](request, env, user, url);
    } catch (e) {
      return error(e.message, 500);
    }
  }
};
