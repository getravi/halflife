# Structure: prerequisites and a term index — design

Date: 2026-07-27
Status: approved, not yet planned

## Problem

158 subtasks with no navigation between them. The plan knows that the agent
harness needs the endpoint from two tasks earlier, and that the audit turns its
lens on the environment published in week 26 — it says so in prose, inside
subtask descriptions nobody re-reads. Nothing in the app carries it.

So there is no way to answer two questions the tool should answer: *what does
this assume I already know*, and *why am I doing this at all*.

## The larger request, and what this is a part of

The ask was to make this "a full-fledged course with more content in the tool
than outside it". That reverses the founding decision in sub-project 1: *the
app owns the checks, not the lessons*.

Revisiting it is fair. But three constraints shaped what that turns into:

**Generated teaching content is not acceptable here.** 158 subtasks of
explanation about backprop, attention, KV caching, FSDP and eval statistics,
written by a model and reviewed by someone still learning the material,
produces confident prose whose errors surface in an interview. This repo
already carries the scar of generated content — a ~47% dead-link rate from
invented resources. A dead link is detectable by a script; a plausible and
wrong account of why attention scales by the square root of the head dimension
is not.

**Copyright.** CS336 material, Karpathy's videos and paper text can be pointed
at and summarised, never reproduced.

**Scale.** Three hundred words per subtask is 47,000 words. Real lessons are a
textbook, which is the thing the plan exists to get you through.

So the answer chosen was: **the tool owns everything around the teaching**, and
external sources keep doing the teaching. Four sub-projects came out of that:

1. **Structure** (this spec) — prerequisites and a term index.
2. **Notes** — searchable, linked, accumulating from the capture moment.
3. **Curated open material** — genuinely open-licensed content, rendered
   in-app, each source's licence verified individually.
4. **Coding exercises** — run in Google Colab, which is the only option that
   handles a PyTorch and CUDA curriculum. Colab notebooks can make outbound
   requests, so a final cell can post results back; free GPU is heavily
   restricted and a determined person can edit the notebook first, so this is
   "genuinely executed" rather than "cryptographically verified".

This spec covers sub-project 1 only.

**Out of scope:** definitions of any kind, generated explanations, automatic
"you seem stuck, revisit X" prompts, and the other three sub-projects.

### Decisions taken before this spec

- **Prerequisites are drafted by extraction and corrected by hand.** A wrong
  edge is visible and cheap to delete, unlike a wrong explanation.
- **The glossary contains no definitions.** It is an index: where a term
  appears in your plan, and where somebody who knows has explained it.

### Success criteria

- Opening a subtask shows what it assumes, and whether you have done it.
- The validator refuses a plan that puts a prerequisite after the thing that
  needs it.

## Data

Two optional additions to the path format, so existing paths stay valid.

```json
"subtasks": [{
  "id": "p2-agent-harness-s01",
  "prereqs": ["p2-serving-s01"],
  …
}],

"terms": [
  { "term": "KV cache",
    "mentionedIn": ["p2-serving-s01", "p2-serving-s02"],
    "seeAlso": [{ "label": "vLLM docs", "url": "https://docs.vllm.ai/en/latest/" }] }
]
```

`terms` sits at the top level of the path, beside `phases`.

### Prerequisites come only from explicit textual references

This is the load-bearing decision. Deriving edges from ordering would produce
roughly twelve thousand of them — every subtask technically precedes every
later one — and a graph asserting that everything depends on everything asserts
nothing.

The path text already names its real dependencies aloud: *"Phase 3 depends on
exactly this"*, *"the environment you published in week 26"*, *"Everything else
in this task is a variation on one server."* Those are the edges worth having,
and there are tens of them rather than hundreds.

### The term index is built from text that already exists

Backticked identifiers and repeated capitalised terms become entries. Each
links to the subtasks mentioning it and to any resource URL already attached
there.

**No definition is written by anyone.** The index answers "where does this
appear, and where is it explained", not "what does it mean".

**A term is kept only if it appears in two or more subtasks.** Mechanical
extraction over this path would otherwise index every one-off flag and shell
fragment. Appearing once means the term is explained where it appears and needs
no index entry.

## Tools

`tools/derive-prereqs.js` and `tools/extract-terms.js` run once, and their
output is committed — the same arrangement `tools/convert-path.js` had. Neither
is part of the build.

**The derivation output is built to be judged, not trusted.** Each proposed
edge is emitted with the sentence that produced it:

```
p2-agent-harness-s01  ←  p2-serving-s01
  "Point the official openai client at your endpoint … Phase 3 depends on
   exactly this."
```

Without the evidence line the review is a bare list of ids, which is
unreviewable in practice: it would be approved wholesale, and the structure of
the curriculum would have been authored by a script by default.

## Validation

`tools/validate-path.js` gains three checks:

- every `prereqs` id resolves to a real subtask
- the prerequisite graph has no cycles
- **a prerequisite never appears later in the path than the subtask needing
  it** — a plan telling you to build something before its dependency is a bug
  in the plan, and nothing currently catches it

The first extends the append-only-ids rule to the second place ids are now
referenced.

## Interface

**In the sidebar**, above the steps, when a subtask has prerequisites:

> **Assumes:** ✓ Stand up vLLM · ✗ Write the four interfaces

The tick state is the point. A list of links is a footnote; a list showing you
have not done the thing this assumes explains why you are stuck. Signed out or
unverified, the links render without ticks — completion is per-person and we do
not know who is asking.

Below the steps, the reverse edge: **Needed by: Stand up an agent harness.**
That answers "why am I doing this", which the plan currently answers only in
prose you would have to go looking for.

**A `#glossary` view**, alphabetical, with a filter box because there will be
well over a hundred entries:

> **KV cache** — appears in *Stand up vLLM*, *Continuous batching* · read: vLLM docs

**Both are pure string builders** — `prereqHtml(subtask, ctx, doneSet)` and
`glossaryHtml(terms, ctx, filter)` — mounted by thin wrappers. That split is
the house pattern because it is the only thing that made the renderer, the card
list and the keymap verifiable after the browser tooling failed.

### Deliberately not built

Any automatic "you seem stuck on X, revisit Y" prompt on Today. It sounds
appealing and it is the kind of inference that is wrong often enough to become
noise people learn to ignore. The data makes it possible later; it should earn
its place with evidence from real use.

## Testing

On top of the existing 205:

- the validator rejects a prereq id that does not resolve, a cycle, and a
  prerequisite sitting later in the path than the subtask needing it
- `glossaryHtml` groups alphabetically, filters, escapes markup in a term, and
  produces an honest empty state
- `prereqHtml` shows tick state when progress is known and omits it when it is
  not, and renders nothing at all for a subtask with no prerequisites
- a DOM test that opening a subtask with prerequisites shows them
- a DOM test that the glossary filter narrows the list

## Build order

1. `tools/derive-prereqs.js`, run, output reviewed and committed into the path.
2. `tools/extract-terms.js`, run, output reviewed and committed.
3. The three validator checks, with tests.
4. `prereqHtml` and its tests, then wiring into the sidebar.
5. `glossaryHtml`, the `#glossary` view, and its tests.
6. DOM tests for both.

Steps 1 and 2 each end with a human review that cannot be skipped. If the
derived edges are not read and corrected, the feature is worse than not having
it: it would assert dependencies nobody checked, in a tool whose whole point is
telling you the truth about what you know.
