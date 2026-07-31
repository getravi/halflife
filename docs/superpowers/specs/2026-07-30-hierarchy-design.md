# halflife hierarchy: app > paths > path views

Date: 2026-07-30
Status: approved

## Goal

Make the app read as one thing named halflife containing paths, each path
containing its views. Kill the current flat nav that mixes app-level items
with one path's internals.

## Decisions (brainstormed with Ravi)

- Two-row header. Row 1 app-level, row 2 path-level, hidden outside paths.
- Everyone lands on Paths — the app IS its paths. No enrolment redirect.
- Homepage groups cards: "My paths" (enrolled) on top, "Explore" below.
- Brand renamed halflife everywhere user-visible. Ids and files untouched.

## 1. Header row 1 — app level (always visible)

    halflife                       Paths · Settings · Account · [Sign in]

- Logo text `halflife`, links to `#paths`.
- `<title>` becomes `halflife`.
- Today, Cards, Terms, Notes leave this row — they are path-scoped.

## 2. Header row 2 — path bar (path views only)

    [Mission Masters Degree ▾]   Today · 00 01 02 03 04 05 · Cards · Terms · Notes

- Left: the existing path switcher dropdown, now doubling as the path's
  name. Rendered whenever the catalogue is known (even with one path, it
  names the path; switch behavior only matters with >1).
- Then the path-scoped links: Today, phase numbers, Cards, Terms, Notes.
- Visibility rule: row 2 shows only when the active hash is path-scoped —
  `#today`, `#cards`, `#glossary`, `#notes`, or any phase id of the
  rendered path. On `#paths`, `#settings`, `#account` it is hidden.
- Visibility is applied on every hashchange (nav.js), not just at boot.

## 3. Landing

- No hash → `#paths`, for everyone, signed in or not, enrolled or not.
- The unverified-email redirect to `#account` stays (it gates writing).
- The unenrolled redirect is deleted; explicit hashes are always honored.

## 4. Homepage sections

- Signed in with ≥1 enrolment: two sections — "My paths" (enrolled cards,
  Continue) then "Explore" (the rest). Either section absent when empty.
- Signed out or unenrolled: one unlabeled list, as today.
- Card content and buttons unchanged from the current design
  (Continue / View path + Enrol / View path).

## 5. Mobile drawer

- The drawer keeps working: both rows collapse into the existing drawer,
  path-level entries under the app-level ones. No new drawer design —
  grouping comes from row order and the switcher sitting between them.

## 6. Out of scope

- No routing changes: hashes, `?path=`, reload-on-switch all stay.
- No API/backend changes.
- No renaming of path ids, files, or the D1 database binding.

## 7. Testing

- Nav: row-2 markup contains switcher + Today/Cards/Terms/Notes + phases;
  row-2 hidden on app-level hashes, shown on path hashes (DOM test via
  hashchange).
- Landing: bare hash → `#paths` signed out, signed in enrolled, and
  signed in unenrolled (three DOM cases).
- Homepage: enrolled catalogue renders "My paths" + "Explore" sections;
  signed-out renders neither heading.
- Full suite stays green.
