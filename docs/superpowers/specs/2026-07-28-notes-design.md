# Notes — design

Date: 2026-07-28
Status: approved, not yet planned

## Problem

Everything you write in this app today has to be phrased as a question and an
answer, and it can only be written at the moment a subtask is finished. That is
the right shape for the thing it does — a card you will be graded on — and the
wrong shape for most of what happens while you work.

A stack trace that cost two hours. The flag that fixed it. A derivation you
want back in nine weeks. A paper you read and one sentence on why it mattered.
None of that is a card, so none of it gets written down, and the tool that
exists to hold your progress does not hold your work.

## Where this sits

Sub-project 2 of four, from the decomposition in
[the structure spec](2026-07-27-structure-design.md):

1. **Structure** — prerequisites and a term index. Shipped.
2. **Notes** — this spec.
3. **Curated open material** — open-licensed content rendered in-app.
4. **Coding exercises** — run in Google Colab.

The founding constraint still holds: **the app owns everything around the
teaching, and generated explanations are not acceptable.** Notes fit that
cleanly, because every word in them is yours.

**Out of scope:** backlinks, note templates, sharing, attachments or images,
and any inference about what you should write.

## Decisions taken before this spec

Each of these closed a real fork, so they are recorded with the reason:

- **Notes are separate from cards, not a replacement and not a substrate.**
  Cards stay exactly as they are. The capture-at-completion flow is the one
  piece of this app with evidence behind it, and it is not being disturbed to
  make a schema tidier.
- **A note always attaches to a subtask.** No free-floating notes. Everything
  has a home in the plan, and there is no drawer for things to fall into.
- **Full markdown, via `markdown-it`, on its defaults.**
- **Double-bracketed names link back into the plan.**

### Why `markdown-it` and not `marked`

`marked` is smaller — 450KB unpacked against 1.7MB — and it renders raw HTML
straight through. Measured, not assumed:

```
marked:      <img src=x onerror=alert(1)><p>…</p><script>alert(2)</script>
markdown-it: <p>&lt;img src=x onerror=alert(1)&gt;</p> … <p>&lt;script&gt;…</p>
```

So `marked` needs DOMPurify beside it, which is another 1.7MB, and the smaller
library ends up the larger dependency. `markdown-it` also refuses
`javascript:` in links and images by default — the link is not rendered as a
link at all.

**One bundle dependency, no sanitiser, no configuration.** The worker gains
nothing: markdown is rendered only in the browser.

### Why unresolved links stay literal

A `[[name]]` that matches no subtask title and no term renders as the text you
typed, not as a link.

Titles get reworded — the path format exists to make that safe, and there are
already commits that reworded them. A link that silently rots into a dead one
is worse than text that visibly shows you named something that is not there.

## Data

```sql
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
```

Migration `0006_notes.sql`. The FK points at Better Auth's `user` table, the
same target the other four tables were repointed to in `0005`, so account
deletion already cascades and `deleteUser` needs no change.

**The body is stored as raw markdown, never as rendered HTML.** A bug in the
renderer is then a display bug that a fix repairs everywhere, rather than
something baked permanently into your data.

`subtask_id` is not a foreign key, exactly as `cards.subtask_id` is not: path
content is a file, not a table. The renderer skips ids that no longer resolve,
which is the same thing `buildMarkdown` already does.

## API

Four routes on the existing table, behind the same `getUser` seam and the same
verified-email check as cards:

| Method | Path | Returns |
|---|---|---|
| GET | `/api/notes?pathId=` | `{ notes: [...] }`, newest first |
| POST | `/api/notes` | `{ note }` |
| PATCH | `/api/notes` | `{ note }` |
| DELETE | `/api/notes?noteId=` | `{ ok: true }` |

Every write goes through `API.mutate`, so notes inherit the outbox. That is not
incidental: losing a note you just wrote is the same unrecoverable failure the
outbox was built for.

Ownership is enforced in the query, not in the handler — `WHERE id = ? AND
user_id = ?` — matching `updateCardText` and `deleteCard`.

## Rendering

`src/markdown.js` exports `renderNote(body, ctx)`, a pure function returning an
HTML string. It configures one `markdown-it` instance and adds a single inline
rule for `[[...]]`:

- resolve against subtask titles first, then glossary terms
- a resolved subtask becomes `<button class="note-link" data-subtask-id="…">`
- a resolved term becomes a button that opens the term index filtered to it
- anything unresolved is emitted as literal text

The subtask button needs no new handler: `sidebar.js` already delegates on
`button[data-subtask-id]`, which is why that selector was widened from a class
when the glossary was built.

## Interface

**In the sidebar**, below the steps and above the resources: a Notes section
listing this subtask's notes, each with an edit and a delete control, and an
"Add a note" box. Signed out or unverified, the section is not rendered at all
— it is entirely user data, unlike the term index.

**A `#notes` view**: every note for the path, grouped by subtask in path order,
with a filter box. Notes load wholesale with the rest of the path data, the way
cards already do, so filtering is client-side and immediate.

`notesHtml(notes, ctx, filter)` is a pure string builder, mounted by a thin
wrapper — the house pattern.

## Export

Notes join `buildMarkdown`, under their subtask heading beside that subtask's
cards. The export stops being a backup on the day the first note is written
otherwise, and it is offered in Settings as exactly that.

## Testing

On top of the existing 240:

- `renderNote` escapes raw HTML, refuses a `javascript:` link, renders fenced
  code, resolves a subtask name and a term name, and leaves an unresolved name
  as literal text
- worker tests that user A cannot read, edit or delete user B's notes — the
  isolation tests cards already have, which are the reason this is safe to
  host at all
- **deleting an account leaves none of its notes behind.** The existing
  deletion test asserts the *other* user's data survives and never asserts the
  deleted user's rows are gone, so the cascade is currently believed rather
  than tested. Notes are the right place to fix that, since a note is the most
  personal thing this app will store.
- a note write while offline lands in the outbox and flushes
- `buildMarkdown` includes notes, and still reads correctly for a subtask that
  has notes but no cards
- DOM tests: writing a note renders it, the filter narrows the list, and
  clicking a resolved link opens that subtask

## Build order

1. Migration, `db.js` queries, isolation tests.
2. The four routes, with route tests.
3. `renderNote` and the `[[...]]` rule, with tests. No UI yet.
4. `notesHtml`, the sidebar section, and the add/edit/delete wiring.
5. The `#notes` view and its filter.
6. Export, and the DOM tests.

Steps 1 and 2 are the ones that carry risk, because they touch stored user data
and the isolation boundary. Everything after them is display.
