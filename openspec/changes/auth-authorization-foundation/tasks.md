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
- [x] 4.1 **RED:** Add tests for the remaining admin delivery, UI, protected-page, and proxy scenarios.
- [x] 4.2 **GREEN:** Correct protected-page authorization and complete the delivery-driven admin UI.
- [x] 4.3 **REFACTOR:** Remove delivery/UI duplication, update documentation, and complete validation.

## Phase 3 TDD Evidence

| Task | RED | GREEN | REFACTOR | Evidence |
|---|---|---|---|---|
| 3.1 | Added no-active-membership contract test first; focused suite failed 18/19 because the route did not revoke the newly created session | 19 focused tests passed after explicit `403`, session revocation, and cookie expiry mapping | Exhaustive `LoginResult` switch with a `never` guard and shared cookie helpers remove the implicit fallback and duplicated cookie settings | `app/api/auth/auth.test.ts`, `app/api/auth/authenticated-routes.test.ts` |
| 3.2 | Safety net: 4/4 focused UI tests passed. Added missing `no_active_membership`, invalid-password, and forbidden error/no-navigation UI tests; RED was 4/8 because successful prior tests leaked `push` calls, while exact errors already rendered. | Added `beforeEach(() => push.mockClear())`; 8/8 focused UI tests passed with error text and no navigation verified. | Triangulated password `400` and forbidden `403` response handling; kept `AuthForm` and production code unchanged because no runtime defect was demonstrated. | `app/login/login-form.test.tsx`, `app/change-password/auth-forms.test.tsx` |
| 3.3 | RED captured in 3.1: 18/19 focused tests, failed only because `no_active_membership` fell through without logout | 19 focused tests passed after route extraction | `delivery.ts` owns cookie configuration/expiry while `login/route.ts` exhaustively maps every application result | `npm test -- app/api/auth/auth.test.ts app/api/auth/authenticated-routes.test.ts app/login/login-form.test.tsx app/change-password/auth-forms.test.tsx` |

## Phase 4 TDD Evidence

| Task | RED | GREEN | TRIANGULATION / Safety Net | REFACTOR | Evidence |
|---|---|---|---|---|---|
| 4.1 | Added reactivation application/UI/handler behavior first; the focused RED run failed 3/53 because neither the UI action nor application use case existed. | Added provider-agnostic `reactivateMembership`, PATCH translation, and delivery-driven UI call; focused app/UI/handler suite passed 61/61. | Baseline safety net: 16/16 focused Phase 4 tests passed before changes. Triangulated reactivation success and HTTP failure, plus invalid JSON/role/user ID and all results. | Extracted reactivation success messaging into the existing generic request executor; no administrative rule moved upward. | `application/identity/identity.test.ts`, `app/admin/users/admin-user-form.test.tsx`, `app/api/admin/users/admin-users.test.ts` |
| 4.2 | Added isolated operator and revoked-session page scenarios and fresh `{ token, requiredRole: "admin" }` assertions. | 26/26 focused Phase 4 tests, 23/23 Phase 3 contracts, and 435/435 full tests pass. | Tests prove fresh authorization per create, reset, deactivate, reactivate, and role-change handler; application proof proves reactivation preserves password fields. | Kept `proxy.ts` optimistic and Server Components/handlers on the application authorization service. | `app/admin/users/page.test.tsx`, `app/authorization.test.ts`, `app/api/admin/users/admin-users.test.ts`, `proxy.test.ts` |
| 4.3 | Captured malformed encoding and extra EOF lines as failing hygiene requirements. The metadata contract test then failed 5/6 because the source had an ASCII question-mark separator instead of U+00B7. | Wrote the U+00B7 literal as UTF-8; focused metadata/UI test passed 6/6 and focused encoding scan is clean. | Full safety net: `npm test` and `npm run test:coverage` both pass 435/435; typecheck, lint, build, and diff checks pass. | Documented the PATCH reactivation delivery contract and rewrote Phase 4 evidence with actual file/count attribution. | `app/live/page.tsx`, `app/live/page.test.tsx`, `openspec/changes/auth-authorization-foundation/tasks.md`, `docs/architecture/07-identity-delivery-protection.md`, `app/admin/users/admin-user-form.tsx`, `app/api/admin/users/delivery.ts`, `app/authorization.ts`, `app/require-page-authorization.ts` |

## Phase 4 Final Blocker TDD Evidence

| Task | RED | GREEN | TRIANGULATION / Safety Net | REFACTOR | Evidence |
|---|---|---|---|---|---|
| 4.1 | Added persisted-state reactivation tests. The focused run was 71/76: active last-admin reactivation incorrectly returned `reactivated`, active transition with another admin returned `reactivated`, and handler translation did not surface the guard. | `reactivateMembership` now reads the persisted membership; inactive memberships reactivate directly and active memberships call `changeRoleIfNotLastAdmin`. `PATCH` delegates every valid membership update to that application behavior rather than branching on client status. | 84/84 focused Phase 4 tests and 23/23 Phase 3 contracts pass. Tests cover zero writes for `last_admin`, inactive reactivation, active guarded transition, invalid status, fresh authorization, and the complete delivery request. | Shared the state decision in the application use case; the handler remains HTTP validation/translation only. | `application/identity/identity.test.ts` (50 tests), `app/api/admin/users/admin-users.test.ts` (14), `app/admin/users/admin-user-form.test.tsx` (6), `app/admin/users/page.test.tsx` (3), `app/authorization.test.ts` (3), `proxy.test.ts` (2), `app/live/page.test.tsx` (6) |
| 4.2 | Added a controlled-promise UI test before changing production behavior. | Existing shared request executor keeps the reactivation button and all controls disabled while pending, then shows the delivery result after resolution. | The UI test asserts Reactivate's loading label, disabled controls, completion status, endpoint, method, headers, and body. | No business logic was added to UI. | `app/admin/users/admin-user-form.test.tsx` |
| 4.3 | Replaced the duplicate Live warning assertion with independent PRAXSYS/HOWEN assertions and pinned the U+00B7 metadata contract. | Source title uses U+00B7; required files were normalized to exactly one final newline. | Direct UTF-8/exact-EOF scan includes untracked files. Final validation: focused Phase 4 84/84, Phase 3 contracts 23/23, full suite and coverage 439/439, typecheck, lint (one generated-coverage warning only), build, diff, and direct UTF-8/EOF scan pass. | Delivery documentation now describes persisted-state dispatch. | `app/live/page.tsx`, `app/live/page.test.tsx`, `app/admin/users/page.test.tsx`, `app/authorization.test.ts`, `app/api/admin/users/delivery.ts`, `app/authorization.ts`, `app/require-page-authorization.ts`, `docs/architecture/07-identity-delivery-protection.md` |
