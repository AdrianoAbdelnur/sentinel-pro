# Tasks: Authentication and Authorization Foundation

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,400–2,000 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 domain/application → PR 2 Mongo/security → PR 3 auth delivery → PR 4 admin UI/protection |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Tested identity rules and use cases | PR 1 | Framework-free base |
| 2 | Tested MongoDB and security adapters | PR 2 | Depends on PR 1 |
| 3 | Login, session, tenant selection, password change | PR 3 | Depends on PR 2 |
| 4 | Admin workflows and route protection | PR 4 | Depends on PR 3 |

## Phase 1: Identity Core — PR 1

- [x] 1.1 **RED:** Add failing domain tests in `domain/identity/*.test.ts` for email/password rules, lockout, membership roles, tenant selection, and last-admin outcomes.
- [x] 1.2 **GREEN:** Create minimal entities, policies, and result types in `domain/identity/*` that pass 1.1.
- [x] 1.3 **RED:** Add application tests in `application/identity/*.test.ts` using in-memory ports and a controlled clock for every spec scenario.
- [x] 1.4 **GREEN:** Create `application/identity/ports.ts`, authorization contracts, and login, password, tenant, session, seed, and admin use cases.
- [x] 1.5 **REFACTOR:** Remove duplication, export the slice through `domain/identity/index.ts` and `application/identity/index.ts`, then run unit tests.

## Phase 2: Persistence and Security — PR 2

- [ ] 2.1 **RED:** Add MongoDB integration tests under `integrations/persistence/mongodb/*.test.ts` for validators, indexes, atomic activity touch, scoped revocation, idempotent seed, and concurrent last-admin protection.
- [ ] 2.2 **GREEN:** Add `mongodb` and Argon2 dependencies; implement client, migrations, repositories, transactions, and seed in `integrations/persistence/mongodb/*`.
- [ ] 2.3 **RED:** Add adapter tests in `integrations/security/*.test.ts` for Argon2id, 256-bit opaque tokens, SHA-256 token hashes, and readable temporary passwords.
- [ ] 2.4 **GREEN/REFACTOR:** Implement security adapters, centralize parameters, document server-only variables in `.env.example`, and pass adapter/integration tests.

## Phase 3: Authentication Delivery — PR 3

- [ ] 3.1 **RED:** Add Route Handler tests in `app/api/auth/**/*.test.ts` for indistinguishable failures, lockout, Origin checks, cookie attributes, forced change, logout, and tenant switching.
- [ ] 3.2 **GREEN:** Implement auth handlers plus composition in `app/api/auth/*`; add `app/login/*`, `app/change-password/*`, and `app/select-organization/*` with focused UI tests.
- [ ] 3.3 **REFACTOR:** Share validation/error mapping without moving business rules into routes; run auth tests.

## Phase 4: Administration and Protection — PR 4

- [ ] 4.1 **RED:** Add tests for admin create/reactivate/reset/deactivate flows, operator rejection, scoped revocation, and last-admin rejection in `app/api/admin/users/*` and `app/admin/users/*`.
- [ ] 4.2 **GREEN:** Implement admin handlers/pages, `proxy.ts`, and authorization wiring for `app/page.tsx` and `app/live/page.tsx`.
- [ ] 4.3 **REFACTOR:** Keep authorization in application services, update relevant architecture docs, then run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
