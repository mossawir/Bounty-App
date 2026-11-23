# Walkthrough script (10 minutes)

The demo the brief asks for: full shopping flow, one hard bug, one trade-off. Times are targets, not
rules.

## 0:00 — What it is (30 s)

“The Bug Bazaar: a React + TypeScript store for developer gear. 5,000 seeded products behind a mock
API, cart and session in Redux Toolkit, live stock, accessible, tested, with CI. The brief fixed the
API contract; every choice on top of it is in `docs/decisions.md`.”

## 0:30 — Browse and filter (2 min)

1. Home. Point at the pager: “5,000 products, 24 per page — the request is 3.6 kB, the page is 27k px
   tall, and page 2 is one click away.”
2. Type `thock`, click **Keyboards**, toggle **In stock only**, change the sort. Point at the URL:
   “Filters and page live in the query string, so refresh, copy-link and Back all work.”
3. Press Back. The previous filters return. Click **Page 2**, then change a filter: “It resets to
   page 1 — staying on page 7 of a two-page result is the classic bug.”
4. Search `zzzzz` → empty state with **Clear filters**. Point at the live region announcing the count.
5. Set **Per page** to 96: “At 96 the grid virtualizes; at 24 every card is in the DOM.”

## 2:30 — Product, live stock, cleanup (1.5 min)

1. Open a product. Point at the price from cents, the stock pill, the quantity cap.
2. Watch the header chip: **Live stock**. Wait for a tick; the stock number changes without a refresh.
3. Open the bug lab → **Drop live stock socket**. Chip goes **Reconnecting**, then recovers — the
   backoff is 600 ms doubling to 6 s.
4. Scroll down: Back to Top appears. “That listener is added on mount and removed on unmount.”

## 4:00 — Cart and persistence (1 min)

1. Add two things, open the cart, change quantities past the stock cap — it clamps.
2. Reload the page. Cart and badge survive (`localStorage`, same slice).
3. Point at the header badge: “Derived selector, never stored.”

## 5:00 — Auth and redirects (1.5 min)

1. Checkout while signed out → `/login?next=%2Fcheckout`.
2. Submit empty → errors announced, focus on the first invalid field.
3. Wrong password → friendly message, no raw server string.
4. **Fill demo credentials** → back to checkout, cart intact.
5. Bug lab → **Session → 401 at checkout**, then place the order. “One 401 clears the session in one
   place; the guard sends me back to sign-in with `?next=` and the cart is untouched.”
6. Point at `docs/auth.md`: “Token in localStorage, XSS trade-off documented.”

## 6:30 — The 409 and the retry (2 min)

1. In the bug lab, press **Sell out cart item → 409**. Place the order → banner names the item that
   sold out; cart kept; **Update the cart** link.
2. Reduce the quantity, enable **500 after commit**, place the order → error banner explains the order
   may exist and that retry is safe.
3. Press **Place order** again. Same order id, one order in the system. “That is the idempotency key
   scoped to the cart signature — `docs/orders.md` has the three layers and the tests.”

## 8:30 — Quality evidence (1 min)

- `npm test` → 96 tests. “Cart math, hooks, contract, paging, login, filtering, checkout 409 and
  duplicate prevention.”
- `.github/workflows/ci.yml` → lint, typecheck, test, build; a failing test fails the required check.
- Lighthouse: 100 accessibility on home, cart, login (`docs/accessibility.md`).
- `docs/performance.md`: payload 745,699 B → 3,625 B, page height 5.3M → 27k px, and the 96/page
  virtualized path measured with `scripts/measure.mjs`.

## 9:30 — Hard bug and trade-off (30 s each)

**Hard bug:** “Checkout worked in tests and failed in the browser. The mock server and the RTK Query
cache shared object references; Immer froze them, and the next stock write threw. It surfaced as a
generic network error because the throw bypassed the HTTP mapping. Fixed by cloning at the transport
boundary — a real API serialises, so the mock now does too — and I added a regression test that goes
through the store. It is the reason `scripts/capture.mjs` exists.”

**Trade-off:** “The token is in `localStorage`, which an XSS can read. The alternative — an
`httpOnly` cookie — needs a real server and CSRF handling, which this submission does not have. I
chose reload persistence with a documented risk, and `docs/auth.md` says exactly what I would change
in production: short-lived access token in memory plus an `httpOnly` refresh cookie, keeping the same
`?next=` and 401 flow.”

## Likely questions

- **Why RTK Query over TanStack Query?** One state system with Redux; per-argument cache keys are the
  race fix; tags invalidate after an order. Full answer in `ARCHITECTURE.md`.
- **What breaks if search moves server-side?** The debounce stays in the client (it is input pacing),
  the query key stays, `queryProducts` moves behind the endpoint.
- **What happens when the live feed and the cache disagree?** The feed wins at render, the cache stays
  server-authoritative, and a refetch never loses an override.
- **Two tabs?** Two idempotency keys, two orders — matching two explicit clicks. Move the key to
  `sessionStorage` if that is not desired; noted in `orders.md`.
