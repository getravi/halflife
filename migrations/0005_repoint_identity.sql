-- Destructive by design. Acceptable only because nothing is deployed and the
-- only rows are a seeded dev user and local test writes.
--
-- DO NOT COPY THIS PATTERN once real accounts exist. SQLite cannot alter a
-- foreign key in place, so repointing means rebuilding the table. With no data
-- that is a drop and a create; with data it is a copy, a backfill and a
-- careful cutover, and this file would be four times longer.

DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS progress;
DROP TABLE IF EXISTS enrollments;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

CREATE TABLE enrollments (
  user_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  path_id    TEXT NOT NULL,
  started_on TEXT NOT NULL,
  PRIMARY KEY (user_id, path_id)
);

CREATE TABLE progress (
  user_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  path_id    TEXT NOT NULL,
  node_id    TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, path_id, node_id)
);

CREATE TABLE cards (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  path_id          TEXT NOT NULL,
  subtask_id       TEXT NOT NULL,
  prompt           TEXT NOT NULL,
  answer           TEXT NOT NULL,
  created_at       INTEGER NOT NULL,
  last_reviewed_at INTEGER,
  due_at           INTEGER NOT NULL,
  stability        REAL NOT NULL DEFAULT 0,
  reps             INTEGER NOT NULL DEFAULT 0,
  lapses           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE reviews (
  id         TEXT PRIMARY KEY,
  card_id    TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  ts         INTEGER NOT NULL,
  grade      TEXT NOT NULL CHECK (grade IN ('again','hard','good','easy')),
  latency_ms INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX cards_due    ON cards(user_id, path_id, due_at);
CREATE INDEX reviews_card ON reviews(card_id, ts);
