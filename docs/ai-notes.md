# AI notes

How AI was used on this project, what I kept, what I changed, and the one mistake it made that I
caught. AI was allowed on everything; the rule I held myself to is that I can explain any line in the
walkthrough, and that every generated change has a test or a measurement behind it.

## Use 1 — Scaffold and the mock API

**Prompt (paraphrased):** “Scaffold a Vite + React + TypeScript store called The Bug Bazaar that
implements this API contract. Seed 5,000 products deterministically, support search/category/stock/
sort/pagination, and make every documented error triggerable without editing code.”

**Kept:**

- The deterministic catalogue generator (`mulberry32`, seed `0x5eed`) with per-category name parts,
  price ranges and an ~18% out-of-stock slice.
- The route table in `src/mocks/server.ts`, including `details` on 400/409 and the exact error body
  shape.
- The one-shot chaos triggers (`failNext`) and the `setChaos` surface the bug lab drives.

**Changed:**

- The first version put the mock products straight into RTK Query's cache. The mock mutated
  `product.stock` on checkout and the app crashed with `Cannot assign to read only property 'stock'`
  because Immer freezes cached data. I added a deep clone at the transport boundary
  (`src/api/client.ts`) so the “server” keeps ownership — a real API serialises, so the mock should
  too. This is the mistake below.
- `pageSize` and `featured` semantics: the generated code returned a rating sort for “featured”,
  which made the first screen 4,000 stickers at $3.99. I changed “featured” to catalogue order so the
  landing page shows the mix of categories the design assumes.

## Use 2 — The virtualized product grid

**Prompt (paraphrased):** “Render 5,000 product cards smoothly in a responsive grid. Use
`@tanstack/react-virtual`; keep it keyboard accessible; do not lose the ability to scan small result
sets.”

**Kept:**

- The window-virtualizer approach: chunk products into rows based on a measured column count,
  absolute-position rows, `measureElement` for real heights, overscan 4.
- The ResizeObserver that recomputes columns (1–5) and `scrollMargin`.

**Changed:**

- The generated version virtualized _every_ list. I added a threshold: at 60 items or fewer the grid
  renders a plain `<ul>`. Filtered results are then fully in the DOM, so find-in-page and screen
  readers see all of them — an accessibility trade-off virtualizers usually get wrong.
- The generated `estimateSize` was a hard-coded 380 px. Cards change height with column width, which
  produced drifting gaps on mobile. I switched to `measureElement` and measured the real row.

## Use 3 — Idempotent checkout

**Prompt (paraphrased):** “Checkout must not create two orders when the user retries after an error.
A 409 must name the item that ran out. The login/checkout forms must not double-submit.”

**Kept:**

- The key scoped to the cart signature, regenerated only when the contents change, reused on retry.
- The server map `(userId, key) → orderId` and the “commit then return 500” simulation.

**Changed:**

- The generated catch block treated every error's `details` as form-field errors, so a 409's
  `productId`/`available` rendered as field messages and the banner never appeared. I restricted
  field mapping to `bad_request` and mapped 409 to a dedicated banner that names the item.
- Added a `submitting` ref checked synchronously before the first `await`, because `isLoading` only
  paints after React re-renders — two clicks in one tick would otherwise send two requests. A test
  fires two `submit` events in a single tick to prove it.

## Use 4 — Pagination after review feedback

This one started as human feedback, not an AI idea: the home page loaded all 5,000 products and made
an enormous scroll. The prompt was specific — “add proper product pagination, stop loading everything”.

**Prompt (paraphrased):** “The home page renders all 5,000 products in one long scroll. Add pagination
(24/page, with a page-size choice), keep page state in the URL, reset to page 1 when filters change,
and keep the grid accessible and keyboard-friendly.”

**Kept:**

- The page model in the URL: `page` and `pageSize` parsed/validated alongside the existing filters,
  defaults omitted, round-trip tested.
- The page-window algorithm (first, last, neighbours, ellipses) and its `aria-current` semantics.
- The page transition behaviour: scroll the shelf into view and move focus to its heading.

**Changed:**

- The first version carried the previous total across _any_ argument change so the count would not
  blink. That reintroduced the stale-count bug the repo already had a test for: after a failed
  filter request the panel still claimed “5,000 products after filtering”. I scoped the carried total
  to the filter signature and let error/loading own the count, then merged with the existing
  regression test.
- Pagination put 24 items through the non-virtualized grid path for the first time — and it rendered
  one card per row, because only the virtualized path set a column count. The browser screenshot
  caught it; fixed with `grid-template-columns` (plus a 150 px phone breakpoint). It is now the fourth
  “browser found it” bug in `testing.md`.

## The AI mistake I caught

**Symptom:** every unit and integration test passed, but placing an order in a real browser failed
with “We couldn't reach the bazaar” and no server error.

**Cause:** the mock server and the RTK Query cache shared the same product objects. The server's
`db.decrementStock` mutated a cached object that Immer had frozen. The thrown `TypeError` bypassed the
HTTP error mapping and surfaced as a generic network error.

**Why tests missed it:** the checkout tests imported the product from the mock database _before_ any
query put it in the cache, so it was never frozen. The browser smoke script
(`scripts/capture.mjs`), which walks the real flow, turned it into a 30-second reproduction.

**Fix:** clone every mock response (transport boundary), so the cache never holds server-owned
objects. The `clone` comment explains why. I also added a contract test that a response is not the
same object as the database row.

**Lesson:** mocked I/O is not enough — the app has to be exercised in a browser. The smoke script
stayed in the repo as a result.

A second, smaller AI mistake: the first `configureStore` used a spread `preloadedState` that made
TypeScript infer a reducer-compatibility error. The generated “fix” was a cast; I rejected it and
hydrated through actions (`hydrateCart`, `hydrateSession`) instead, which kept the store's state type
honest and made restoration testable.

## What I would not hand to AI

**The security decisions.** Where the token lives, what the trade-off is, and what must never be
logged are judgement calls with real consequences. I wrote `auth.md` and the logger's rules myself
and would defend them line by line. AI can draft the comparison table; it cannot own the decision.

Two smaller ones: the final accessibility judgement (an automated 100 does not mean a screen reader
experience is good — someone has to listen to it), and the choice of what to cut when time runs short.
That is a product decision, not a generation task.

## Policy I followed

1. Never merge something I cannot explain.
2. Every generated behaviour gets a test, or a measurement, or a manual check recorded in `docs/`.
3. Generated copy is a draft: error messages and empty states were rewritten for tone and to avoid
   leaking raw server text.
4. If a fix is a cast or a `@ts-ignore`, it is not a fix — find the real shape.
