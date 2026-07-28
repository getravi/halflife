/**
 * The Worker. Routing, a JSON envelope, and error mapping — no business
 * logic. Anything not under /api/ is handed to the assets binding, which
 * serves the Vite build.
 */
import { getUser, createAuth } from './auth.js';
import { error } from './http.js';
import * as progress from './routes/progress.js';
import * as cards from './routes/cards.js';
import * as notes from './routes/notes.js';
import * as reviews from './routes/reviews.js';
import * as meRoutes from './routes/me.js';
import * as exportRoute from './routes/export.js';
import * as tokens from './routes/tokens.js';
import * as attempts from './routes/attempts.js';

// [method, path, handler, isPublic]
const ROUTES = [
  ['GET', '/api/me', meRoutes.me, true],
  ['GET', '/api/progress', progress.list],
  ['PUT', '/api/progress', progress.set],
  ['GET', '/api/cards', cards.list],
  ['POST', '/api/cards', cards.create],
  ['PATCH', '/api/cards', cards.update],
  ['DELETE', '/api/cards', cards.destroy],
  ['GET', '/api/notes', notes.list],
  ['POST', '/api/notes', notes.create],
  ['PATCH', '/api/notes', notes.update],
  ['DELETE', '/api/notes', notes.destroy],
  ['POST', '/api/reviews', reviews.create],
  ['DELETE', '/api/me', meRoutes.destroy],
  ['POST', '/api/enrollments', meRoutes.enrol],
  ['GET', '/api/export', exportRoute.dump],
  ['POST', '/api/exercise-token', tokens.mint],
  ['DELETE', '/api/exercise-token', tokens.revoke],
  // Public in this table only because it carries a bearer token instead of a
  // cookie. attempts.create does its own authentication, first thing.
  ['POST', '/api/attempts', attempts.create, true],
  ['GET', '/api/attempts', attempts.list]
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    // Better Auth owns this prefix entirely: sign-up, sign-in, sign-out,
    // verify, reset, and the social callback.
    if (url.pathname.startsWith('/api/auth/')) {
      return createAuth(env).handler(request);
    }

    const match = ROUTES.find(
      ([method, path]) => method === request.method && path === url.pathname
    );
    if (!match) return error('no such route', 404);

    const user = await getUser(request, env);
    if (!user && !match[3]) return error('not signed in', 401);
    // 401 is "who are you"; 403 is "I know who you are and you may not". The
    // frontend needs to tell them apart to show "check your inbox" rather
    // than a sign-in form.
    if (user && !user.emailVerified && !match[3]) {
      return error('email not verified', 403);
    }

    try {
      return await match[2](request, env, user, url);
    } catch (e) {
      return error(e.message, 500);
    }
  }
};
