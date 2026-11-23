# Glossary

Six terms from the brief, in my own words, each with something concrete from The Bug Bazaar.

## Latency

The time between asking for something and getting it — not throughput, not “speed” in general.

**In the store:** the mock API deliberately adds 180 ms ± 140 ms to every request so loading states
are real, not theoretical. A product page shows a skeleton for that window. The profile is
`latencyMs` in `src/mocks/db.ts`, and the bug lab can raise it to 1,200 ms to feel a bad connection.
When people say “p95 latency”, they mean 95% of requests finish faster than that number — the slow
tail, not the average, is what users remember.

## Idempotency

Doing the same operation twice has the same effect as doing it once.

**In the store:** placing an order twice with the same `idempotencyKey` returns the first order and
does not decrement stock again. This is why a retry after a lost 500 is safe: the client keeps the key,
the server recognises it, and no second order appears. `GET` is naturally idempotent; the interesting
work is making `POST` behave that way.

## Horizontal scaling

Adding more machines of the same kind, instead of making one machine bigger (vertical scaling).

**In the store:** the frontend is already stateless — every tab is independent, and the only thing it
keeps is a cart in `localStorage`. In a real deployment, ten copies of the order service can run
behind a load balancer, but only because two things are shared: sessions/tokens are validated against
a shared store, and the idempotency key lives in the database, not in one server's memory. If the key
were kept in a single process's `Map` (as the mock does), retries hitting another replica would
double-charge. That is the concrete reason horizontal scaling forces shared state.

## CDN (content delivery network)

A set of servers close to users that cache static files, so the origin is asked only when the cache
misses.

**In the store:** the build produces hashed assets (`index-5y0zJ00F.js`). `index.html` is served
short-lived, the hashed files “forever”. The 12 product illustrations in `public/img` are static SVG;
they change rarely and are the first thing a CDN would hold in every region. The catalogue JSON and
order requests are not CDN material — they are per-user or must be fresh.

## Cache invalidation

Deciding when a cached copy is no longer true, and replacing it. The hard part of caching is not
storing; it is knowing when to stop trusting the store.

**In the store:** RTK Query keeps product data for 10 minutes. After an order is placed, the
`createOrder` mutation invalidates the `Products` list and the ordered `Product` tags, so stock
numbers refresh. Live stock is handled differently: the socket writes overrides into Redux and they
are merged at render, because invalidating the cache on every tick would cause a refetch storm.
“Revisiting a product is instant” and “stock after checkout is fresh” are both cache decisions.

## Eventual consistency

After a write, different parts of the system may briefly disagree; they converge if nothing new
happens.

**In the store:** checkout returns `201 { status: "queued" }`. The order exists immediately, but
payment, inventory and email are asynchronous: the confirmation screen says “queued”, not “paid”.
The stock number in the catalogue may still show the old value for a moment until the live feed or a
refetch updates it. The 409 response is exactly the visible symptom of eventual consistency — the
cart's snapshot and the inventory service disagreed, and the server is the authority.

## Two more worth knowing

- **Throughput** — how many operations per second the system completes. Latency is one request;
  throughput is the queue. The bazaar's 5,000-item list is a _rendering_ throughput problem; the grid
  solves it by not doing 5,000 units of work per frame.
- **Backoff** — waiting longer between retries instead of hammering a failing dependency. The live
  stock socket reconnects at 600 ms, 1.2 s, 2.4 s … capped at 6 s, and the email worker in
  [`orders.md`](./orders.md) uses the same idea.
