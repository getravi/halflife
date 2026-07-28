# halflife

A study tracker that measures what you retained, not what you covered.

Ticking a box records that you read something. It does not record whether you
still know it a month later, and the gap between those two is the whole point:
every card carries a stability in days, retrievability decays as
`0.9 ^ (elapsed / stability)`, and the app reports **Covered** and **Retained**
as separate numbers.

A hosted tracker for multi-week learning paths, with a spaced-repetition
review loop over them. The curriculum is data; the app is a Cloudflare Worker
serving `/api` from D1 and a Vite-built page from static assets.

The frontier-lab roadmap in `paths/frontier-lab.json` is one path. It is not
the app.

## Running it

Node 24 and pnpm. Everything else is Cloudflare Wrangler.

```sh
pnpm install
cp .dev.vars.example .dev.vars
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"   # paste into BETTER_AUTH_SECRET
pnpm db:migrate:local            # create the local D1 schema
pnpm validate                    # check paths/*.json and emit public/paths/
pnpm build                       # bundle the frontend into dist/
pnpm dev:worker                  # http://localhost:8787
```

Open <http://localhost:8787>. The curriculum reads without signing in; tracking
progress and writing cards needs an account.

Sign-in is email and password, handled by [Better Auth](https://better-auth.com)
against D1. `BETTER_AUTH_SECRET` is required — Better Auth refuses to start
without it, which is correct: a session secret that falls back to a constant is
worse than one that is missing.

**Email goes through [Resend](https://resend.com), and is optional.** Without
`RESEND_API_KEY` set, `worker/email.js` logs verification links instead of
sending them — visible in `wrangler tail` — so the project runs locally with no
provider account at all.

To send for real: create a Resend API key, verify a sending domain, then set
`RESEND_API_KEY` and `EMAIL_FROM`. The free tier covers 3,000 messages a month
and 100 a day. Without a verified domain, Resend will only deliver to your own
account address.

Cloudflare Email Service was the alternative and was rejected on cost: there is
no free outbound tier, and reaching arbitrary recipients requires the Workers
Paid plan at five dollars a month for the same 3,000 messages.

**A failed send never blocks signup.** Better Auth writes the user row before
sending, so throwing would leave an address that is taken, unverifiable, and
cannot be signed up with again. Failures are logged as `[email:FAILED]` and
recovered with the resend button on the account screen.

GitHub sign-in is optional and off by default. Set `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET` (both, or neither) and the button appears; without them
`/api/me` reports the provider as unavailable and nothing is rendered, so a
fresh clone shows no button rather than a broken one.

**`APP_URL` must match the port you actually serve on.** It is the baseURL and
the only trusted origin, and a mismatch fails at sign-in rather than at startup.

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

## Structure: prerequisites and terms

158 subtasks with nothing connecting them is a list, not a plan. Two optional
fields close that.

`prereqs` on a subtask lists the subtasks it assumes, and the sidebar shows
them ticked or crossed — the tick state is the point, because a list showing
you have not done the thing this assumes explains why you are stuck. The
reverse edge, **Needed by**, answers *why am I doing this*.

Edges come only from explicit textual references. `tools/derive-prereqs.js`
prints candidates with the sentence that produced each one and writes nothing:
its precision is poor on purpose, and its output is a worksheet for a human.
Of 15 candidates, 12 survived review and one real edge the tool missed was
added by hand.

`terms` is an index, not a glossary — **it contains no definitions.** It
answers where a term appears in the plan and where somebody who knows has
explained it. `tools/extract-terms.js` keeps a term only if it appears in two
or more subtasks, which took 622 candidates to 106; a review kept 35. Its
outbound links come from the subtask that mentions the term *most*, not first:
the earliest mention of `GPU` is a subtask about ssh hygiene.

`pnpm validate` refuses a prereq that does not resolve, a cycle, and a
prerequisite sitting later in the path than the subtask needing it. That last
one is a bug in the plan, and nothing else catches it.

## Notes

Cards are deliberately narrow: a question and an answer, written at the moment
you finish. Notes are everything else — a stack trace that cost two hours, the
flag that fixed it, a derivation you want back in nine weeks.

Markdown, rendered by `markdown-it` on its defaults. Two of those defaults are
security properties rather than preferences: raw HTML is escaped and
`javascript:` URLs are refused. That is why this project has no sanitiser, and
tests assert both so a later options object cannot quietly turn them off.

A name in double brackets links back into the plan — `[[Stand up vLLM]]` opens
that subtask, `[[KV]]` opens the term index filtered to it. **An unresolved
name stays literal text**, never a dead link: titles get reworded, and text
showing you named something that is not there beats a link that has rotted.

Notes attach to a subtask, appear in its sidebar, and are listed together under
`#notes` with a filter. They are in the export, because the export stopped
being a backup the moment the first note existed.

## Graded exercises

Every other tick in this app is self-judged. Four subtasks specify passing
precisely enough to check, so those four have a seventh step that **you cannot
tick**: it is written by a passing run and by nothing else.

The exercises live in `exercises/` — percent-format Python, converted to
notebooks by `node tools/build-notebooks.js`, and opened in Colab. Colab
because two of the four check their answer against PyTorch, which is the
reference implementation; an in-browser Python runtime has no torch.

To run one: mint a token in Settings, paste it into the notebook's first cell,
run the graded cell. It reports `passed / total` back to `POST /api/attempts`.
The token authorises that one endpoint and nothing else, and only its SHA-256
digest is stored — a notebook is a document you might share.

**The gate is in the route.** `PUT /api/progress` answers 409 for a graded node
in both directions, from any session, however well-formed. The disabled
checkbox in the sidebar is a courtesy; a gate that only greys out a checkbox is
theatre when the app is hosted and `curl` still works.

What this proves is stated plainly in the interface: the graded cell is
editable, so a pass records that **you ran it and it passed**. It is not proof,
and implying otherwise would make it worth less than nothing.

Adding an exercise means an entry in `exercises/index.json`, a graded step
appended to the subtask, and a notebook. `pnpm validate` refuses a definition
whose gated step does not exist — that failure would gate nothing while looking
like it works.

## The one thing to know before editing

Node **ids** in `paths/*.json` are load-bearing: user progress rows and cards
reference them. `pnpm validate` diffs each path against its last committed
version and fails if an id has changed or vanished. Hosted, a bad rename would
orphan every user's cards at once rather than just one person's.

Titles are display-only. **Rename them freely.**

Sessions and accounts belong to Better Auth, in its own `user`, `session`,
`account` and `verification` tables. Every domain table references `user(id)`
with `ON DELETE CASCADE`, so deleting an account still removes every card and
review with it.

An unverified account can read the whole plan and write nothing: protected
routes answer 403 rather than 401, because *I know who you are and you may not*
is a different thing from *who are you*.

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
pnpm test         vitest — worker routes against real D1, plus DOM tests under happy-dom
pnpm build        validate, then bundle into dist/
pnpm dev          vite on :5173 with hot reload, proxying /api to :8787
pnpm dev:worker   the Worker, D1 and the built page on :8787
pnpm deploy       build and push the Worker
pnpm db:migrate   apply migrations to the remote D1
pnpm links        sweep every URL in paths/ for liveness (slow, network)

node tools/build-notebooks.js    exercises/*.py -> exercises/*.ipynb
node tools/derive-prereqs.js     print prerequisite candidates for review
node tools/extract-terms.js      rebuild the term index (re-prune after)
```

The last three are run by hand and their output is committed, the same
arrangement `tools/convert-path.js` had. None is part of the build.

## Tests

Two Vitest projects:

```
pnpm vitest run --project worker    routes and D1, in the Workers runtime
pnpm vitest run --project dom       pure modules and the DOM wiring
```

The DOM tests boot the real app against a stubbed network, using the real
`index.html`. They catch broken wiring — a handler that never fires, an id that
does not exist, a row shape that does not match what reads it. They cannot
catch layout, CSS or focus behaviour, so they shrink the need for a browser
rather than removing it.

They were added late, after six sub-projects had accumulated event handlers
nothing executed. They found three real bugs on the first run, two of which
would have been invisible until someone opened the page.

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
