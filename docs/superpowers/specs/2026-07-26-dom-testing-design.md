# DOM testing — design

Date: 2026-07-26
Status: approved, not yet planned

## Problem

183 tests, and none of them has ever run a click handler.

Six sub-projects have accumulated event wiring that no test touches: the
sidebar, the capture form, the review runner, the card list's edit and delete,
the path picker, the settings view. The pure layers underneath are covered
thoroughly — `keyAction`, `cardsHtml`, `render-path`, the rollup, the
scheduler, every route — but the glue that connects them to a page has never
been executed anywhere.

Nothing has asserted that the app starts at all.

This was going to be closed by opening a browser. The Chrome tooling failed on
every attempt across several sessions, and meanwhile each new feature added
more untested glue. The ratio has been getting worse.

## The rule that caused this

Since sub-project 1 every spec has carried the line *"No DOM test framework.
The repo has never had one and this does not earn it."*

That was written for a single-user local app with one HTML file and a handful
of handlers. It stopped being true several sub-projects ago, and it kept being
repeated as though it were a principle rather than a decision made under
different conditions. The repo already carries Vitest, Vite and Wrangler as dev
dependencies; `happy-dom` is not a new category of thing.

The rule is retired here, deliberately and in writing, so it stops being cited.

## Scope

**Out of scope:** visual or screenshot testing, real-browser automation,
accessibility auditing, snapshot tests of generated markup, and testing the
Worker through the DOM — routes already have their own tests against real D1.

### Success criteria

- A test fails if `boot()` throws or renders nothing.
- A test fails if ticking the last step of a subtask stops raising the capture
  form.
- A test fails if `Space` inside the recall textarea reveals instead of typing.

## Infrastructure

`happy-dom` as a dev dependency, and `vitest.config.js` becomes two projects:

```js
projects: [
  { name: 'worker',
    plugins: [cloudflareTest({ /* as today */ })],
    test: { include: ['test/worker/**/*.test.js'],
            setupFiles: ['./test/apply-migrations.js'] } },
  { name: 'dom',
    test: { include: ['test/*.test.js', 'test/dom/**/*.test.js'],
            environment: 'happy-dom' } }
]
```

Worker tests keep running in `workerd` against real D1 — that arrangement
works and is not being touched. Everything else, including the existing pure
tests, moves to the DOM project.

## Two production changes

Both are improvements the test work surfaced, not scaffolding for it.

**`src/main.js` exports `boot`.** It currently only registers a
`DOMContentLoaded` listener. By the time a test imports the module that event
has already fired, so the handler would never run and the test would assert
against an empty page. Exporting the function and registering the listener
separately is how a boot sequence should be written regardless.

**`src/content.js` survives without the Cache API.** It calls `caches.open()`
unguarded. That is not merely a test problem: Safari in private browsing has
historically exposed no `caches`, and a page served there would throw during
boot and render nothing at all. It falls back to a plain `fetch` when `caches`
is undefined.

That second one is a real robustness hole in shipped code, found only because
writing a harness meant asking what globals boot actually depends on.

## The harness

`test/dom/harness.js` provides `mountApp(state)`:

- Loads the real `index.html` from disk with `node:fs` and installs it as the
  document. The DOM project runs in Node, so the filesystem is available —
  unlike the Workers pool, where an earlier attempt at this failed.
- Stubs `fetch` for the four endpoints boot touches: `/paths/index.json`, the
  hashed path file, `/api/me`, `/api/progress`, `/api/cards`.
- Returns the recorded requests so tests can assert what was sent.

**Testing against the real `index.html` is the point.** A harness with
hand-written markup would pass happily while the actual shell was missing the
element a handler looks up by id — which is precisely the class of bug six
sub-projects of unverified wiring could be hiding.

## What gets tested

**Boot, once per state:**

- **signed out** — 36 task sections and 158 subtask cards render, the nav
  carries a link per phase, Today shows the sign-in prompt, and every step
  checkbox is `disabled`
- **signed in and enrolled** — Today shows Covered and Retained, and the
  checkboxes are enabled
- **signed in, not enrolled** — the app lands on `#paths` with the catalogue
  listed

The signed-out case is the one that matters most. Nothing in this project has
ever asserted the app comes up.

**Handlers, one file per surface:**

| Surface | Asserts |
|---|---|
| sidebar | clicking a subtask card opens the pane with that subtask's steps and resources |
| capture | ticking the last step raises the form; an existing card means it does not |
| capture | saving posts the right body and removes the form |
| runner | `Space` reveals, `3` grades `good`, `Space` in the textarea types instead |
| runner | `Escape` blurs first and closes only on the second press |
| cards | Edit swaps the row for textareas holding the current text; Cancel restores it |
| cards | Delete requires `Delete?` then `yes`; `no` puts the button back |
| settings | the delete button stays disabled until the typed login matches exactly |

**No snapshot tests.** A snapshot of generated markup fails on every wording
change and proves nothing about behaviour. Every assertion here is about what
the app does.

## What this still will not tell you

happy-dom is not Chrome. These tests cannot catch layout, CSS, focus quirks,
scroll behaviour, or anything about how the page looks. A green suite means the
wiring is connected — not that the app is usable, legible or attractive.

This shrinks the gap. It does not close it. A first real browser session is
still worth doing; it simply stops being the only evidence that six
sub-projects of handlers work at all.

## Documentation

The README and the four existing specs carry the retired rule. The README is
updated. The specs are historical records of decisions made at the time and are
left alone — rewriting them would erase the fact that the rule was held and
then changed, which is the more useful thing to know.

## Build order

1. `happy-dom`, the two-project config, and a green existing suite.
2. The two production changes, with the boot export proven by an import.
3. `test/dom/harness.js`.
4. The three boot tests.
5. The handler tests, one file per surface.
6. Update the README.

Step 1 must leave all 183 existing tests passing before anything new is
written. A config split that quietly stopped running a project would otherwise
look exactly like success.
