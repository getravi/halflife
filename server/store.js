/**
 * The storage seam. Every piece of durable state goes through here, so that
 * swapping the file backend for a database later is one module rather than a
 * rewrite. Knows nothing about scheduling or HTTP.
 *
 * Writes go to a temp file and rename into place, so a crash mid-write cannot
 * truncate a file holding a year of hand-written notes. A corrupt file throws
 * on read rather than reading as empty — starting empty and saving over it is
 * the one failure that would be unrecoverable.
 */
import fs from 'node:fs';
import path from 'node:path';

function readJSON(file, fallback) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`${path.basename(file)} is not valid JSON: ${e.message}`);
  }
}

function writeJSON(file, value) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

export function createStore(dir) {
  const cardsFile = path.join(dir, 'cards.json');
  const reviewsFile = path.join(dir, 'reviews.jsonl');
  const stateFile = path.join(dir, 'state.json');

  const listCards = () => readJSON(cardsFile, []);

  return {
    listCards,

    getCard(id) {
      return listCards().find(c => c.id === id);
    },

    addCard(card) {
      const all = listCards();
      all.push(card);
      writeJSON(cardsFile, all);
      return card;
    },

    putCard(card) {
      const all = listCards();
      const i = all.findIndex(c => c.id === card.id);
      if (i === -1) throw new Error(`unknown card "${card.id}"`);
      all[i] = card;
      writeJSON(cardsFile, all);
      return card;
    },

    appendReview(entry) {
      fs.appendFileSync(reviewsFile, JSON.stringify(entry) + '\n');
      return entry;
    },

    listReviews() {
      let raw;
      try {
        raw = fs.readFileSync(reviewsFile, 'utf8');
      } catch (e) {
        if (e.code === 'ENOENT') return [];
        throw e;
      }
      return raw.split('\n').filter(Boolean).map((line, i) => {
        try {
          return JSON.parse(line);
        } catch (e) {
          throw new Error(`reviews.jsonl line ${i + 1} is not valid JSON`);
        }
      });
    },

    getState() {
      return readJSON(stateFile, {});
    },

    patchState(patch) {
      const merged = { ...readJSON(stateFile, {}), ...patch };
      writeJSON(stateFile, merged);
      return merged;
    }
  };
}
