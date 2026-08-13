# Design: Redirect Authenticated Users Away from Login

## Technical Approach

Keep the login page as a server component and reuse `getPageAuthorization("operator")`, the same application boundary used by protected pages. Only an authorized result redirects; all other results preserve the current form.

## Architecture Decisions

### Decision: Gate in the server page

**Choice**: Perform authorization in `app/login/page.tsx` before rendering `LoginForm`.
**Alternatives considered**: Client-side cookie checks or proxy-wide login matching.
**Rationale**: Authorization is server-owned, avoids exposing session rules to the UI, and prevents a login flash.

### Decision: Redirect to the root route

**Choice**: Use `/` as the destination.
**Alternatives considered**: `/live` or a client-provided return URL.
**Rationale**: The requested behavior is the principal authenticated page, and `/` already enforces the operator authorization contract.

## Data Flow

`/login` → `getPageAuthorization("operator")` → authorized: `redirect("/")`; otherwise: render `LoginForm`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/login/page.tsx` | Modify | Add authorization check and redirect. |
| `app/login/page.test.tsx` | Create | Test authorized and forbidden branches. |

## Testing Strategy

| Layer | What to Test | Approach |
|------|-------------|----------|
| Unit/integration | Authorized visitor redirects; forbidden visitor sees form | Vitest with mocked authorization and `next/navigation`. |

## Migration / Rollout

No migration required.

## Open Questions

None.
