# Exercises — design

Date: 2026-07-28
Status: approved, not yet planned

## Problem

Every tick in this app is self-judged. The curriculum says why that is a
problem, in `p0-operating-rhythm-s04`:

> Put a test suite between you and your own optimism. Every exit check in
> Phase 0 is self-judged, and self-judgement is generous exactly when it should
> not be.

The founding decision of sub-project 1 was that **the app owns the checks, not
the lessons**. It currently owns no checks at all — only checkboxes. This spec
closes that gap for the subtasks where the curriculum already specifies a check
precisely enough to run.

## Scope: four exercises, and no more

Twelve subtasks mention a check, a green suite or machine grading. Most of them
delegate to somebody else's test suite — "BPE tokenizer, green" means CS336's
pytest, which this app should record rather than reimplement.

Four are specified precisely enough for the app to own outright:

| Subtask | What it checks | Needs |
|---|---|---|
| `p0-python-basics-s04` | word frequencies, clean failure on a missing path | pure Python |
| `p0-python-fluency-s05` | typed LRU cache and a concurrent fetcher | Python, asyncio |
| `p0-numpy-s03` | attention in einsum, matching a reference to 1e-5 | NumPy **and PyTorch** |
| `p1-karpathy-hero-s04` | scalar autograd, the reused-node case | Python **and PyTorch** |

**Colab was the right call, for a reason missed when it was recommended
against.** Two of the four check their answer against
`torch.nn.functional.scaled_dot_product_attention` and against
`torch.tensor(..., requires_grad=True)` — the reference implementation *is*
PyTorch. Pyodide has no PyTorch, so the in-browser runtime would have failed on
half the scope. Colab ships torch preinstalled.

**Exercises are not authored for the other 154 subtasks.** That is the
generated-content problem in a different hat, and it is still refused. These
four exist because the curriculum already describes exactly what passing means.

**Out of scope:** GPU exercises, grading someone else's suite, partial credit,
timing or performance assertions, and any exercise not in the table above.

## Decisions taken before this spec

- **Colab is the runtime**, chosen over Pyodide in the browser and over local
  execution. None of the four exercises need a GPU, so this was not forced —
  it buys a path to GPU exercises later at the cost of a notebook, a token and
  a post-back.
- **A passing attempt gates the tick.** An exit-check subtask cannot be marked
  done until its suite passes.

### The gate is enforced in the route, not the interface

`PUT /api/progress` refuses a gated node without a passing attempt. The
disabled checkbox is a courtesy; the route is the gate. A gate that lives only
in the browser is theatre, because `curl` still works and this app is hosted.

### Exercise definitions are imported into the worker bundle, not fetched

The worker knows nothing about path content: paths are static assets with
hashed filenames, served to the browser. The obvious fix — have the worker read
its own assets through `env.ASSETS` — was spiked and rejected.

`env.ASSETS` is bound in the test pool, but fetching a path asset returns 404
unless `dist/` has been built first. That makes the gate untestable on a fresh
clone, and in production a bad deploy would make the gate fail in whichever
direction the code happened to take — and a gate that fails open is a gate that
can be removed by breaking an unrelated build step.

So exercise definitions live in `exercises/index.json` and are imported
directly:

```js
import EXERCISES from '../exercises/index.json';
```

Spiked with `dist/` deleted: it works with no assets binding, no fetch and no
build. The path file carries only `"exercise": "<id>"` on the gated subtask;
the validator cross-checks that every id on both sides resolves.

### The gate attaches to a new step, because there is nothing else to gate

All four subtasks carry six steps and no subtask-level checkbox — the sidebar
renders per-step checkboxes and completion is the rollup of those. There is no
single node meaning "this subtask is done" to refuse.

Their existing steps are instructions, not verdicts: *"Compare against
`torch.nn.functional.scaled_dot_product_attention`"* is an action you tick when
you have done it.

So each of the four gains a **seventh step**, appended, whose text is the
verdict — *"The graded suite passes."* It renders as a checkbox nobody can tick
by hand; it ticks when a passing attempt arrives and unticks on no other event.
Appending ids is explicitly safe: the validator's append-only rule forbids
removing ids, not adding them, and this is the second feature to rely on that.

This also keeps the gate narrow. The other six steps stay self-judged, which is
correct — the app should not pretend to know whether you read something.

### The token is scoped to one endpoint

A notebook is a document you may share, commit or leave open in a tab. The
exercise token authorises `POST /api/attempts` and nothing else, is shown in
Settings, and is revocable there. A session cookie pasted into Google Drive
would be the alternative, and it is not an acceptable one.

### What this proves, stated plainly

You can edit the graded cell. This records "I ran it and it passed", not proof
of anything. The interface says so rather than implying more — an overstated
guarantee is worse than an honest weak one, because you would start trusting
it.

## Data

```sql
CREATE TABLE attempts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  passed      INTEGER NOT NULL,
  total       INTEGER NOT NULL,
  ran_at      INTEGER NOT NULL
);
CREATE INDEX attempts_owner ON attempts(user_id, exercise_id, ran_at);

CREATE TABLE exercise_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
```

Migration `0007_exercises.sql`. Both cascade from `user`, so account deletion
covers them, and the notes work already added a test proving that cascade
actually fires.

**Every attempt is kept, not just the best.** The failures are the interesting
record — the same reasoning that keeps the full review log rather than only the
current card state.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/attempts` | **exercise token** | The notebook reports a run |
| GET | `/api/attempts?pathId=` | session | Attempt history for the views |
| POST | `/api/exercise-token` | session | Mint or rotate, returns it once |
| DELETE | `/api/exercise-token` | session | Revoke |

`POST /api/attempts` is the only route in the app that authenticates by
something other than a session, so it does not go through the normal seam. It
reads a bearer token, resolves it to a user, and can do nothing else. It is
listed as public in the route table and does its own authentication, which
must be obvious in the code rather than incidental.

## Interface

**In the sidebar**, for a gated subtask: the exercise name, an "Open in Colab"
link, the last attempt (`3 / 4 passed, 2 days ago`), and the checkbox disabled
with the reason until a passing attempt exists.

**In Settings**: the exercise token, revealed once on mint, with a revoke
button and one line explaining that a notebook is a shareable document.

## Testing

On top of the existing 300:

- `POST /api/progress` refuses a gated node with no passing attempt (409), and
  accepts it once one exists
- it still accepts every ungated node, which is 154 of 158 subtasks
- **it refuses even when the request is well-formed and authenticated** — the
  test that proves the gate is not merely a disabled checkbox
- an attempt with a missing, malformed or unknown token is 401
- a token resolves to exactly one user, and an attempt is never recorded
  against anyone else
- revoking a token makes the next submission 401
- a passing attempt ticks the graded step, and no request can tick it directly
- attempts cascade on account deletion, asserted against the table
- the validator rejects an `exercise` id with no definition, and a definition
  with no subtask
- `exerciseHtml` renders the disabled state, the passing state, and the
  never-attempted state

## Build order

1. Migration, `exercises/index.json` with the four definitions, the seventh
   step appended to each of the four subtasks, validator cross-checks.
2. Queries and the token routes.
3. `POST /api/attempts`, including its own authentication.
4. **The gate in `PUT /api/progress`**, with the tests above.
5. The four notebooks under `exercises/`.
6. Sidebar and Settings interface.

Step 4 is the one that matters. Everything before it is plumbing, and
everything after it is display.

## Prerequisite the author must do

Colab opens notebooks only from a public GitHub repository, a gist, or Drive.
This repository has **no git remote at all**. Nothing here is usable until it
is pushed to GitHub as a public repository.

Checked before recommending it: `.dev.vars` is gitignored and has never been
tracked or present in history, only the empty `.dev.vars.example` template is
committed, and `wrangler.jsonc` carries a D1 `database_id`, which is an
identifier rather than a credential.

Creating the remote and pushing is not done for you: it publishes your work
under your name.
