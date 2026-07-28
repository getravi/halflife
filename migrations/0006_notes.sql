-- Notes: free-form markdown attached to a subtask.
--
-- The FK points at Better Auth's `user` table, the same target 0005 repointed
-- the other four tables to, so account deletion cascades here without
-- deleteUser changing. resetDb() in the tests relies on exactly that cascade.
--
-- subtask_id is deliberately not a foreign key, for the same reason
-- cards.subtask_id is not: path content is a file, not a table.
CREATE TABLE notes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  path_id    TEXT NOT NULL,
  subtask_id TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX notes_owner ON notes(user_id, path_id, subtask_id);
