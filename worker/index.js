/**
 * The Worker. Routing, a JSON envelope, and error mapping — no business
 * logic. Anything not under /api/ is handed to the assets binding, which
 * serves the Vite build.
 */
import { getUser } from './auth.js';
import { error } from './http.js';
import * as progress from './routes/progress.js';

const ROUTES = [
  ['GET', '/api/progress', progress.list],
  ['PUT', '/api/progress', progress.set]
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
    if (!user) return error('not signed in', 401);

    try {
      return await match[2](request, env, user, url);
    } catch (e) {
      return error(e.message, 500);
    }
  }
};
