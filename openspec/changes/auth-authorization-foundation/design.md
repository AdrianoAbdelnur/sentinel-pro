# Design: Authentication and Authorization Foundation

## Technical Approach

Add an identity slice with framework-free rules in `domain/identity`, use cases and ports in `application/identity`, native MongoDB adapters in `integrations/persistence/mongodb`, and Next.js 16 delivery in `app`. Authentication uses a random opaque token; only its SHA-256 hash is stored. Every protected operation resolves a fresh authorization context from the database rather than trusting cookie claims.

## Architecture Decisions

| Decision | Choice | Alternatives / rationale |
|---|---|---|
| Session model | MongoDB-backed opaque sessions with 256-bit tokens | Avoids browser-visible claims and supports immediate revocation. JWT access tokens were rejected because membership and role changes must take effect immediately. |
| Password hashing | Argon2id through the Node.js runtime | Better password-hashing default than general hashes. Parameters live in one adapter and can be upgraded without changing use cases. |
| Tenant relationship | Separate `organization_memberships` documents | User-to-organization is many-to-many, independently managed, and must not become an unbounded embedded array. |
| Password reset ownership | An organization admin may reset only an identity whose sole membership is in that organization | A reset changes a global credential. Shared multi-tenant identities are rejected until a separate recovery flow is designed. |
| Session activity | Atomically validate and move `lastActivityAt`/`expiresAt` to `now + 12h` | The database is authoritative because MongoDB TTL deletion is asynchronous. A protected-route `proxy.ts` only renews the cookie expiry; it never authorizes or queries MongoDB. |
| Last-admin invariant | Transactionally touch an organization authorization version, recount active admins, then mutate membership | Counting without a shared write lock allows two concurrent demotions to remove both admins. The organization write forces a conflict and full transaction retry. |
| Delivery | Route Handlers set/delete cookies; Server Components call the same authorization service | Next.js 16 permits cookie writes in Route Handlers/Server Functions, not Server Component rendering. Proxy remains an optimistic redirect/refresh layer only. |

## Data Flow

```text
Browser -> Route Handler -> identity use case -> ports -> MongoDB
   |              |
   |              +-> Set-Cookie: __Host-sentinel_session
   +-> protected request -> authorization service -> session + user + membership
```

Login normalizes email, performs constant-path password verification (including a dummy hash for missing identities), applies lockout atomically, creates the hashed session, and returns only the raw token to the cookie writer. Temporary credentials permit only password change. One membership selects its tenant; several require explicit selection. A reset transaction verifies the target has exactly one membership in the admin's organization, stores a temporary hash, requires password change, and revokes every session; shared identities are rejected. Logout/revocation updates MongoDB before deleting the cookie. Cookie-authenticated mutations require a same-origin request.

## Persistence Model

- `users`: identity/profile, normalized email, Argon2id hash, password-change flag, status, failure count, blocked-until, timestamps, schema version. Unique `{ emailNormalized: 1 }`.
- `organizations`: name, status, `authorizationVersion`, timestamps. Seed identity uses a stable key with a unique index.
- `organization_memberships`: `organizationId`, `userId`, role, status, timestamps. Unique `{ organizationId: 1, userId: 1 }`; lookup `{ organizationId: 1, status: 1, role: 1 }`.
- `sessions`: token hash, `userId`, nullable active organization, last activity, expiry, revocation, timestamps. Unique `{ tokenHash: 1 }`; TTL `{ expiresAt: 1 }`; revocation `{ userId: 1, activeOrganizationId: 1, revokedAt: 1 }`.

Collections use strict/error JSON Schema validators. IDs remain references; no password, session token, or membership arrays are embedded.

## Interfaces / Contracts

`application/identity/ports.ts` defines `UserRepository`, `OrganizationRepository`, `MembershipRepository`, `SessionRepository`, `PasswordHasher`, `TokenGenerator`, `Clock`, and `TransactionRunner`. Use cases return explicit result unions, including `invalid_credentials`, `temporarily_blocked`, `password_change_required`, `tenant_selection_required`, `forbidden`, `shared_identity_reset_forbidden`, and `last_admin`.

`AuthorizationContext` contains `userId`, `organizationId`, and tenant-scoped `role`. It is the only identity contract passed into catalog/live use cases.

## File Changes

| Path | Action |
|---|---|
| `domain/identity/*` | Create entities, policies, and invariants |
| `application/identity/*` | Create ports, results, and use cases |
| `integrations/persistence/mongodb/*` | Create client, validators, indexes, repositories, transactions, seed |
| `integrations/security/*` | Create Argon2id, token, and temporary-password adapters |
| `app/api/auth/*`, `app/api/admin/users/*` | Create delivery adapters |
| `app/login/*`, `app/change-password/*`, `app/select-organization/*`, `app/admin/users/*` | Create pages/components |
| `app/live/page.tsx`, `app/page.tsx`, `proxy.ts` | Modify protection and navigation |
| `package.json`, `.env.example` | Add dependencies and server-only configuration contract |

## Testing Strategy

TDD starts with domain/unit tests for password policy, lockout, tenant selection, authorization, reset eligibility, and last-admin outcomes. Application tests use in-memory ports and a controlled clock. MongoDB integration tests prove unique indexes, TTL metadata, reset-wide revocation, scoped membership revocation, atomic session touch, idempotent seed, and concurrent last-admin protection. Route tests verify indistinguishable failures, status codes, Origin checks, and cookie attributes. UI tests cover login, forced change, tenant selection, and admin workflows. No E2E runner currently exists.

## Migration / Rollout

Create validated empty collections and indexes, run the idempotent seed, then enable route protection. Rollback removes enforcement first; collections remain for audit-safe recovery.

## Open Questions

None.
