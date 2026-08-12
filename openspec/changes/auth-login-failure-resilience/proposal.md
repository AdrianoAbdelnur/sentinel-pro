# Proposal: Login Failure Resilience

## Intent

Make login safe when infrastructure initialization fails and ensure the UI never crashes while handling a non-JSON or empty error response.

## Scope

- Start local Next.js and identity seed processes with the Windows system certificate store so Atlas TLS validation works.
- Map unexpected login delivery failures to a stable JSON `500` response without exposing internals.
- Make the shared authentication form safely consume empty or non-JSON responses.
- Preserve successful local HTTP sessions when protected Server Components authorize the next page.
- Render all authentication labels, actions, and errors in Spanish.

## Out of Scope

- Changing authentication rules, credentials, session semantics, or MongoDB schemas.

## Success Criteria

- A local login request reaches MongoDB without manual runtime certificate flags.
- Any login failure leaves the form usable and displays a generic error.
- A successful login over local HTTP remains authorized after navigation to `/live`.
- Tests cover both the route failure and malformed response handling.
