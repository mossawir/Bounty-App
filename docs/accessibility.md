# Accessibility

Target: Lighthouse accessibility ≥ 90 on the home, cart and login pages, and form errors that are
announced. Measured result: **100 / 100 / 100**.

## Measured

| Page  | URL      | Score | Failing audits |
| ----- | -------- | ----- | -------------- |
| Home  | `/`      | 100   | none           |
| Cart  | `/cart`  | 100   | none           |
| Login | `/login` | 100   | none           |

Method: Lighthouse 12, headless Chrome 140, `--only-categories=accessibility`, against the local dev
server (the production bundle differs only in asset hashing). Reproduce:

```bash
npm run dev
npx lighthouse http://localhost:5173/ --only-categories=accessibility --chrome-path="<path to chrome>" --chrome-flags="--headless=new"
```

Two real issues were found and fixed during the audit, rather than suppressed:

- **Contrast** on the primary button (4.25:1 → 5.2:1) and on muted footer text (4.4:1 → 5.3:1);
  the `--accent` and `--muted` tokens were darkened.
- **Heading order** — the product grid jumped from `h1` to `h3`; a visually hidden `h2` now introduces
  the grid.
- **Label in name** — the add-to-cart buttons had an accessible name that did not contain the visible
  label (“Add to cart”); they now read “Add to cart — {product}”.

## Implemented

**Structure and navigation**

- Landmarks: `header`, `nav[aria-label="Main"]`, `main#main`, `footer`, plus `role="search"` on the
  filter form and `aria-label` on each region.
- A skip link as the first focusable element, jumping to `#main`.
- One `h1` per page, descending headings after it.
- The current nav item has `aria-current="page"` (React Router) and a visible state that does not rely
  on colour alone.

**Keyboard**

- Every control is a native `button`, `a`, `input`, `select` or `output` — no clickable `div`s.
- Visible `:focus-visible` ring (3 px accent, 2 px offset) on every interactive element.
- The grid is reachable: card name links, add buttons, quantity steppers (labelled “Increase quantity
  of …”), filter chips with `aria-pressed`, the in-stock control with `role="switch"` and
  `aria-checked`.
- Back-to-Top is a real button, removed from the tab order while hidden.
- Pagination is a `nav[aria-label="Product pagination"]`: previous/next are labelled buttons, each
  page is a button with `aria-label="Page N"` and `aria-current="page"` on the current one. Changing
  page scrolls the shelf into view and moves focus to its heading, so keyboard users land at the top
  of the new results instead of in the footer.
- Route changes move focus to `#main` (which has `tabIndex={-1}`) and announce the new title via a
  visually hidden `role="status"` region (`RouteAnnouncer`).

**Forms**

- Every input has a persistent `<label>`; no placeholder-as-label.
- Errors are rendered next to the field, wired with `aria-describedby`, marked with `aria-invalid`,
  and inside `role="alert"` so they are announced immediately.
- Submitting focuses the first invalid field (client-side and server-side 400s).
- The checkout and login forms keep their submit button disabled while in flight and guard against
  double submits in the same tick.

**Live regions**

- The result count is a polite live region (“993 products after filtering”).
- Pagination announces “Page 2 of 209” and the visible range (“Showing 25–48 of 5,000 products”), so
  a page change is not silent.
- Toasts are `role="status"` / `aria-live="polite"`.
- The socket status chip is polite; stock changes themselves are not announced per tick (a tick every
  ~2 s would be unusable). The product page has a polite stock line instead.

**Visual**

- Text contrast targets WCAG AA; the tokens live in `src/styles/base.css`.
- Focus is never removed, only restyled.
- `prefers-reduced-motion` disables smooth scrolling, hover transforms and the pulses.
- Information is never conveyed by colour alone (stock pills carry text, not just a dot).

## Known limitations

1. **Virtualized rows at 96 per page.** The default page (24) and every filtered result under 60 items
   are fully in the DOM. At the 96 option the grid virtualizes, so off-screen cards are not in the DOM
   and the list does not claim a total item count via `aria-setsize`. The 60-item threshold means the
   problem is opt-in, not the default; it remains the main accessibility debt at that page size.
2. **Focus during a live tick.** If a focused card's stock hits zero, the Add button becomes disabled
   while focused; the browser keeps focus, but a screen reader may announce a changed control. Rare,
   not handled explicitly.
3. **No human screen-reader pass.** Automation (Lighthouse + Testing Library queries) is not a
   substitute. The reflection names the NVDA/VoiceOver script as the next step.
4. **Drag-free quantity steppers** are deliberate: plus/minus buttons are easier for motor-impaired
   users than a slider.

## Manual checks performed

- Full purchase flow with keyboard only (Tab / Shift+Tab / Enter / Space), including the filter chips,
  grid, detail page, cart steppers and checkout form.
- Browser zoom 200%: no horizontal scrolling at 1440 px; header collapses to icons, hero reflows.
- `prefers-reduced-motion: reduce` in devtools: no smooth scroll, no card lift, no pulse.
- Forced errors: field errors announced, focus moved to the invalid field; 409 banner readable.
- Colour-blind simulation for stock pills: “Sold out” / “Only 2 left” always present as text.
