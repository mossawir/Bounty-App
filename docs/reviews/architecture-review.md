# Architecture review

> **Scope note.** The brief pairs two engineers for this review. No partner repository was available
> in the environment this submission was assembled in, so this document is a structured **self-review**
> of [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) and the code it describes. It follows the required
> shape — two strengths, two risks, one recommendation — and is written so it can be swapped for a
> partner review by replacing the quoted evidence with the partner's. It is intentionally critical;
> a review that only finds strengths is not a review.

## Two strengths

**1. The state-ownership table is prescriptive, not descriptive.**
The document does not just say “Redux and RTK Query”; it assigns each fact to one owner (server →
RTK Query, client → slices, filters → URL, persistence → `localStorage`) and then derives rules from
it: the cart badge must be a selector, the socket must write overrides instead of patching the cache,
and no component may keep a second copy of filter state. Those rules are visibly followed in
`Header.tsx` (`selectCartCount`), `realtimeSlice.ts` and `useProductFilters.ts`. A new engineer can
predict where a new piece of state belongs, which is the whole point of the document.

**2. The boundaries are drawn where they can be replaced cheaply.**
`src/api/client.ts` is the only module that performs I/O, and `realtime/stockSocket.ts` exposes the
same lifecycle as a browser WebSocket. Both are one-file swaps, and the document says so explicitly
(“set `VITE_API_BASE_URL`”, “reimplement `StockSocket` with a real WebSocket”). This is stronger than
a diagram of boxes: each boundary names the change required to cross it.

## Two risks

**1. The mock API is bundled into the production build.**
`app/api.ts` imports `client.ts`, which statically imports `mocks/server.ts`, which imports the 5,000
item generator. That is why the shared chunk is 291 kB and why the catalogue is in every route.
Today it is the feature (“runs without a backend”); tomorrow it is dead weight in the bundle and a
subtle security smell if the mock were ever pointed at real data. The architecture doc mentions the
swap but does not treat the mock as a **deploy-time** concern.

_Mitigation:_ the build has no separate “real API” profile. A dynamic `import()` of the mock behind
`if (USE_MOCK)` would move the catalogue out of the initial chunk, and a Vite `define` could strip it
entirely in production. This is a real gap, not a stylistic one.

**2. Virtualized rows are a known accessibility cliff, and the document undersells it.**
The pattern is correct for 5,000 items, and the `<60 items` plain-list rule is a good mitigation. But
the ARCHITECTURE section frames virtualization purely as a performance decision. In practice it
changes the document structure that assistive technology sees: tomorrow’s row is not in the DOM, so
“list, 5,000 items” is not true, and focus can land on an element that unmounts during a live stock
tick. The accessibility doc mentions this; the architecture doc should carry the same warning,
because that is where the decision is justified.

_Mitigation:_ put `aria-setsize`/`aria-posinset` on cards, or paginate for keyboard users, and make
the grid expose a real count in a live region. The current 60-item threshold hides the problem in
filtered views, which is exactly how it will be missed in review.

## One recommendation

**Make the mock/real boundary a build-time decision, not a runtime branch.**

Concretely: resolve the transport with `import.meta.env.VITE_API_BASE_URL`, but load the mock through
a dynamic import inside the mock branch, and add a `vite.config.ts` flag that aliases
`@/mocks/server` to an empty module for authenticated production builds. The client keeps its current
shape:

```ts
if (USE_MOCK) {
  const { handleMockRequest } = await import('@/mocks/server');
  …
}
```

Expected effect: the catalogue and route table move out of the shared chunk (the measured baseline is
in [`performance.md`](../performance.md)), and a real deployment cannot accidentally ship a fake
backend. The cost is one dynamic import in the data layer and one alias — smaller than the current
risk of the mock becoming permanent.

## What I would ask the author in the walkthrough

1. Why RTK Query rather than TanStack Query, given that the store already uses Redux? (The defensible
   answer is in the doc's last section — I want to hear it without the doc.)
2. What happens to the cart when the live feed reports `stock: 0` for a line that is already in it?
   (Today: the badge still counts it, checkout returns 409. Is that the intended UX?)
3. How would the architecture change if search had to move server-side? (Which layer owns the
   debounce then?)
