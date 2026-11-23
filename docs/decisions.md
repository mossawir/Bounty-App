# Decisions

What we picked, what we compared it with, and why. Each entry is scoped so it can be defended in
the walkthrough.

## Tooling

| Decision     | Chose                                          | Considered                           | Why                                                                                                                                                                                       |
| ------------ | ---------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build tool   | Vite 5                                         | Next.js, CRA, Parcel                 | The brief is a client-only store. Vite gives instant HMR, first-class TS and a tiny config; Next would add a server we do not need.                                                       |
| Language     | TypeScript strict + `noUncheckedIndexedAccess` | Plain JS + JSDoc                     | The contract already has a lot of shapes; the compiler is the cheapest test we own. `any` and `@ts-ignore` are lint errors.                                                               |
| Routing      | React Router 6 (data APIs off)                 | TanStack Router, wouter              | URL-driven filters and `?next=` redirects are the core requirement; React Router is the boring, documented choice.                                                                        |
| Global state | Redux Toolkit                                  | Zustand, Jotai, Context              | The brief asks for RTK specifically (D3-1), and derived cart count/total plus listener-style middleware are natural here.                                                                 |
| Server state | RTK Query                                      | TanStack Query, hand-rolled hooks    | One cache, one loading/error model, per-argument cache keys (which is the race-condition fix), tag invalidation after an order. It is also part of RTK, so one dependency instead of two. |
| Styling      | Hand-written CSS with tokens                   | Tailwind, CSS-in-JS, a component kit | No build step, no runtime, and the visual identity (paper, ink, hard shadows) is easier to express in plain CSS. Three stylesheets: base, components, pages.                              |

## Data layer

| Decision            | Chose                                              | Considered                            | Why                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mock backend        | In-browser module that implements the routes       | MSW, JSON Server, Mirage              | No service worker to install, no extra process, works in Vitest, and the error injection is a function call. The boundary is `src/api/client.ts`, so replacing it with `fetch` is one env var. |
| Request entry point | `src/api/client.ts` → RTK Query `baseQuery`        | `fetch` in components, axios instance | Single place for auth header, error normalisation, abort signals and (mock) latency. Components cannot make network calls.                                                                     |
| Error model         | One `AppError` discriminated shape                 | Throw `Error`, per-endpoint unions    | Every screen maps `kind` to copy; 401 handling lives in exactly one place (the base query).                                                                                                    |
| Money               | Integer cents end to end, format at render         | Floats, decimal.js                    | The contract stores cents. Floats accumulate error with quantities; formatting once at the edge keeps arithmetic exact.                                                                        |
| Persistence         | Cart + session in `localStorage` (`bug-bazaar:v1`) | `sessionStorage`, IndexedDB, cookies  | The cart must survive a reload. IndexedDB is overkill for a kilobyte; the token trade-off is in [`auth.md`](./auth.md).                                                                        |

## Browsing

| Decision        | Chose                                                      | Considered                                 | Why                                                                                                                                                                                                                           |
| --------------- | ---------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filter state    | URL search params                                          | Component state, Redux                     | Refresh, copy-link and Back all fall out for free. A custom hook (`useProductFilters`) is the only writer.                                                                                                                    |
| Search input    | 350 ms debounce + Enter to apply                           | Apply on every keystroke, submit-only      | Keystrokes must not rewrite the URL or fire a request per character, but Enter should feel instant.                                                                                                                           |
| Large lists     | Pagination at 24 per page (48/96 offered)                  | One long virtualized list, infinite scroll | 5,000 products in one page was a 5.3-million-pixel scroll. A page is 3.6 kB instead of 745 kB and the page height drops 198×; users also get a finite, labelled result set. The long list stays one click away via page 209.  |
| Paging state    | `page` + `pageSize` in the URL                             | Redux, component state                     | Copying `?category=coffee&page=2` reproduces the view, Back steps through pages, and filters reset to page 1 in one place (`useProductFilters`).                                                                              |
| Large page size | Window virtualization above 60 items                       | Plain grid at every size                   | At 96 per page virtualization cuts the DOM from 1,909 to 526 nodes. Under 60 items the plain list is better for find-in-page and screen readers, so the threshold stays.                                                      |
| Small lists     | Plain `<ul>` under 60 items                                | Always virtualize                          | Every paginated page and filtered result is fully in the DOM, so find-in-page and screen readers see all of it.                                                                                                               |
| Race conditions | Per-argument cache keys (RTK Query) + abort on unsubscribe | Manual request ids, `latestRef`            | A late response for query A is stored under A's cache entry; the screen only ever reads the entry for the current query. No hand-written guard to get wrong.                                                                  |
| Caching         | `keepUnusedDataFor: 600`, tags invalidated after an order  | Refetch on every mount, SWR                | Revisiting a product is instant; stock is refreshed after checkout. Stale prices for 10 minutes are acceptable for a catalogue; stock is _not_, which is why orders invalidate product tags and the live feed overlays stock. |

## Buying

| Decision        | Chose                                                                       | Considered                                                  | Why                                                                                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cart storage    | Redux slice + localStorage, stock snapshot per line                         | Server-side cart, no persistence                            | No backend. A snapshot lets the cart render offline; the server is still the source of truth at checkout (409 otherwise).                                                                              |
| Quantity limits | Clamped at add and at the stepper                                           | Validate only at checkout                                   | Better UX, but checkout still validates: stock can change while you shop.                                                                                                                              |
| Idempotency     | Client key scoped to the cart signature; server keeps `(user, key)` → order | Disable the button, dedupe by items, server-side request id | A retry after a lost response must return the first order. Hashing the cart contents would wrongly merge two intentional identical orders; a per-attempt key scoped to the cart is the standard shape. |
| Auth            | Mock bearer token in the persisted store; guarded routes with `?next=`      | Cookies, OAuth                                              | The brief only needs login/logout/protect/redirect. Cookie auth would need a real server. Trade-offs in [`auth.md`](./auth.md).                                                                        |

## Realtime

| Decision               | Chose                                                    | Considered                                | Why                                                                                                                                                                                                                                                               |
| ---------------------- | -------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live stock             | Mock socket class with reconnect/backoff, wired to Redux | WebSockets to a real server, SSE, polling | A real socket needs a server. The class exposes the same lifecycle a browser `WebSocket` does (`connect`, `close`, `status`), so swapping it is local. Polling was rejected because the brief wants updates _without_ a refresh and a feed that visibly recovers. |
| Where live stock lives | `realtime` slice overrides merged at render              | Patch the RTK Query cache                 | One writer, easy to test, and a refetch never loses an override. The server data stays authoritative and the socket is a hint layer.                                                                                                                              |

## Quality

| Decision   | Chose                                                              | Considered                   | Why                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests      | Vitest + Testing Library (jsdom)                                   | Jest, Playwright-only        | Fast, same Vite config, and behaviour-level queries. One local Playwright script covers the real-browser smoke path; it is not in CI to keep the pipeline fast and secret-free. |
| CI         | One workflow: lint → typecheck → test → build                      | Separate workflows per check | Sequential jobs fail fast and the branch protection requirement is one status.                                                                                                  |
| Monitoring | In-house logger + ErrorBoundary + optional `VITE_ERROR_REPORT_URL` | Sentry                       | No account or DSN in the repo; the logger has the same seams (ring buffer, sinks). Three metrics to watch are in [`monitoring.md`](./monitoring.md).                            |

## Things deliberately skipped

- **SSR / SEO** — a client-only store was asked for; route-level code splitting covers the first-load
  cost.
- **Server-side search** — the mock filters 5,000 items in memory. A real API would be required past
  that scale; the query shape already supports it.
- **A design system dependency** — the store has one look; tokens + three CSS files are easier to
  review than a kit's overrides.
- **Prefetching on hover** — measured no benefit for a 5 ms mock, and it adds cache pressure.
