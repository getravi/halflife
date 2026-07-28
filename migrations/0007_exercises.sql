-- Every attempt is kept, not only the best. The failures are the interesting
-- record — the same reasoning that keeps the whole review log rather than
-- only the current card state.
CREATE TABLE attempts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  passed      INTEGER NOT NULL,
  total       INTEGER NOT NULL,
  ran_at      INTEGER NOT NULL
);

CREATE INDEX attempts_owner ON attempts(user_id, exercise_id, ran_at);

-- The digest is the primary key: the token itself is never stored, so a
-- database dump hands over no working credentials. One row per user, because
-- minting again replaces rather than accumulates.
CREATE TABLE exercise_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
