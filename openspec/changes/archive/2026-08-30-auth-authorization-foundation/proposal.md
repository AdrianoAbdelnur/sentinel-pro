# Proposal: Authentication and Authorization Foundation

## Intent

Establish Sentinel identity and tenant authorization before catalog administration. Today `/live` is public.

## Scope

### In Scope
- Email/password login with revocable opaque MongoDB sessions, a Secure, HttpOnly cookie, and sliding expiry after 12 inactive hours without a fixed lifetime.
- Email is unique across memberships.
- Tenant-scoped `admin`/`operator` memberships with active-tenant validation and switching.
- Idempotent seed for the initial organization and administrator.
- Admin onboarding with identity, tenant, and role. New identities receive an editable readable temporary password; existing identities only receive or reactivate membership.
- Mandatory password change on first login.
- Permanent passwords require 8+ characters and no mandatory special characters.
- Three consecutive failed logins block access for 15 minutes.
- Admin password reset with global session revocation, only when the user belongs exclusively to that tenant.
- Tenant membership deactivation revokes only that tenant's sessions; others remain active.
- Protect the last active tenant administrator.

### Out of Scope
- Registration, invitations, self-service or multi-tenant recovery, and SSO.
- Convoy permissions and catalog implementation.

## Capabilities

### New Capabilities
- `identity-authentication`: Global identity, login, password lifecycle, sessions, and seed.
- `tenant-authorization`: Organization memberships, active-tenant selection, tenant switching, and tenant-scoped role enforcement.
- `admin-user-management`: Onboarding, membership lifecycle, eligible resets, and last-admin protection.

### Modified Capabilities
- None.

## Approach

Use `domain/identity`, `application/identity`, MongoDB adapters in `integrations/persistence`, and Next.js delivery in `app`. Store only hashed passwords and session tokens. Protected requests validate active tenant membership.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `domain/identity` | New | Global identity and tenant membership rules |
| `application/identity` | New | Auth and administration use cases |
| `integrations/persistence` | New | MongoDB repositories and sessions |
| `app` | Modified | Auth, administration, and protection delivery |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cross-tenant access | Medium | Validate active membership on every protected request |
| Credential exposure | Medium | Hash secrets, use secure cookies, revoke sessions, never log credentials |
| Tenant loses all administrators | Low | Enforce the invariant atomically |

## Rollback Plan

Remove auth enforcement and wiring, then restore public routes. Back up before dropping auth collections.

## Dependencies

- MongoDB connectivity and server-only runtime secrets.

## Success Criteria

- [ ] Authentication, forced password change, reset, and tenant switching follow the agreed lifecycle.
- [ ] Authorization remains tenant-scoped and administration is restricted.
- [ ] Existing identities join another tenant without changing their password.
- [ ] Deactivation preserves other tenants and the last active tenant administrator.
- [ ] Catalog administration remains blocked until this foundation is active.
