# Authentication Delivery and Route Protection

## Boundary

Protected Server Components call `requirePageAuthorization`, which reads the host-only opaque session cookie and delegates to the same `application/identity` authorization service used by Route Handlers. The service resolves a fresh tenant-scoped authorization context for every protected request; no role, organization, or permission supplied by a browser is trusted. `app/admin/users/page.tsx` requires `admin` authorization during Server Component rendering, so operators, revoked sessions, and inactive users cannot rely on an optimistic proxy result. Because this path reads the request cookie, Next.js renders it dynamically.

Production page authorization accepts only the secure `__Host-sentinel_session` cookie. Local development over HTTP uses `sentinel_session` because browsers reject the secure host-prefixed cookie on an insecure origin; protected Server Components accept that fallback only outside production. The host-prefixed cookie always takes precedence when present.

Administrative handlers validate same-origin requests, the cookie session, active organization membership, and the admin role before translating HTTP input into application use-case calls. Administrative UI calls only those delivery endpoints and displays response errors; it does not determine reset eligibility, membership status, or last-admin policy. Membership updates use `PATCH /api/admin/users/[userId]/membership` with `{ role }` or `{ status: "active", role }`. The handler validates only the delivery contract and always delegates to `reactivateMembership`; it never chooses an invariant from client status. The application reads the persisted membership: inactive memberships are reactivated without touching identity credentials, while active memberships use the transactional last-admin role guard and scoped session revocation. Temporary passwords exist only in the successful create or exclusive-reset response state and can be dismissed; they are neither logged nor persisted by the UI.

## Proxy

`proxy.ts` is intentionally optimistic. It redirects a request without the session cookie to `/login` and refreshes cookie attributes when a token exists. It does not import persistence, query MongoDB, or decide authorization. Definitive access control remains in Server Components and Route Handlers through `application/identity`.
