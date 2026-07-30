# Homepage: browse and enrol in learning paths

Date: 2026-07-30
Status: approved

## Goal

A homepage where anyone can see every learning path and enrol. The catalogue
becomes the landing view for visitors and unenrolled users. One account can
hold multiple enrolments; the path being viewed is addressed by the URL, so
switching paths is navigation, not state mutation.

## Decisions made during brainstorming

- Homepage role: landing view for signed-out visitors and users without an
  enrolment. Enrolled users still land on `#today` but reach the homepage
  from the nav.
- Card content: rich preview — tagline, derived stats, phase-title list.
- Enrolment model: multiple enrolments per account, switch via the homepage.
- Architecture: path addressed in the URL (approach C), with reload-on-switch
  semantics to match the app's existing "re-boot rather than patch state"
  philosophy (sign-in and enrol already reload).

## 1. URL scheme

The path lives in the query string; the view stays in the hash:

    /?path=mission-masters-degree#today

- The hash remains single-segment, so `nav.js` highlighting and the mobile
  drawer need no changes, and the query survives every nav click.
- Changing `?path=` navigates, which reloads the page; boot rebuilds ctx,
  progress, cards, and notes for the new path through the existing flow. No
  view ever handles two paths in one page lifetime.
- Boot resolves the rendered path in order:
  1. `?path=<id>` if the id exists in the catalogue
  2. else the account's first enrolment
  3. else `frontier-lab` (the default)
  An unknown `?path=` value falls through silently to 2/3.

## 2. Catalogue metadata

- Each path JSON gains one authored field: `tagline` — one sentence shown on
  its card. A missing tagline fails the build (same fail-loud pattern as a
  subtask without `desc`).
- `emit()` in `tools/validate-path.js` derives per path, into `index.json`:
  - `weeks`: total span (max task/phase end week)
  - `tasks`: task count (excluding milestone-only tasks is not required;
    raw count is fine)
  - `phases`: ordered list of `{ id, title }` per phase — titles
    for the card's phase list, ids because phase hashes are the app's
    curriculum views (`#<phaseId>`), and the signed-out card button links
    to the first phase
- Cards render entirely from the catalogue; no full-path fetches on the
  homepage.

## 3. Homepage cards (`paths-view.js`)

One card per catalogue entry: title, tagline, a stats line
("30 weeks · 6 phases · 28 tasks"), the phase titles, and one button:

| Viewer state                  | Button    | Action                                   |
|-------------------------------|-----------|------------------------------------------|
| Enrolled in this path         | Continue  | navigate `/?path=<id>#today`             |
| Signed in, not enrolled in it | Enrol     | POST enrolment, navigate `/?path=<id>#today` |
| Signed out                    | View path | navigate `/?path=<id>#<firstPhaseId>` (read-only) |

Content is public; signed-out browsing of any path already works today.
Writing stays gated by enrolment exactly as now.

## 4. Landing rules

- Signed out, no hash → `#paths` (the homepage).
- Signed in but not enrolled in the path the URL addresses → `#paths`
  (existing redirect, now evaluated against the resolved path).
- Signed in and enrolled in the resolved path → `#today` (unchanged).

## 5. Error handling

- Unknown `?path=` → fall through to enrolment/default (no error page).
- Catalogue fetch failure → existing boot failure behavior (unchanged).
- Enrol POST failure → existing API error surface (unchanged).

## 6. Testing

- Emit: catalogue entries carry tagline and derived stats; missing tagline
  fails validation.
- Paths view: three button states render correctly per viewer state.
- Boot resolution: `?path=` → enrolment → default fallback order, including
  the unknown-id case.
- Full suite (349 tests) stays green; append-only id validation already
  protects both live paths.

## Out of scope

- Live in-page path switching (no reload). Touches every view's state
  wiring for no visible gain at two paths.
- Server-side "active path" state. Device-local URL addressing is enough.
- Any change to progress/cards/notes APIs — already keyed per path.
