# Card management — design

Date: 2026-07-25
Status: approved, not yet planned

## Problem

A card is written once, at the moment a subtask is finished, and then frozen
forever. There is no way to fix a typo, sharpen a badly-worded prompt, or
remove a card you later realise is wrong. There is not even a way to *see* your
cards — the only place one appears is the review runner, one at a time, on a
schedule that may not surface a given card for months.

For a tool meant to be used daily for a year, that is a defect rather than a
missing nicety. The whole design rests on the cards being good; nothing lets
you make them good after the fact.

## Scope

`GET /api/cards` already exists. This adds editing, deletion, and a view to do
both from.

**Out of scope:** bulk operations, tags, search, moving a card to a different
subtask, undo, review history and statistics, and any second learning path.

**Explicitly not done here:** authoring a second path. This repo's README
records a ~47% dead-link rate inherited from invented resources — fabricated
YouTube ids, podcast slugs that never existed. A second path needs a real
curriculum with verifiable sources, chosen by a human.

### Decisions taken before this spec

- **A `#cards` view, grouped by subtask.** You cannot fix what you cannot see,
  and the reason to come here is a specific card you remember writing.
- **Editing never resets the schedule.** Fixing wording does not change what
  you know.
- **Delete is hard, and takes the review history with it.** `reviews.card_id`
  already cascades. A soft-delete flag would have to be remembered in every
  query — the same class of footgun as forgetting `user_id`, and one such rule
  is already enough.

### Success criteria

- A card with a typo can be found and fixed in under a minute without
  remembering which of 158 subtasks produced it.
- Fixing a card does not change when it is next due.

## API

Two routes, both on the existing exact-path router, so no path-parameter
machinery is needed:

```
PATCH  /api/cards            { cardId, prompt, answer }  → { card }
DELETE /api/cards?cardId=X                               → { ok: true }
```

`PATCH` carries its id in the body, matching `POST /api/reviews`. `DELETE`
takes a query parameter instead: request bodies on DELETE are inconsistently
supported by proxies and fetch implementations, and a silently dropped body
here would mean deleting nothing while reporting success.

Two new queries in `worker/db.js`, both scoped by `user_id`:

- `updateCardText(env, userId, cardId, prompt, answer) -> card | null`
- `deleteCard(env, userId, cardId) -> boolean`

**`updateCardText` names only `prompt` and `answer` in its `SET` clause.**
`stability`, `reps`, `lapses`, `due_at` and `last_reviewed_at` are not
preserved by care — they are unreachable by construction. Fixing a typo cannot
silently reschedule a card you have been reviewing for six months.

Both follow the rule `POST /api/reviews` already established: **a card
belonging to someone else answers exactly as one that does not exist** — same
status, same body, no existence oracle.

Validation matches `POST /api/cards`: a blank prompt or answer is a 400,
because a blank card is unreviewable.

`DELETE` is one statement. The cascade on `reviews.card_id` removes the study
history with the card. That is the intended behaviour, and the cost is worth
stating once: a future statistics view will report fewer lifetime reviews than
actually happened.

## The view

A new `#cards` panel, a nav link, and one module: `src/cards-view.js`.

Cards are grouped **by phase, then subtask, in path order** — not by due date.
You come here because you remember writing a bad card and roughly where in the
plan it was. Due order scatters exactly that mental model; due order is what
the runner is for.

Each row shows the prompt, the answer beneath it in muted text, and a meta
line: `due in 4 days · 3 reviews · 1 lapse`. Overdue cards are marked, because
this is the one place you would notice a card you have been failing
repeatedly.

**Edit** swaps the row in place for two textareas and Save/Cancel — the same
two fields as capture, so the form you fix a card in is the form you wrote it
in. Save calls `PATCH` and then updates the card **in place** in
`CAPTURE_STATE.cards` — it does not refetch. A refetch would serve the cached
list while offline and the edit would appear to vanish; see Failure handling.

**Delete is a two-step inline confirm**: the button becomes `Delete? · yes ·
no` within the row. Deliberately not `window.confirm` — a modal blocks the
page, and a destructive irreversible action deserves a moment's friction
rather than a reflex-dismissed popup.

**Signed out**, `#cards` shows the same sign-in note Today uses. An empty list
would read as "you have no cards" when the truth is "we do not know who you
are."

**Empty, signed in**: *"No cards yet — finish a subtask and capture one."*
That points at the next action rather than merely stating a fact.

`src/api.js` gains `updateCard(cardId, prompt, answer)` and
`deleteCard(cardId)`, both going through the existing outbox and its 401
handling.

## Structure

`cards-view.js` splits into `cardsHtml(ctx, cards)` — a pure string builder —
and a thin `renderCards` that mounts it and wires listeners.

That is not decoration. It is what made `render-path.js` testable without a
browser after the Chrome tooling failed repeatedly, and it is the pattern this
repo now has evidence for.

## Failure handling

**The runner cannot collide with this.** `#cards` is a view; the runner is a
fixed overlay covering the page. Editing a card while it is on screen mid-review
is not a reachable state. If it somehow were, grading a deleted card already
returns 404, `API.review` returns `null`, and the runner advances — that path
is safe today.

**Offline edits apply optimistically.** The outbox guarantees delivery, so the
row updates locally and the write queues. Refetching after mutating would serve
the cached list, the edit would appear to vanish, and it would be retyped.
Trusting the outbox is the entire reason it exists.

**Two tabs editing one card is last-write-wins.** There is no version column.
Worth naming rather than discovering: for a tool with one user per account this
is the right trade, and a version column can arrive when there is a reason for
it.

**A 401 mid-edit** behaves as everywhere else: the outbox drops the entry, the
header flips to signed out, and nothing is queued that can never succeed.

## Testing

On top of the existing 123:

- `PATCH` changes prompt and answer and leaves `stability`, `reps`, `lapses`,
  `due_at` and `last_reviewed_at` byte-identical. This is the assertion the
  whole never-reset decision rests on.
- `PATCH` on another user's card is a 404 with the same body as a missing one,
  **and that card is unchanged afterwards** — asserting the response alone
  would not catch a query that edited first and checked ownership second.
- `DELETE` on another user's card is a 404 and **that card still exists**.
- A blank prompt or a blank answer is a 400.
- `DELETE` removes the card and its review rows.
- `cardsHtml` groups in path order, renders every card, escapes markup in a
  prompt, and produces the empty state when given no cards.

## Build order

1. `updateCardText` and `deleteCard` in `worker/db.js`, with their tests.
2. The two routes, registered and tested, including both ownership cases.
3. `cardsHtml` and its tests.
4. `renderCards`, the panel, the nav link, and the `api.js` methods.

Steps 1 and 2 are independently useful: the API is complete and proven before
any markup exists, which is the order that has worked for every sub-project
here so far.
