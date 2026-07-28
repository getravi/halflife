import { json } from '../http.js';
import {
  listAllCards, listAllProgress, listUserReviews, getEnrollments, listAllNotes,
  listAttempts
} from '../db.js';

/**
 * Everything the caller owns, in one object. Protected like every route but
 * the four public ones — an open export endpoint would hand over everything a
 * person had ever written in a single unauthenticated GET.
 */
export async function dump(request, env, user) {
  const [cards, progress, reviews, enrollments, notes, attempts] = await Promise.all([
    listAllCards(env, user.id),
    listAllProgress(env, user.id),
    listUserReviews(env, user.id),
    getEnrollments(env, user.id),
    listAllNotes(env, user.id),
    listAttempts(env, user.id)
  ]);

  return json({
    exportedAt: Date.now(),
    // Only the email. The internal id is of no use to the reader and there is
    // no reason to write it into a file that sits in a downloads folder.
    user: { email: user.email },
    enrollments: enrollments.map(e => ({ pathId: e.path_id, startedOn: e.started_on })),
    progress: progress.map(p => ({ pathId: p.path_id, nodeId: p.node_id })),
    cards,
    notes,
    // What you actually ran, which cannot be reconstructed from anything else
    // here. The token is deliberately absent: only its digest exists, it
    // restores nothing, and a credential sitting in a downloads folder is a
    // cost with no benefit.
    attempts,
    reviews
  });
}
