# Frontier Lab Learning Plan

A hosted tracker for multi-week learning paths, with a spaced-repetition
review loop over them. The curriculum is data; the app is a Cloudflare Worker
serving `/api` from D1 and a Vite-built page from static assets.

The frontier-lab roadmap in `paths/frontier-lab.json` is one path. It is not
the app.

## Running it

Node 24 and pnpm. Everything else is Cloudflare Wrangler.

```sh
pnpm install
pnpm db:migrate:local     # create the local D1 schema and seed the dev user
pnpm validate             # check paths/*.json and emit public/paths/
pnpm build                # bundle the frontend into dist/
pnpm dev:worker           # http://localhost:8787 — the Worker, D1 and the page
```

Open <http://localhost:8787>. **Today** is the landing view; press
**Set plan start date** first, since the plan-week reading depends on it.

While working on the UI, run Vite instead for hot reload — it serves the page
on 5173 and proxies `/api` back to the Worker:

```sh
pnpm dev:worker           # terminal 1
pnpm dev                  # terminal 2 — http://localhost:5173
```

Deploy with `pnpm deploy`, and apply migrations to the real database with
`pnpm db:migrate`.

## The plan

| Phase | Weeks | |
|---|---|---|
| 0 · Programming foundations | 1–8 | Python from zero, arrays, the maths, the operating rhythm |
| 1 · Deep learning & transformers | 9–20 | micrograd → makemore → CS336 a1 → nanochat |
| 2 · Evals & environments | 21–38 | endpoint, harness, **environment v0 at wk 26**, then statistics, judges, infra, audit, post-training, safety, **v1 at wk 38** |
| 3 · Systems & scaling | 39–48 | JAX, scaling book, FSDP2/DTensor, CS336 a2, serving performance |
| 4 · Ship & apply | 49–52 | adoption, write-up, upstream contribution, close the funnel |

Two things about the shape, because they were deliberate and are easy to undo
by accident:

**The environment ships in week 26, badly, and improves for twelve weeks.**
Everything between weeks 27 and 38 applies that week's material to it —
statistics corrects its published numbers, judge validation decides its
grading, the audit turns the lens on its own undeclared parameters. Ordering
those topics before the artifact would restore the problem they were moved to
fix: nothing public until the year is nearly over.

**Systems & scaling is deliberately last and deliberately optional.** It keeps
a pretraining or performance track open and sharpens cost reasoning, but
nothing in it blocks the work that gets someone hired. It is the phase to
compress if you fall behind — not the environment.

## The review loop

The tracker records that work happened; it cannot record that the work
survived. So the app also holds **cards**: retrieval prompts you write by hand,
in your own words, at the moment you finish a subtask. Finishing the last step
opens a two-field form in the sidebar. Skipping is cheap in the moment and
shows up as capture debt on **Today**, which is the default view.

Today shows Covered beside Retained. Covered is the weighted progress bar and
only goes up. Retained is mean retrievability over your cards, decays without
review, and counts a subtask with no cards as zero — unverified is not the same
as known. The gap between the two numbers is the honest one.

Grades are `again` / `hard` / `good` / `easy`. Stability is one number per card,
in days; retrievability is `0.9 ^ (elapsed / stability)`, so `R` is exactly 0.9
on the due date. A lapse resets stability to one day rather than shrinking it —
forgotten means back tomorrow, whatever the card was worth yesterday.

Cards, reviews and progress live in D1, scoped by `user_id` from the first
commit even though sign-in arrives in the next sub-project. `worker/db.js` is
the only module that knows SQL. The review log is append-only, so card
scheduling state can always be rebuilt by replaying it — a scheduler bug is a
recomputation rather than a data loss.

## The one thing to know before editing

Node **ids** in `paths/*.json` are load-bearing: user progress rows and cards
reference them. `pnpm validate` diffs each path against its last committed
version and fails if an id has changed or vanished. Hosted, a bad rename would
orphan every user's cards at once rather than just one person's.

Titles are display-only. **Rename them freely.**

## Editing

Curriculum content — titles, descriptions, steps, resources, weeks, weights —
all lives in `paths/frontier-lab.json`:

```sh
$EDITOR paths/frontier-lab.json
pnpm validate
```

Phase and task weights are authored there. Subtask weights are derived (task
weight ÷ subtask count) and step weights from the leading verb: build/verify
verbs score 3, practice verbs 2, read verbs 1.

Adding a subtask means adding an id that has never been used before. Removing
one fails validation, because somebody's cards point at it.

## Commands

```
pnpm validate     validate paths/*.json and emit public/paths/
pnpm test         vitest — scheduler, worker routes, isolation, validator, rollup
pnpm build        validate, then bundle into dist/
pnpm dev          vite on :5173 with hot reload, proxying /api to :8787
pnpm dev:worker   the Worker, D1 and the built page on :8787
pnpm deploy       build and push the Worker
pnpm db:migrate   apply migrations to the remote D1
pnpm links        sweep every URL in paths/ for liveness (slow, network)
```

## Link hygiene

This repo inherited a resources database with a **~47% dead rate on video
links** — invented YouTube IDs, several a single character off a real one,
podcast slugs that never existed, and well-known names attached to other
people's videos. Everything was rebuilt and verified, but the lesson is
encoded in `pnpm links`:

- YouTube watch pages return **200 for deleted videos**. Check via the oEmbed
  API instead, and compare the returned title *and* channel against the label.
  A 401 from oEmbed means embedding is disabled, not that the video is gone.
- Podcast sites route on **episode number and ignore the slug**, so a fabricated
  slug still returns 200 while serving an unrelated episode. Confirm the title.
- Some documentation sites serve **soft-404s**: HTTP 200 with an ~800-byte JS
  redirect shell. `pnpm links` flags any 200 with a body under 1 KB.
- Verify every arXiv ID against the arXiv API and confirm the title matches the
  claim. Use `https://` and follow redirects — the `http://` endpoint 301s and
  silently returns no entry, which reads as "dead" if you don't follow it.

When a link cannot be verified, delete it. An entry with two real links beats
one with six plausible ones.
