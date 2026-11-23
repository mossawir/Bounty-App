# Reflection

Honest self-assessment after the week. Scores are out of 10 against “could I defend this in a
walkthrough and extend it under pressure”, not “does it exist”.

## Ratings

| Topic                        | Score | Why                                                                                                                                                                                                                       |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup                        | 9     | Clone → `npm install` → `npm run dev` works from the README; strict TS, ESLint, Prettier, CI, env example. Missing only a `.nvmrc`/engines pin.                                                                           |
| HTTP and API contracts       | 9     | Contract documented, every status and error body implemented and tested, including 409 details. No OpenAPI generation — the TS types are hand-written, which can drift from the doc.                                      |
| TypeScript                   | 9     | Strict + `noUncheckedIndexedAccess`, no `any`, no `@ts-ignore`, discriminated unions for request state and errors. The one `as CSSProperties` for a custom CSS variable is the only assertion.                            |
| Data layer                   | 9     | One client, one baseQuery, components never fetch, tags for invalidation.                                                                                                                                                 |
| Product list                 | 9     | Grid + details, cents rendered correctly, keyboard reachable, images have empty alt beside the heading.                                                                                                                   |
| Filters                      | 9     | URL is the source of truth, count, clear, debounce, Back/refresh/copy-link all work. No per-category counts.                                                                                                              |
| UI states                    | 8     | Loading/empty/error/success are consistent and retryable on both pages; the bug lab makes them reachable. Error copy is generic by design, and a 404 detail is visually the same panel as other errors (by choice).       |
| useEffect and cleanup        | 9     | Scroll listener with rAF + removal, timers cleared, socket closed, RTK Query aborts on unmount. The abort behaviour is framework-provided rather than hand-written, which is the right call but harder to demo.           |
| Custom hooks                 | 9     | Five typed hooks with real reuse and tests for two.                                                                                                                                                                       |
| Race conditions              | 8     | Solved by per-argument cache keys + abort; proven by a test with forced out-of-order responses. I can explain it, but I did not hand-write request sequencing, so the demo relies on the framework's behaviour.           |
| Redux Toolkit                | 9     | Cart and session in slices, derived count/total, defined updates only, persisted via actions.                                                                                                                             |
| Cart                         | 9     | Add/remove/quantity caps, survives reload, 409 names the item, idempotent retry tested twice over.                                                                                                                        |
| Auth                         | 8     | Login/logout, guards, `?next=`, 401 clears the session, double-submit blocked, storage trade-off documented. No token refresh or expiry, which a real backend needs.                                                      |
| Backend errors               | 9     | One normalisation layer, field errors for 400, sign-out for 401, 404 page, 409 item, retry for 500; raw messages never rendered.                                                                                          |
| Caching                      | 8     | Cache-first revisit, invalidation after orders, explicit reasoning about stale prices vs stale stock. No per-entity normalisation, so a big catalogue refetch is all-or-nothing.                                          |
| Accessibility                | 8     | Lighthouse 100 on home/cart/login, skip link, focus management, announced errors, live regions, contrast tokens. Not verified with a real screen reader, and virtualized rows are a known limitation.                     |
| Performance                  | 8     | Real before/after numbers (5× faster first paint, 184× fewer nodes), route splitting measured. No throttled lab run, no memory profile.                                                                                   |
| Memoization / virtualization | 9     | Window virtualizer with dynamic measurement, `React.memo` on cards, identity-preserving overrides, and a docs section that justifies what was skipped.                                                                    |
| WebSockets                   | 7     | The lifecycle, reconnect with backoff, focus and teardown are right, and the store is testable. It is a mock socket: no frames, no heartbeat, no auth handshake. I can explain real WebSockets but have not shipped them. |
| Testing                      | 9     | 78 tests across 15 files on behaviour: cart math, hooks, contract, login, filters, request-state mapping, persistence, checkout success/409/idempotency/double-submit. No visual regression, no browser test in CI.     |
| Git / CI / CD                | 8     | CI runs lint, typecheck, tests and build on every PR; failing test blocks merge once branch protection is on. No automatic deploy.                                                                                        |
| Monitoring                   | 7     | Error boundary, global handlers, request ids, sink and three metrics documented. No real dashboard or alert wiring; the sink is a stub without an endpoint.                                                               |
| Architecture                 | 9     | Folder map matches the code, data flow diagram, state ownership table, patterns with locations, and one defensible choice.                                                                                                |
| Design patterns              | 8     | Three patterns are real and consistent; the adapter boundary is the strongest one.                                                                                                                                        |
| Queues / microservices       | 7     | The flow, queue, DLQ and idempotent consumers are designed and tied to the code. No worker exists, so it is a paper design.                                                                                               |
| Architecture vocabulary      | 8     | Six terms with concrete store examples and honest caveats.                                                                                                                                                                |
| Reviews                      | 6     | The review docs are written to the required shape (2 strengths, 2 risks, 1 recommendation; 5 comments + praise), but there was no live partner repo to review in this environment.                                        |
| AI workflow and notes        | 9     | Three uses with prompts, keeps, changes, a real caught mistake, and what I would not delegate.                                                                                                                            |
| Submission                   | 7     | CI, README, docs and task-prefixed commits are in place. The pull request and the 10-minute walkthrough cannot be opened from this environment.                                                                           |

Average ≈ 8.3.

## Two gaps, one next step each

### Gap 1 — WebSockets are simulated

I understand the lifecycle, and the mock deliberately implements connect/close/status/backoff so the
swap is local. But I have not handled real frames, heartbeats, auth on the handshake, or back-pressure
from a server that sends 500 updates a second.

**Next step:** write a ~60-line `ws` server that broadcasts stock ticks for the products a client
subscribes to, add a `?token=` handshake check and a ping/pong heartbeat, then replace `StockSocket`
with a real WebSocket client and run the same reconnect test against a server that drops connections
on purpose. Timebox: one evening.

### Gap 2 — Accessibility stops at automation

Lighthouse is 100 on the three required pages and the keyboard path works, but a 100 does not mean a
screen-reader user can shop. A virtualized grid, a live stock feed and a toast-based “added to cart”
flow all have announcement problems that automated tools cannot see.

**Next step:** run a scripted NVDA (Windows) and VoiceOver (macOS) pass over the full purchase flow:
search → filter → open product → add → cart → login → checkout error → order. Record where
announcements are missing or doubled, and fix the first three issues — likely `aria-live` on the
result count being too chatty, the delta of a stock tick not being announced, and focus after the
virtualized row unmounts. Timebox: one afternoon plus fixes.

## What I would do differently

- Write the browser smoke script on day one. It found a bug 60 unit tests missed, and it is cheap.
- Decide the mock response-copy rule up front. The frozen-object bug was a boundary-design mistake,
  not a typo.
- Timebox polish on day four. The brief says finish days 1–3 first, and the temptation to restyle the
  grid is real.
