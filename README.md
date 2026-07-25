# Frontier Lab Learning Plan

A static, single-page tracker for a 52-week self-study plan aimed at evals and
environments roles. Open `index.html` through a local server — `make serve` —
because `app.js` fetches `resources_db.js` and `file://` blocks it.

## The one thing to know before editing

Three files have to agree exactly:

| file | holds |
|---|---|
| `index.html` | the subtask titles — **the authority** |
| `app.js` | `ALL_PHASES` and `STATIC_WEIGHTS`, keyed by those titles |
| `resources_db.js` | each subtask's body, keyed by those titles |

The progress key is `` `${page}::${taskId}::${subtaskTitle}::${stepIndex}` ``.
Subtask titles are therefore load-bearing in three places at once, including
saved `localStorage` progress.

Rename a subtask title by hand and nothing throws: the sidebar silently opens
empty and the progress bar quietly stops counting that subtask. That failure
mode is why `make check` exists. **Run it before every commit.**

Two files are generated. Do not hand-edit them:

- `index.html` panels ← `data/panels/*.json`
- `resources_db.js` and the `app.js` registries ← `data/resources/*.json` + `data/weights.json`

## Editing

Change curriculum content — task titles, subtask text, week labels, callouts:

```sh
$EDITOR data/panels/panel_p3.json
make render && make check
```

Change a subtask's resources, steps, or links:

```sh
$EDITOR data/resources/rdb_p3.json
make build && make check
```

Change how progress is weighted:

```sh
$EDITOR data/weights.json     # phase and task weights only
make build && make check
```

Subtask weights are derived (task weight ÷ subtask count). Step weights are
derived from the leading verb: build/verify verbs score 3, practice verbs 2,
read verbs 1.

Adding or removing a subtask means editing the panel **and** the resource file,
in that order. `make build` refuses to write if the two disagree, and names the
keys that drifted.

## Commands

```
make check    invariants: the three files agree, weeks are sane, DOM hooks exist
make render   rebuild index.html panels from data/panels/
make build    rebuild resources_db.js + app.js registries from data/resources/
make all      render, build, check
make serve    http://localhost:8000
make links    sweep every URL for liveness (slow, hits the network)
```

`make check` also verifies week labels sit inside their phase range and never
run backwards. An earlier version of this plan had calculus scheduled outside
its own phase and the capstone environment shipping seven weeks before the
experiment that designed it, because weeks had been renumbered with sequential
find-and-replace. Weeks now come from the panel JSON and are validated on every
render.

## Link hygiene

This repo inherited a resources database with a **~47% dead rate on video
links** — invented YouTube IDs, several a single character off a real one,
podcast slugs that never existed, and well-known names attached to other
people's videos. Everything was rebuilt and verified, but the lesson is
encoded in `make links`:

- YouTube watch pages return **200 for deleted videos**. Check via the oEmbed
  API instead, and compare the returned title *and* channel against the label.
  A 401 from oEmbed means embedding is disabled, not that the video is gone.
- Podcast sites route on **episode number and ignore the slug**, so a fabricated
  slug still returns 200 while serving an unrelated episode. Confirm the title.
- Some documentation sites serve **soft-404s**: HTTP 200 with an ~800-byte JS
  redirect shell. `make links` flags any 200 with a body under 1 KB.
- Verify every arXiv ID against the arXiv API and confirm the title matches the
  claim. Use `https://` and follow redirects — the `http://` endpoint 301s and
  silently returns no entry, which reads as "dead" if you don't follow it.

When a link cannot be verified, delete it. An entry with two real links beats
one with six plausible ones.
