# Adaptive learning app — design

Date: 2026-07-24
Status: approved, not yet planned

## Problem

The tracker records that work happened. It cannot record that the work
survived. Ticks only go up; memory does not. A subtask completed in week 6 is
indistinguishable from one completed in week 20, and by week 30 the progress
bar is a claim about the past rather than a description of the present.

The specific failure: **done but decayed**. The bar overstates what is
currently known, and nothing in the app makes that gap visible or actionable.

## What we are building

The app becomes the place the learning happens rather than the place it is
recorded. Concretely, it gains three things:

1. **Cards** — retrieval prompts written by hand, in your own words, at the
   moment a subtask is finished.
2. **A review loop** — spaced, self-graded recall over those cards.
3. **A second progress number** — `Retained`, which decays without review,
   shown beside the existing `Covered`.

The external material stays external. Karpathy's videos, CS336, the arXiv
papers and the vLLM docs are already the best available teaching for this
curriculum; re-authoring them in-app would mean spending the year writing
curriculum instead of learning it. What a MOOC adds over a link list is
*checks*, and checks are what the app will own.

## Scope

Approach C of three considered: build a local backend now, shaped so that
deploying it later is a configuration change rather than a rewrite.

Rejected: a deployed backend with phone access (approach B). Everything about
this design is unproven — the capture-on-finish habit most of all. Paying
hosting, auth and migration cost up front for a habit that may not stick is
the wrong order. Two decisions keep B cheap later: all state sits behind one
storage module, and the frontend talks HTTP only.

Explicitly out of scope, so that later requests can be declined by pointing
here: Claude grading of free-recall answers, deployment, phone/PWA, mood or
energy logging, authentication, statistics dashboards, code-execution cards.

### Success criteria

- You open Today daily for two weeks without being reminded to.
- `Retained` is a number you trust enough to act on — i.e. seeing it fall
  changes what you do that day.

## Architecture

The existing build pipeline is untouched. `tools/render.py`, `tools/build.js`,
`data/panels/`, `data/resources/` and the three-file agreement invariant all
keep working exactly as they do today. This design is additive.

```
server/
  index.js      static file serving + /api routes; node stdlib only
  store.js      the storage seam — file implementation now, DB later
  scheduler.js  pure functions over (card, grade, now); no I/O
data/
  cards.json    authored cards — committable, precious
  reviews.jsonl append-only review log
  state.json    subtask/step completions, migrated off localStorage
```

`make serve` runs `server/index.js` instead of `python3 -m http.server`.

The frontend gains one module, `api.js`. Nothing outside it reads or writes
`localStorage` for truth; `localStorage` is demoted to an offline cache and a
write outbox.

### Why a backend at all

Three reasons, in order of weight:

1. Cards are a year of irreplaceable hand-written notes. `localStorage` loses
   them to a cleared browser profile and hides them from git.
2. A committable `data/cards.json` gives the notes version history and makes
   them reviewable in a diff.
3. It puts the Anthropic API key server-side, which keeps optional Claude
   grading on the table later without shipping a key to the browser.

## Data model

### Card

```
{
  id,                 // stable, generated at capture
  page,               // e.g. "phase2.html"
  taskId,             // e.g. "p2-judge-validation"
  subtaskTitle,       // the load-bearing string
  prompt,             // "one question that would catch you if you forgot"
  answer,             // "what you now know", in your own words
  createdAt,
  lastReviewedAt,
  dueAt,
  stability,          // days
  reps,
  lapses
}
```

Cards are keyed to `subtaskTitle` — the same string that `index.html`,
`app.js` and `resources_db.js` already have to agree on, and the same string
the progress key is built from. This is deliberate: it means cards inherit the
existing invariant machinery rather than introducing a fourth naming scheme.

`make check` gains one invariant: every card's `(page, taskId, subtaskTitle)`
must resolve to a real subtask. Renaming a subtask therefore fails loud, in
the same place and the same way as the existing three-file drift check,
instead of silently orphaning cards.

### Review

```
{ cardId, ts, grade, latencyMs }
```

Append-only, never mutated. Card scheduling state is fully derivable by
replaying the log, so a scheduler bug is a recomputation rather than a data
loss.

### State

Subtask and step completions migrate out of `localStorage` into
`state.json` on first boot, following the existing `migrateLegacyProgress`
path. The legacy `flp_progress` key is left in place untouched as a fallback.
`state.json` also holds the plan start date, which is what makes "which week
am I on" answerable.

## The daily loop

A new view, `#today`, becomes the default route in place of `#overview`. It is
a sibling of the existing hash-routed views; the phase views are unchanged.

Today shows three things, in this order:

1. **Due now — N cards.** One button starts the review runner.
2. **This week's work.** The week number is derived from the plan start date
   in `state.json` against the week labels in the panels, which `make check`
   already validates. Drift is shown, not hidden: "plan week 14 · you're
   working week 11". A tracker that conceals drift is the one that already
   exists.
3. **Capture debt.** Subtasks ticked with zero cards — the list that explains
   the gap between Covered and Retained.

### Review runner

The prompt appears alone. You recall the answer, optionally typing it — typing
is the stronger act and gives the log a latency. You reveal your written
answer, then self-grade `again` / `hard` / `good` / `easy`. The queue advances;
when it empties you return to Today.

### Capture on finish

Ticking a subtask opens the sidebar in capture mode: two fields, *what you now
know* and *one question that would catch you if you forgot*, and one save.

Writing the card is itself the strongest available study act — articulating
what you learned beats re-reading it. This is why the cards are hand-written
rather than generated, and why they are written at completion rather than
authored up front: there are 158 subtasks and 924 steps in the plan, so
up-front authoring would be a second year of work, and would mean writing
questions about material not yet learned.

Capture is skippable. Skipping is silent and cheap in the moment, then appears
in capture debt where it costs honestly. No modal, no nag at the tick itself.

## Scheduling

`scheduler.js` holds pure functions over `(card, grade, now)`.

**Stability**, in days, one number per card:

| grade | first review | subsequent |
|---|---|---|
| again | 1 day | resets to 1 day, `lapses++` |
| hard | 2 days | `S × 1.2` |
| good | 4 days | `S × 2.2` |
| easy | 7 days | `S × 3.5` |

A lapse resets rather than shrinks. An earlier draft of this table multiplied
by 0.3, which contradicts the sentence above it: an 8.8-day card times 0.3 is
still 2.6 days away, so a card you had just forgotten would not return for two
and a half days. Forgotten means back tomorrow, whatever it was worth
yesterday. Resetting also keeps `dueAt` derived from stability, which is what
makes the `R = 0.9` identity below hold; capping `dueAt` separately would have
broken it.

**Retrievability**: `R = 0.9 ^ (Δdays / S)`, where `Δdays` is days since
`lastReviewedAt`. `R = 0.9` exactly when `Δ = S`, which is the definition of
due — the retention target is not a second free parameter, it falls out of the
stability update.

**Retained** is computed by the same hierarchical bubble-up as Covered —
subtask → task → phase → overall, normalising at each level with the existing
task and phase weights — substituting mean retrievability for completion at
the leaves. A subtask with no cards contributes 0.

The bubble-up matters. An earlier draft used a flat weighted mean over
subtasks, `Σ(subtaskWeight × meanR) / Σ(subtaskWeights)`. That is a different
denominator from Covered, and in practice it read *higher* than Covered — two
numbers side by side on different scales are worse than one number.

That last clause is a deliberate call: a subtask you ticked but never captured
counts as Covered and not at all as Retained. Unverified is not the same as
known, and the resulting gap is what creates pressure to capture.

**Covered** is the existing weighted bar, unchanged. `STATIC_WEIGHTS` and
`data/weights.json` keep meaning exactly what they mean today.

### What "adaptive" does

Four behaviours, all falling out of the numbers above:

- **Queue order** — most overdue first, ties broken by subtask weight. On a
  long queue day, attention goes to load-bearing material first.
- **Daily cap of 30**, overflow carried. A wall of 200 due cards is how this
  dies in month three.
- **Lapses re-enter the same session**, at the tail. Grading `again` and not
  seeing the card again that day is theatre.
- **Retention pressure surfaces on Today.** When a phase drifts — "Phase 1
  retention 42%" — Today says so and names the handful of cards that recover
  most of it. This is the whole answer to *done but decayed*: decay becomes a
  visible, actionable queue instead of a silent lie.

## Failure handling

**Server not running.** The app still opens as a static page, degrading to
read-only from the `localStorage` cache behind a banner. Reviews and captures
are disabled rather than accepted and silently dropped.

**Write fails.** Every mutation lands in a `localStorage` outbox before the
network call and flushes on reconnect. Losing a card you just wrote is the
single unrecoverable failure in this system — everything else can be
recomputed.

**Corrupt store.** Writes are temp-file-then-rename, so a crash mid-write
cannot truncate `cards.json`. The server refuses to boot on unparseable JSON
rather than starting empty and overwriting it on first save. Git is the
backup; that is why the file is committable.

**Renamed subtask.** Caught by the new `make check` invariant. Loud, not
silent.

## Testing

`node --test` with the standard library. No new dependencies — the repo has
none and this does not earn any.

- `scheduler.js` — real coverage, since it is pure. Tests encode intent, not
  arithmetic: a lapsed card returns inside a day *because the memory is gone
  rather than weak*. A test that still passes when `0.3` is swapped for `0.9`
  is not testing anything.
- `store.js` — round-trip, and a crash-during-write test proving the atomic
  rename holds.
- `make check` — the card-resolves-to-subtask invariant.

No frontend test framework. The repo has none, and this change does not
justify introducing one.

## Build order

1. `scheduler.js` and its tests — pure, no dependencies, defines the model.
2. `store.js` and `server/index.js` — file-backed, plus the state migration.
3. `api.js` and the outbox — frontend talks HTTP.
4. Capture on finish — cards start accumulating.
5. Today view and the review runner — the loop closes.
6. Retained, on Today and per phase.
7. The `make check` invariant.

Cards can only accumulate after step 4, and the loop is only worth reviewing
once step 5 lands, so steps 4 and 5 are the earliest point at which the design
gets real feedback.
