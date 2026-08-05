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
- [x] 2.1 **RED:** Add MongoDB integration tests under `integrations/persistence/mongodb/*.test.ts` for validators, indexes, atomic activity touch, scoped revocation, idempotent seed, and concurrent last-admin protection.
- [x] 2.2 **GREEN:** Add `mongodb` and Argon2 dependencies; implement client, migrations, repositories, transactions, and seed in `integrations/persistence/mongodb/*`.
- [x] 2.3 **RED:** Add adapter tests in `integrations/security/*.test.ts` for Argon2id, 256-bit opaque tokens, SHA-256 token hashes, and readable temporary passwords.
- [x] 2.4 **GREEN/REFACTOR:** Implement security adapters, centralize parameters, document server-only variables in `.env.example`, and pass adapter/integration tests.
## Phase 3: Authentication Delivery — PR 3
- [x] 3.1 **RED:** Add Route Handler tests in `app/api/auth/**/*.test.ts` for indistinguishable failures, lockout, Origin checks, cookie attributes, forced change, logout, and tenant switching.
- [x] 3.2 **GREEN:** Implement auth handlers plus composition in `app/api/auth/*`; add `app/login/*`, `app/change-password/*`, and `app/select-organization/*` with focused UI tests.
- [x] 3.3 **REFACTOR:** Share validation/error mapping without moving business rules into routes; run auth tests.
## Phase 4: Administration and Protection — PR 4
- [ ] 4.1 **RED:** Add tests for admin create/reactivate/reset/deactivate flows, operator rejection, scoped revocation, and last-admin rejection in `app/api/admin/users/*` and `app/admin/users/*`.
- [ ] 4.2 **GREEN:** Implement admin handlers/pages, `proxy.ts`, and authorization wiring for `app/page.tsx` and `app/live/page.tsx`.
- [ ] 4.3 **REFACTOR:** Keep authorization in application services, update relevant architecture docs, then run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

## Phase 3 TDD Evidence

| Task | RED | GREEN | REFACTOR | Evidence |
|---|---|---|---|---|
| 3.1 | Added no-active-membership contract test first; focused suite failed 18/19 because the route did not revoke the newly created session | 19 focused tests passed after explicit `403`, session revocation, and cookie expiry mapping | Exhaustive `LoginResult` switch with a `never` guard and shared cookie helpers remove the implicit fallback and duplicated cookie settings | `app/api/auth/auth.test.ts`, `app/api/auth/authenticated-routes.test.ts` |
| 3.2 | Safety net: 4/4 focused UI tests passed. Added missing `no_active_membership`, invalid-password, and forbidden error/no-navigation UI tests; RED was 4/8 because successful prior tests leaked `push` calls, while exact errors already rendered. | Added `beforeEach(() => push.mockClear())`; 8/8 focused UI tests passed with error text and no navigation verified. | Triangulated password `400` and forbidden `403` response handling; kept `AuthForm` and production code unchanged because no runtime defect was demonstrated. | `app/login/login-form.test.tsx`, `app/change-password/auth-forms.test.tsx` |
| 3.3 | RED captured in 3.1: 18/19 focused tests, failed only because `no_active_membership` fell through without logout | 19 focused tests passed after route extraction | `delivery.ts` owns cookie configuration/expiry while `login/route.ts` exhaustively maps every application result | `npm test -- app/api/auth/auth.test.ts app/api/auth/authenticated-routes.test.ts app/login/login-form.test.tsx app/change-password/auth-forms.test.tsx` |
