## Exploration: Auth and authorization foundation

### Current State
There is no authentication, session, user, role, organization membership, persistence, or authorization boundary. `/live` is public. Catalog administration cannot be introduced safely before this foundation exists.

### Affected Areas
- `app/layout.tsx`, `app/page.tsx`, and `app/live/page.tsx` - authenticated entry and protected Live delivery.
- New `domain/identity` and `application/identity` - users, credentials, memberships, tenant-scoped roles, sessions, password changes, and authorization use cases.
- New MongoDB persistence ports/adapters - persist users, memberships, and opaque server-side sessions.
- New auth delivery routes/pages - login, mandatory password change, tenant selection, and tenant switching.
- New admin delivery routes/pages - create identities, attach memberships, reset credentials, and manage tenant access.
- `openspec/changes/multi-provider-canonical-catalog/exploration.md` - depends on this foundation for admin-only catalog mutations.

### Approaches
1. **Build catalog administration first** - add mutations without identity controls.
   - Pros: starts catalog work immediately.
   - Cons: unsafe access and a cross-cutting retrofit.
   - Effort: Medium.

2. **Use a hosted identity provider** - delegate login and sessions externally.
   - Pros: mature auth features.
   - Cons: adds an unnecessary provider before SSO is required.
   - Effort: Medium.

3. **Build a minimal Sentinel-owned identity foundation** - email/password identity, MongoDB-backed opaque sessions, organization memberships, admin/operator roles, and admin-managed users.
   - Pros: matches current access rules and keeps tenant authorization explicit.
   - Cons: requires careful password, cookie, session, and lockout design.
   - Effort: High.

### Recommendation
Use approach 3. An idempotent server-only seed creates the initial organization and administrator. Login creates an opaque server-side session stored in MongoDB and sends its token through a Secure, HttpOnly cookie.

Email is the globally unique user identity. Administrators directly create a new identity with first name, last name, email, organization membership, and role. New identity creation generates a readable temporary password such as `Word-Word-4827`, which the administrator may edit. The user MUST change it on first login. There is no invitation lifecycle.

When an email already exists, the administrator adds or reactivates only that tenant membership without changing the user's password. Initially, forgotten passwords are reset by an authorized administrator using a new temporary password, forcing another password change and revoking existing sessions.

Organization administrators deactivate memberships, not global identities. Deactivation MUST revoke sessions for that tenant while preserving active memberships and access in other tenants. The last active administrator membership of a tenant MUST NOT be deactivated or demoted.

Roles are tenant-scoped, never global. A user with one membership enters that tenant automatically. A user with multiple memberships MUST explicitly select the active tenant and may switch it later. Every authorized request validates the selected tenant against an active membership.

Operators access read-only Live; only administrators mutate the catalog. Public registration, invitations, self-service password recovery, SSO, and convoy permissions remain out of scope. This change MUST precede catalog administration implementation.

### Risks
- Session tokens, password hashes, temporary passwords, and cookies require strict security handling.
- Active-tenant validation failures could cross tenant boundaries.
- Global identity operations must not let one tenant administrator alter access in another tenant.
- Concurrent membership changes must preserve at least one active administrator per tenant.
- The bootstrap seed must be idempotent, server-only, and never log credentials.

### Ready for Proposal
Yes - the agreed identity, session, user-management, tenant-selection, and authorization behavior is sufficient for proposal.
