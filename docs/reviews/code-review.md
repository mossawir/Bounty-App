# Code review

> **Scope note.** No partner pull request was available in the environment this submission was
> assembled in, so this is a **self-review** of this project's changes, plus the replies I would
> give to those comments on my own pull request. It follows the required shape: at least five useful
> comments covering correctness, readability and accessibility, plus one piece of praise. Each entry
> names the file and the line as it existed at review time, so the history is checkable.

## Comments

### 1. Correctness — `src/app/persist.ts:50` (blocking)

> `store.subscribe` fires for **every** action, including the live-stock tick that dispatches every
> 1.3–3.4 s. The 250 ms throttle bounds the frequency, but the payload (cart + auth) rarely changes,
> so we rewrite the same JSON to `localStorage` for the lifetime of the tab. On a slow device that is
> synchronous main-thread work for no reason.
>
> Suggest serialising once and skipping the write when the string is unchanged. That also makes the
> early-return cheap.

**Status:** fixed in this PR. `flush()` now keeps `lastWritten` and returns before touching storage
when the cart and session are identical. The realtime slice is intentionally not part of the
persisted shape.

**Reply:** agreed, and I went one step further: only cart/auth are serialised, so a realtime tick
cannot accidentally enter storage in the future either.

---

### 2. Correctness — `src/api/client.ts:70` (blocking)

> The mock returns the same object references that live in `src/mocks/db.ts`. RTK Query stores them
> and Immer freezes them. The next `db.decrementStock()` after a checkout then throws
> `Cannot assign to read only property 'stock'`, and the error surfaces as a generic network failure.
> A real server would serialise the response; the mock has to do the same.
>
> Please clone at the transport boundary, and add a regression test that goes through the store, not
> just through `handleMockRequest`.

**Status:** fixed. `clone()` in `client.ts` uses `structuredClone` (JSON fallback), and
`src/api/client.test.ts` dispatches a real query through the store, then mutates the database and
asserts it does not throw and the cached copy is unaffected.

**Reply:** this is the best catch of the week and it was invisible to 60 unit tests. It is now in
[`ai-notes.md`](../ai-notes.md) as the example of why the browser smoke script exists.

---

### 3. Accessibility — `src/components/ProductCard.tsx:26` (blocking)

> ```tsx
> <Link className="card-link" to={...} tabIndex={-1} aria-hidden="true">
>   <div className="card-media">…</div>
> </Link>
> ```
>
> `aria-hidden` on a focusable element is invalid ARIA, and the card already has a second link on
> the heading with the same destination. A screen-reader user gets a hidden interactive element and
> a duplicated navigation target; a keyboard user gets a link that is skipped but still exists in the
> accessibility tree.
>
> Make the media a plain `<div>` and keep exactly one link per card, on the name.

**Status:** fixed. The media is now non-interactive; the only link is the product name, which the
button's `aria-label` complements. The card is still visually clickable via the name.

**Reply:** the duplicated link existed to make the image feel clickable. Losing that is worth
removing the ARIA violation; a single link is also easier to explain.

---

### 4. Correctness / UX — `src/pages/CheckoutPage.tsx:104` (should fix)

> The catch block maps **every** `AppError.fieldErrors` into form-field errors. But a 409 from the
> server carries `details: { productId, productName, available, requested }` — those become field
> errors for fields that do not exist, `Object.keys(fieldErrors).length` is non-zero, and the banner
> never renders. The user sees nothing after a sold-out item.
>
> Only map `bad_request` details to fields; everything else belongs in the banner, and 409 should
> name the product from `conflictProductId`.

**Status:** fixed. The catch block now filters through `CHECKOUT_FIELD_IDS` and only for
`bad_request`; 409 renders the banner with the cart item's name and a link back to the cart.
`CheckoutPage.test.tsx` covers the exact message.

**Reply:** good catch. I also kept the unknown-field case safe: when a 400 has details we do not
recognise, `mapped` is empty and the generic banner appears rather than silence.

---

### 5. Readability — `src/mocks/catalog.ts:132` (non-blocking)

> `pick()` is the only non-null assertion in `src/`:
> `return items[index] ?? items[0]!;`. Under `noUncheckedIndexedAccess` that `!` is a promise the
> arrays are never empty, but the type does not say so. A `readonly [T, ...T[]]` parameter would
> encode it, and the compiler would then prove the fallback safe.
>
> Not urgent — the arrays are module constants — but it is the first thing a reader will trip on
> after the strictness claims in the README.

**Status:** acknowledged, not changed in this PR. `pick()` is called with eight module-level constant
arrays; converting them all to tuple types ripples into the name builders for no runtime change.
Tracked as a follow-up; the assertion is commented by the function's placement next to the constants.

**Reply:** fair. I would rather do that in a dedicated cleanup than smuggle type churn into a
feature PR — but I agree the strict story is weaker with an unexplained `!` in the codebase.

---

### 6. Praise

> The error path is the strongest part of this codebase. `normalizeError()` turns HTTP errors, aborts
> and unknown throws into one shape; `isAppError()` prevents the double-normalisation that would have
> relabelled a 409 as a network error when RTK Query re-throws it; and `toRemoteState()` makes the
> loading/error/success union impossible to misuse. The screens never read a response body, and raw
> server strings never reach the DOM. That is the kind of boundary that survives a backend rewrite.

**Reply:** thank you — the passthrough check in `normalizeError` exists because a 409 initially
surfaced as “We couldn't reach the bazaar” in exactly the way you describe.

## Comments I responded to on my own PR

| Comment                                                     | Response                                                                                                                                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Why is `featured` catalogue order rather than top-rated?”  | Because a rating sort with one-decimal ratings clustered the landing page into 4,000 identical stickers at the same price. Featured is a merchandising order; sorting is the user's choice via the select. |
| “Why keep the mock in the production bundle?”               | Trade-off accepted for a no-backend submission; flagged as a risk in the architecture review with a concrete dynamic-import mitigation.                                                                    |
| “Should the cart remove a line whose live stock hits zero?” | No: silently removing someone's cart is worse than telling them. The cart shows “Only N left”, checkout returns 409 and names the item.                                                                    |
| “Two tabs can create two orders.”                           | True — each tab mints its own key, which matches two explicit clicks. If that is wrong, the key must move to `sessionStorage` so tabs share it. Documented in `orders.md`.                                 |

## What I looked for (and did not find)

- No `any`, no `@ts-ignore`, no `eslint-disable` except a documented one.
- No `dangerouslySetInnerHTML`; all user-visible text is React-escaped.
- No token or password ever logged.
- No unbounded timers: every `setTimeout`/`requestAnimationFrame`/socket has a cleanup path.
