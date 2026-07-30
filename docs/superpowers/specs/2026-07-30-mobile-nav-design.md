# Mobile Responsive Design

**Goal:** Make the app usable on phones. The top nav — 11 links plus auth in a
52px row — is the main casualty; the 1.25 zoom makes it worse by shrinking a
390px phone to ~312px of effective viewport.

**Approach:** One `@media (max-width: 700px)` block (media queries measure the
pre-zoom viewport). Inside it:

- `html { zoom: 1 }` — the 1.25 is a desktop reading preference; phones scale
  text themselves and need the width back.
- Header keeps one row: logo left, auth slot and a new ☰ button right. The
  email text in the auth slot is hidden; the sign-out button stays.
- `.nav` becomes a drawer: hidden by default, `position: fixed` under the
  header, full width, links stacked at tap-friendly padding. `.nav-open` on
  the nav shows it.
- `.container` padding drops to `1.5rem 1rem`; subtask card grids collapse to
  one column.

**JS (`src/nav.js`):** toggle `.nav-open` on ☰ click; any nav-link click
removes it, because hash navigation keeps the page alive and the drawer must
close itself. No outside-click handler, no focus trap.

**Markup (`index.html`):** one `<button class="nav-toggle">` in the header,
hidden on desktop by CSS.

**Testing:** one happy-dom test — toggle opens, link click closes. Visual
verification live in Chrome device emulation.

**Non-goals:** hamburger on desktop, bottom tab bar, animation polish,
responsive tables/sidebars beyond the padding trim (sidebar already goes
full-width under the existing 1024px rule).
