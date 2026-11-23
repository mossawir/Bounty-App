# Performance

The product list is the screen that has to survive 5,000 items. This file records what was measured,
what changed, and what was deliberately not done.

## Method

- Local dev server (`npm run dev`), headless Chrome 140, viewport 1440×1000, Windows 11, warm cache.
- Script: [`scripts/measure.mjs`](../scripts/measure.mjs) — navigates, waits for the first
  `.product-card`, records wall time, DOM node count and card count, then scrolls 30,000 px and
  records again.
- Each configuration was measured twice on the same machine, same session; the table shows both.
- “Before” is the same code with `VIRTUAL_THRESHOLD` raised so every card renders — a real
  measurement, not an estimate.

```bash
npm run dev
node scripts/measure.mjs virtualized
node scripts/measure.mjs virtualized-again
```

## 1. Window virtualization (D4-3)

| Metric                              | Before (all 5,000 cards) | After (windowed)  | Change      |
| ----------------------------------- | ------------------------ | ----------------- | ----------- |
| Time until cards are in the DOM     | 5,246 ms                 | 921 ms / 1,088 ms | ≈ 5× faster |
| DOM nodes on first paint            | 95,152                   | 517               | 184× fewer  |
| Cards in the DOM                    | 5,000                    | 20                | 250× fewer  |
| DOM nodes after scrolling 30,000 px | 95,152                   | 1,028             | 92× fewer   |
| Scrollable height                   | 5,317,556 px             | 475,095 px        | —           |

The implementation is `src/components/ProductGrid.tsx`:

- rows are chunked by measured column count (ResizeObserver, 1–5 columns);
- `@tanstack/react-virtual`'s window virtualizer renders visible rows plus 4 overscan rows;
- `measureElement` handles the real row height instead of a guessed constant;
- under 60 items the component renders a plain `<ul>` — no virtualization for filtered results, so
  find-in-page and screen readers see everything.

## 2. Route-level code splitting

The build was measured twice: once with every page statically imported into `App.tsx`, once with
`React.lazy` per route.

| Build                                                | Initial JS (raw) | Initial JS (gzip) |
| ---------------------------------------------------- | ---------------- | ----------------- |
| Eager (all pages in `index`)                         | 358.84 kB        | 116.51 kB         |
| Split — landing route (`index` + `HomePage`)         | 336.93 kB        | 112.14 kB         |
| Split — secondary route (`index` + e.g. `LoginPage`) | 295.24 kB        | 99.41 kB          |

- Landing route: **−21.9 kB raw (−6.1%)**, −4.4 kB gzip.
- Secondary routes (login, cart, checkout): **−63.6 kB raw (−17.7%)**, −17.1 kB gzip.

The landing page keeps the biggest chunk because it _is_ the browsing experience (grid, filters,
virtualizer). The shared chunk is dominated by React, Redux Toolkit and the mock API; the mock is
the price of “runs without a backend”. A production build pointing at a real API would drop the mock
and the catalogue generator.

## 3. Memoization

- `ProductCard` is wrapped in `React.memo`. A stock tick replaces one product object
  (`applyStockOverrides` returns the same array identity when nothing changed), so the other visible
  cards skip re-rendering. This is why the live feed can tick every couple of seconds without
  janking the scroll.
- `applyStockOverrides` returns the input array unchanged when no override differs, so the grid's
  row chunking does not recompute on unrelated ticks.
- The grid re-chunks rows only when the product array or column count changes.

## 4. Skipped on purpose

- **Virtualizing the “related products” strip.** It renders exactly four cards. Adding the virtualizer
  there would add a ResizeObserver, a scroll listener and a second positioning model for no
  measurable win.
- **`useCallback` on every handler.** Only handlers passed to memoized children or used as effect
  dependencies are wrapped; wrapping `onClear`-style props that are already stable added noise
  without changing renders.
- **A third-party image CDN / responsive `srcset`.** The artwork is local SVG, a few hundred bytes,
  and instruction-level lazy loading already applies.
- **Prefetch on hover.** Not worth it against a 180 ms mock and 10-minute cache entries.

## 5. What would be measured next

- Lab score (Lighthouse performance) on a throttled 3G profile, not just local wall time.
- Interaction-to-next-paint while typing in the search box, with the CPU throttled 4×.
- Long tasks during fast scrolling with the live feed on, using `PerformanceObserver` in the app and
  reporting p95 to the error endpoint from [`monitoring.md`](./monitoring.md).

## Reproduce

```bash
npm run dev                     # terminal 1
node scripts/measure.mjs before # terminal 2
node scripts/capture.mjs        # screenshots + console-error smoke test
```

Screenshots are written to `.shots/` (git-ignored).
