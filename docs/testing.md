# Testing

78 tests in 15 files, all behaviour-level, run with `npm test` (Vitest + Testing Library + jsdom).

## What is covered

| File                                        | Tests | What it protects                                                                                                                                                  |
| ------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/format.test.ts`                    | 9     | Cents → dollars formatting, filter/sort/pagination of the catalogue query, stable “featured” order.                                                               |
| `src/features/cart/cartSlice.test.ts`       | 11    | Add/merge, stock clamp, sold-out no-op, quantity zero removes, derived count/subtotal, the cart signature that scopes idempotency.                                |
| `src/features/products/filters.test.ts`     | 5     | URL parsing, hostile values, defaults omitted, round-trip (refresh/copy-link/Back), active filter count.                                                          |
| `src/features/products/searchRace.test.tsx` | 2     | Out-of-order responses: the latest query wins and stale results never render.                                                                                     |
| `src/hooks/storage-and-debounce.test.tsx`   | 5     | Debounce timing and cancellation; `localStorage` write-through, cross-tab sync, corrupt JSON fallback.                                                            |
| `src/api/mockServer.test.ts`                | 12    | The contract: list shape, 404 body, 500 trigger, login 400/401/200, `/me` 401, order 401/400/409/201, idempotent replay, order scoping.                           |
| `src/api/client.test.ts`                    | 3     | Transport boundary: responses are copies, the mock DB stays mutable after the cache freezes data, failures normalise to `AppError`.                               |
| `src/lib/remoteState.test.ts`               | 6     | Request-state adapter: error and loading win over a stale payload, so a failed request can never render the previous answer.                                      |
| `src/pages/HomePage.test.tsx`               | 2     | A failed filtered request shows a retryable error instead of the old shelf; the empty state offers a way out.                                                      |
| `src/app/persist.test.ts`                   | 2     | The cart snapshot is throttled, then flushed on `pagehide`; a pending write lands after the window.                                                               |
| `src/app/caching.test.tsx`                  | 2     | Revisiting a product uses the cache; placing an order invalidates the product tag and refetches stock.                                                            |
| `src/components/ProductCard.test.tsx`       | 3     | Price rendering, link target, add callback, sold-out disabled state.                                                                                              |
| `src/components/FilterBar.test.tsx`         | 7     | Result count announcement, category chip, debounce (one call per burst), switch semantics, clear-button state, and clearing never resurrecting a stale search.      |
| `src/pages/LoginPage.test.tsx`              | 4     | Empty submit blocks + focuses the first field, wrong credentials copy, successful sign-in stores the session, double submit creates one session.                  |
| `src/pages/CheckoutPage.test.tsx`           | 5     | Order success clears the cart, 409 names the item and keeps the cart, 500-after-commit retry reuses the key, double submit = one order, contact validation focus. |

Deliberately not covered:

- **Visual regression.** No snapshots of markup; the design changes too often and jsdom cannot see CSS.
- **Real WebSocket frames.** The socket is mocked; its lifecycle is exercised through the realtime
  slice, but there is no server to talk to.
- **Lighthouse / axe in CI.** Lighthouse is run manually (results in [`accessibility.md`](./accessibility.md));
  adding it to CI would need a headless Chrome and a built preview server.

## Conventions

- Query by role, label or text — never by test id or class. If a test cannot find a control the way a
  user would, the markup is wrong.
- Assert visible behaviour and store state, not implementation details (no spying on internal hooks).
- Each test starts from `resetDb()` and a clean `localStorage` (`src/test/setup.ts`), so tests are
  order-independent and the catalogue is deterministic.
- `renderWithProviders` (in `src/test/utils.tsx`) gives a test the same store, router and toasts the
  app has, with an optional preloaded cart/session.
- Async assertions use `findBy*` / `waitFor`; there are no arbitrary `setTimeout` sleeps.
- The mock runs with zero artificial latency under Vitest (`import.meta.env.MODE === 'test'`), and the
  live socket does not connect in test mode, so no test depends on wall-clock timing.

## Running

```bash
npm test              # one run
npm run test:watch    # watch mode
npm run test:coverage # v8 coverage report
```

CI runs `lint → typecheck → test → build` on every pull request; a failing test blocks the merge once
branch protection is enabled (see `.github/workflows/ci.yml`).

## The bug that tests did not catch

Worth recording: the whole suite passed while checkout was broken in a real browser. The mock database and
the RTK Query cache shared object references, Immer froze them, and the next stock write threw — a
failure that only appears when a real query has populated the cache first. It is now covered by
`src/api/client.test.ts`, and a Playwright smoke script (`scripts/capture.mjs`) walks the real flow.
That script is the answer to “what is not in CI but should be”.

## Three more bugs the browser found

The suite was green while three acceptance criteria were quietly unmet. All three came from walking the
brief in a real browser and checking the outcome, not the code. They are listed because the pattern
matters more than the fixes: unit tests prove the module, not the journey.

**1. A failed request rendered the previous answer.** RTK Query's `data` is the last successful result
for the hook and it survives a change of arguments. With `toRemoteState` reading `data` first, forcing a
500 on a filtered shelf showed the old, unfiltered list — no error, no retry, wrong products — and
switching products quickly could show the previous product. Fixed by checking `isError`, then
`isLoading`, then `data`; pinned by `src/lib/remoteState.test.ts` and the HomePage state test.

**2. "Clear filters" could not be escaped.** With a search in the box, clearing changed the URL, the
debounced draft still held the term, and the draft-sync effect wrote it straight back. The empty state
was a dead end. Fixed by letting only a keystroke push the draft into the URL (`draftFromUser` in
`src/components/FilterBar.tsx`); pinned by the `adopts an external clear…` test.

**3. The last add-to-cart could be lost.** Writes are throttled by 250 ms, so an immediate reload or tab
close dropped the pending snapshot and the cart came back short. Fixed by flushing on `pagehide` and on
`visibilitychange → hidden`; pinned by `src/app/persist.test.ts`.
