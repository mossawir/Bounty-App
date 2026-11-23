# Monitoring

What happens when something breaks, what is logged, and the three things worth alerting on.

## What is wired up

1. **Error boundary** — `src/components/ErrorBoundary.tsx`. A render error shows a human fallback
   (“Something fell off the shelf”), keeps the cart, offers “Try again” and a link home. The error and
   React's component stack are reported instead of a white screen.
2. **Global handlers** — `installGlobalErrorHandlers()` in `src/lib/logger.ts` listens for
   `window.error` and `unhandledrejection`, so a rejected promise in an event handler is logged too.
3. **Logger** — a dependency-free module with a 50-entry ring buffer, `console` output, and sinks.
   When `VITE_ERROR_REPORT_URL` is set, error-level events are POSTed with `keepalive`, which survives
   a page unload. Without it, events stay in the buffer (visible in dev tools) — no account or DSN is
   committed to the repo.
4. **Request correlation** — every request gets an `x-request-id`; the normalised `AppError` carries
   it, so a user-visible failure can be matched to a server line.
5. **Live feed status** — the header chip shows `Live stock` / `Reconnecting` / `Stock paused`, and the
   reconnect count is in the realtime slice, so “the feed is down” is visible rather than silent.

What is **not** logged: tokens, passwords, email addresses or full order payloads. The logger takes
explicit context, and callers pass ids and codes, not user data.

## The three things worth tracking

| #   | Metric                                                               | Why it matters                                                                                                                                                                                          | Alert idea                                                                                                     |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | **Checkout failure rate by HTTP status** (401 / 409 / 500, per hour) | Checkout is the only revenue path. A spike in 500s is an outage; a spike in 409s is a stock-sync problem between the cart and the inventory service; a spike in 401s usually means token refresh broke. | Page when 5xx > 1% of attempts over 5 minutes, or 409 > 5% over 15 minutes.                                    |
| 2   | **p95 order request latency**                                        | Latency is the leading indicator of a queue backlog or a slow inventory check, before it becomes a failure.                                                                                             | Warn at 800 ms p95 for 10 minutes, page at 2 s.                                                                |
| 3   | **Live stock feed reconnect rate** (reconnects per session)          | If sockets drop constantly, stock is stale and shoppers hit 409s at checkout. Reconnect churn is the signal; a single reconnect is normal.                                                              | Warn when > 3 reconnects per session over 1 hour, or when the share of sessions with a closed feed exceeds 2%. |

Two supporting signals, cheap to collect and useful during an incident: JavaScript error count per
route, and the ratio of `order_created` to `checkout_started` (a falling ratio with no error spike
usually means a UI bug, e.g. a disabled button).

## How an incident reads

```
checkout_failed  status=500  code=ORDER_COMMIT_RESPONSE_LOST  requestId=…  orderId=ord_00142
checkout_retried status=201  requestId=…  idempotent_replay=true
```

The retry logging the same `orderId` is the proof that the idempotency key worked. If the second line
shows `idempotent_replay=false`, we have a double-order bug and the pager is justified.

## Deliberate gaps

- No sampling: at this size, send every error. At scale, sample successes and keep 100% of errors.
- No PII scrubbing pipeline: the logger only receives what callers pass; a real deployment should
  still add a scrubber in the sink.
- No synthetic checks: the mock API cannot be down. In production, add a synthetic `POST /api/login`
  and a `GET /api/products` canary every minute.
