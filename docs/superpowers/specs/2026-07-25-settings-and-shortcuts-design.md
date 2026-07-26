# Settings and runner shortcuts — design

Date: 2026-07-25
Status: approved, not yet planned

## Problem

Two unrelated gaps, both small enough to share a spec.

**Your data is locked in.** The local version kept cards in `data/cards.json`,
committed to git — the README called them "a year of hand-written notes" and
git was the backup. Moving to D1 silently dropped that guarantee. There is now
no way to get your cards out, and `DELETE /api/me` exists with nothing calling
it. Public signup makes both an obligation rather than a feature.

**The runner is mouse-only.** Reviewing thirty cards means ninety clicks:
reveal, grade, repeat. Every other flashcard tool has keyboard grading because
it is the single most repeated interaction in the product.

They share a spec because each is genuinely small, not because they are
related. They touch no common code.

## Scope

**Out of scope:** importing an export back in, scheduled or automatic backups,
a global keymap outside the runner, shortcuts on Today or the card list,
customisable keybindings, and any second learning path.

### Decisions taken before this spec

- **Export is everything, as JSON, plus a Markdown copy.** JSON restores;
  Markdown reads. A cards-only export would leave review history and progress
  in a database you do not control.
- **A `#settings` view.** Deleting your account is neither a card operation nor
  a plan operation, and burying it under an unrelated page is how people either
  never find it or hit it by accident.
- **Shortcuts are inert while the recall box has focus.** Nothing you type is
  ever swallowed — that failure would make you stop trusting the box, which is
  where the stronger study act happens.

### Success criteria

- Every card, review, progress row and enrolment you own can be downloaded in
  one click and would be enough to rebuild your history elsewhere.
- A review session can be completed without touching the mouse.
- Typing a recall never triggers a shortcut.

---

# Part one: export and account deletion

## The export endpoint

```
GET /api/export → { exportedAt, user, enrollments, progress, cards, reviews }
```

```json
{
  "exportedAt": 1800000000000,
  "user":        { "login": "ravi" },
  "enrollments": [{ "pathId": "frontier-lab", "startedOn": "2026-07-25" }],
  "progress":    [{ "pathId": "frontier-lab", "nodeId": "p2-serving-s01-01" }],
  "cards":       [ /* full rows */ ],
  "reviews":     [ /* full rows */ ]
}
```

**The route is protected**, like every route except the four public ones. It
is not added to the public list, so `index.js` answers 401 without a session.
Stating that explicitly because an export endpoint is the single worst thing to
leave open: one unauthenticated GET would otherwise hand over everything a
person had written.

Three new `user_id`-scoped queries in `worker/db.js`: `listAllCards`,
`listAllProgress`, `listUserReviews`.

They are new rather than reused deliberately. `listCards` and `listProgress`
both take a `pathId`, because every other screen is about one path at a time.
An export that quietly inherited that scoping would omit everything from any
path you had enrolled in and left — a backup that is silently partial is worse
than no backup, because you would not find out until you needed it.

The exported `user` carries only `login`. The internal id and the GitHub id are
not useful to you and there is no reason to write them into a file that will
sit in a downloads folder.

## Markdown is built in the browser

`buildMarkdown(data, path) -> string` is a pure function taking the export
object and the loaded path, returning your cards grouped by phase and subtask,
each with its question, answer, due date and lapse count.

It lives in the browser, from the same JSON, for two reasons. One endpoint
means one thing to keep in step with the schema. And pure means testable
without a browser — the same split that made `cardsHtml` and `render-path.js`
verifiable after the Chrome tooling failed repeatedly.

Both files download client-side via a `Blob` and a synthetic anchor. There is
no round trip for a format the server never produced.

Filenames carry the date: `frontier-lab-export-2026-07-25.json` and `.md`.

## The settings view

A new `#settings` panel, linked from the header beside the avatar.

**Export your data** — two buttons, JSON and Markdown, with a line saying what
each is for: one restores, one reads.

**Delete account** — a short statement of exactly what goes (every card, every
review, all progress, and every signed-in session), an input, and a disabled
button.

**Deleting requires typing your GitHub login.** Not a second click. A two-step
confirm is proportionate for one card; for an action that destroys a year of
hand-written cards and cascades through four tables it is too cheap. The button
enables only on an exact match.

Afterwards the session is already gone — sessions cascade from `users` — so the
page navigates to `/` and returns signed out.

Signed out, `#settings` shows the same sign-in note the other views use.

---

# Part two: runner shortcuts

## One pure function

```js
keyAction(event, { revealed, typing })
  -> 'reveal' | 'again' | 'hard' | 'good' | 'easy' | 'blur' | 'close' | null
```

`today.js` calls it on `keydown` and switches on the result. No DOM logic in
the rules, no rules in the DOM handler. The entire keymap is then testable as a
table.

| State | Key | Action |
|---|---|---|
| typing | `Cmd`/`Ctrl`+`Enter` | `reveal` |
| typing | `Escape` | `blur` |
| typing | anything else | `null` — it is a character |
| not typing, hidden | `Space` or `Enter` | `reveal` |
| not typing, hidden | `1`–`4` | `null` |
| not typing, revealed | `1` `2` `3` `4` | `again` `hard` `good` `easy` |
| not typing | `Escape` | `close` |

`typing` is true when the event target is a `textarea` or an `input`.

**`1`–`4` do nothing before reveal.** You cannot grade a card you have not
looked at, and a stray digit must not silently mark something `easy` and push
it a week away.

**The textarea is not autofocused.** Most cards are recalled in the head, so
the first key pressed should reveal rather than type a space into a box you
were not using. Tab or click to type; `Escape` to come back out.

**`Escape` is two-stage** — it leaves the textarea first and only closes the
runner on a second press. Losing a half-typed recall to a reflex `Escape` is a
bad trade.

When the handler acts it calls `preventDefault`, otherwise `Space` scrolls the
page underneath the runner.

A muted hint sits under the grade buttons: `space reveal · 1–4 grade · esc
close`. A shortcut nobody knows about is not a shortcut.

The listener is attached once and returns immediately when the runner is
hidden, so nothing fires while you are reading the plan.

---

## Failure handling

**Export while offline** fails loudly rather than downloading a partial file.
`GET /api/export` is a read, so it is not an outbox mutation; a network failure
shows an error in the settings view. Silently exporting the `localStorage`
cache would produce a file that looks like a backup and is not one.

**Deleting an account with queued outbox writes** discards them. They reference
rows that will not exist, so flushing them afterwards would only produce 404s.

**A 401 in settings** behaves as everywhere else: the header flips to signed
out and the outbox drops the entry.

## Testing

On top of the existing 151:

- `GET /api/export` returns all four collections for the caller, and **contains
  nothing belonging to a second signed-in user** — the assertion that matters,
  since an export is the easiest place to leak everything at once.
- The export crosses paths: a card in a second path still appears.
- `buildMarkdown` groups by phase and subtask, includes every card, and escapes
  nothing — it is Markdown, not HTML, and pretending otherwise would mangle
  backticks in prompts about `vllm serve`.
- `keyAction` as a table covering every row above, including that a space while
  typing yields `null` and that `3` before reveal yields `null`.

## Build order

1. The three export queries, with tests.
2. `GET /api/export`, with the cross-user test.
3. `buildMarkdown`, with tests.
4. `keyAction`, with its table of tests.
5. The settings view and the header link.
6. Wiring `keyAction` into the runner, plus the hint line.

Parts one and two are independent; four can be done before one if preferred.
Steps 1 to 4 are all pure or route-level and provable without a browser, which
is where every step of this project has actually been verifiable.
