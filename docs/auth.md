# Auth

## What the store needs

- Log in and log out.
- Protect `/account`, `/checkout` and `/orders/:id`.
- Return the shopper to where they were after logging in.
- A 401 anywhere clears the session.
- The login form must not be double-submitted.
- Nothing here is real security: the token is issued by an in-browser mock.

## Where the token is stored

The token and user live in Redux (`auth` slice) and are persisted to `localStorage` under the key
`bug-bazaar:v1`, together with the cart:

```json
{
  "cart": { "items": [] },
  "auth": {
    "token": "bb.u-1001.7f3a…",
    "user": { "id": "u-1001", "email": "demo@bugbazaar.dev", "name": "Demo Shopper" }
  }
}
```

`src/app/persist.ts` writes throttled snapshots (250 ms) and restores them on boot through
`hydrateSession` / `hydrateCart` actions, not through `preloadedState` — that keeps the store's state
type exactly what the reducers produce.

### The trade-off

`localStorage` is readable by any JavaScript running on the origin. One successful XSS — a bad
dependency, an injected script, a compromised third-party snippet — can exfiltrate the token and
impersonate the user until it expires. It is also readable by anyone with access to the machine
(a shared laptop, a screen-share that opens dev tools).

Alternatives and why they were not used here:

| Option                                  | Upside                                            | Downside for this project                                                                                      |
| --------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `httpOnly; Secure; SameSite=Lax` cookie | JavaScript cannot read it, so XSS cannot steal it | Needs a real server to set it, plus CSRF protection for state-changing requests. The app has no backend.       |
| In-memory only                          | Nothing on disk to steal                          | Every refresh signs the user out; the brief wants the cart (and, implicitly, the session) to survive a reload. |
| `sessionStorage`                        | Cleared when the tab closes, smaller blast radius | Still readable by XSS, and breaks the “come back tomorrow” experience.                                         |

**Decision:** `localStorage`, documented, with the shortest acceptable token lifetime in a real
system. In production this becomes a short-lived access token in memory plus an
`httpOnly` refresh cookie, with rotation and revocation; the `?next=` redirect and 401 handling stay
exactly the same.

The mock token is `bb.<userId>.<random>`. The mock accepts it if the user exists, which is why a
reload does not sign you out even though the in-memory session table is gone. A real backend would
validate a signed JWT or look the token up server-side.

## Session lifecycle

1. **Login** — `POST /api/login` returns `{ token, user }`; the slice stores both; the router sends
   the shopper to `?next=` (validated by `safeNextPath`, which only allows same-origin paths).
2. **Reload** — `persist.ts` restores the token; `useGetMeQuery` is available if a screen needs to
   revalidate (the mock also accepts the stateless token, so the demo stays signed in).
3. **401 anywhere** — `src/app/api.ts` catches the normalised error and dispatches `sessionExpired()`
   exactly once per request. That clears `token`/`user`, sets a notice, and every `RequireAuth`
   route redirects to `/login?next=…` on the next render.
4. **Logout** — `signedOut()` plus `bazaarApi.util.resetApiState()` (so the next person on the
   machine does not see cached personal data), then navigate home.

## Double-submit protection

`LoginPage` keeps a `submitting` ref. The ref is checked and set synchronously at the start of the
submit handler, before React has a chance to re-render with `isLoading`, so two clicks in the same
tick produce one request. The button is also `disabled` while the mutation is in flight. The
behaviour is covered by a test that fires two `submit` events in one tick and asserts a single
toast/session.

## Protected routes

`RequireAuth` wraps the element, not the layout, so the header and footer still render while the
redirect happens. `?next=` is encoded from `location.pathname + location.search`, and
`safeNextPath()` rejects absolute URLs and `//host` tricks to avoid an open redirect.

## Checklist against the brief

| Requirement                         | Where                                                     |
| ----------------------------------- | --------------------------------------------------------- |
| Login + logout                      | `src/pages/LoginPage.tsx`, `src/pages/AccountPage.tsx`    |
| Protected account, checkout, orders | `src/features/auth/RequireAuth.tsx`, `src/app/App.tsx`    |
| Return to the previous page         | `?next=` + `safeNextPath`, tested in `LoginPage.test.tsx` |
| 401 clears the session              | `src/app/api.ts` → `sessionExpired()`                     |
| Login cannot double-submit          | `submitting` ref + disabled button + test                 |
| Token storage documented            | this file                                                 |
