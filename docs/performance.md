# Performance

The catalogue is 5,000 products. Loading all of them at once made the home page a 5.3-million-pixel
scroll; it is now paginated at 24 per page (with 48 and 96 options), with window virtualization kept
for the large-page case. This file records what was measured, what changed, and what was deliberately
not done.

## Method

- Local dev server (`npm run dev`), headless Chrome 140, viewport 1440×1000, Windows 11, warm cache.
- Script: [`scripts/measure.mjs`](../scripts/measure.mjs) — navigates to a URL, waits for the first
  `.product-card`, records wall time, DOM node count, card count, list and page height, then scrolls
  6,000 px and records again.
- Each configuration was measured on the same machine and session, with the same quote of mock
  latency, so the numbers compare like with like.
- “Before” is the previous behaviour (one request for all 5,000 items) measured with the same script
  on the same machine; where a comparison needed a code path that is no longer the default, it was
  produced by toggling the threshold, not estimated.

```bash
npm run dev
node scripts/measure.mjs "/" page-24
node scripts/measure.mjs "/?pageSize=96" page-96
```

## 1. Pagination (the fix for the long scroll)

Same first page of products, same mock, same machine:

| Metric                          | All 5,000 in one list | 24 per page         | Change                           |
| ------------------------------- | --------------------- | ------------------- | -------------------------------- |
| Time until cards are in the DOM | 921–1,088 ms          | 827–972 ms          | ~10% faster                      |
| Product payload per request     | 745,699 B             | 3,625 B             | ~206× smaller                    |
| Cards rendered                  | 20 (virtualized)      | 24                  | —                                |
| DOM nodes on first paint        | 517                   | 613                 | +96 (24 cards vs 20, plus pager) |
| Page height (Scrollable)        | 5,317,556 px          | 26,778 px           | ~198× shorter                    |
| Reaching the last product       | scroll ~5.3M px       | page 209, one click | —                                |

The DOM node count is slightly **higher** on the first page: 24 real cards cost more than 20
virtualized ones. That is the honest trade. The wins that matter are the payload (206×), the height
(198×) and the fact that the browser is never asked to lay out 5,000 products at once. Chasing the
last 100 nodes would have meant virtualizing a 24-item list, which is exactly the premature
optimization the brief asks us to justify skipping.

Implementation: `HomePage` asks the API for `page` + `pageSize` (default 24, options 24/48/96), the
URL carries both, and `<Pagination>` renders a range (“Showing 25–48 of 5,000”), page buttons with
ellipses, and previous/next controls. Changing any filter resets to page 1; a page beyond the last
one is clamped back into range.

## 2. Virtualization (kept for large page sizes)

At 96 per page the grid switches to the window virtualizer. Measured with the constant threshold
toggled, same page:

| Metric                          | 96 items, plain grid | 96 items, virtualized |
| ------------------------------- | -------------------- | --------------------- |
| DOM nodes on first paint        | 1,909                | 526                   |
| Cards in the DOM                | 96                   | 20                    |
| DOM nodes after scrolling       | 1,909                | 940                   |
| Time until cards are in the DOM | 968 ms               | 1,032 ms              |

Virtualization buys a 3.6× smaller DOM at 96 items, and the time difference is noise at this size.
It becomes decisive above a few hundred items, which is why it is still there for 96 and for any
future “show everything” view — but it is no longer the primary answer to the 5,000-item problem.
Pagination is.

- Rows are chunked by measured column count (ResizeObserver, 1–5 columns; 2 on phones).
- `@tanstack/react-virtual`'s window virtualizer renders visible rows plus 4 overscan rows.
- `measureElement` handles the real row height instead of a guessed constant.
- Under 60 items the grid renders a plain `<ul>`, so filtered results and every paginated page are
  fully in the DOM for find-in-page and screen readers.

## 3. Route-level code splitting

The build was measured twice: once with every page statically imported into `App.tsx`, once with
`React.lazy` per route.

| Build                                                | Initial JS (raw) | Initial JS (gzip) |
| ---------------------------------------------------- | ---------------- | ----------------- |
| Eager (all pages in `index`)                         | 362.47 kB        | 117.73 kB         |
| Split — landing route (`index` + `HomePage`)         | 340.51 kB        | 113.28 kB         |
| Split — secondary route (`index` + e.g. `LoginPage`) | 295.63 kB        | 99.55 kB          |

- Landing route: **−22.0 kB raw (−6.1%)**, −4.5 kB gzip.
- Secondary routes (login, cart, checkout): **−66.8 kB raw (−18.4%)**, −18.2 kB gzip.

The landing page keeps the biggest chunk because it _is_ the browsing experience (grid, filters,
pagination, virtualizer). The shared chunk is dominated by React, Redux Toolkit and the mock API;
the mock is the price of “runs without a backend”. A production build pointing at a real API would
drop the mock and the catalogue generator.

## 4. Memoization

- `ProductCard` is wrapped in `React.memo`. A stock tick replaces one product object
  (`applyStockOverrides` returns the same array identity when nothing changed), so the other visible
  cards skip re-rendering. This is why the live feed can tick every couple of seconds without
  janking the scroll.
- `applyStockOverrides` returns the input array unchanged when no override differs, so the grid's
  row chunking does not recompute on unrelated ticks.
- The grid re-chunks rows only when the product array or column count changes.

## 5. Skipped on purpose

- **Virtualizing a 24-item page.** Measured above: it would add a ResizeObserver and a positioning
  model to save ~100 DOM nodes while making the list less accessible. Not worth it.
- **Prefetching the next page on hover.** The mock answers in ~180 ms and the cache already keeps
  visited pages for ten minutes; prefetching adds requests and cache pressure for a small gain.
- **Virtualizing the “related products” strip.** It renders exactly four cards.
- **`useCallback` on every handler.** Only handlers passed to memoized children or used as effect
  dependencies are wrapped; wrapping already-stable props added noise without changing renders.

## 6. What would be measured next

- Interaction-to-next-paint when changing page, with the CPU throttled 4×.
- The p95 of “time from page click to first new card” in production, reported to the error endpoint
  from [`monitoring.md`](./monitoring.md).
- Lighthouse performance on a throttled 3G profile, not just local wall time.

## Reproduce

```bash
npm run dev                            # terminal 1
node scripts/measure.mjs "/" page-24   # terminal 2
node scripts/measure.mjs "/?pageSize=96" page-96
node scripts/capture.mjs               # screenshots + console-error smoke test
```

Screenshots are written to `.shots/` (git-ignored).
