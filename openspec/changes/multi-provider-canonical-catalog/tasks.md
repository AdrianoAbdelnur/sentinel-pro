# Tasks: Multi-provider canonical catalog

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 2,800–3,600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 8 PRs |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| PR / goal | Proof / rollback |
|---|---|
| 1 Canonical/manual core | Unit / revert |
| 2 Matching/review core | State / revert |
| 3 Precedence contracts | Pure / revert |
| 4 Canonical/source persistence | Replica / additive |
| 5 Review/policy persistence | Races / additive |
| 6 Howen import | Import / disable |
| 7 Admin delivery/UI | Route/UI / remove |
| 8 Live seam/docs | Gates / fallback |

## Phase 1: Catalog Core

- [ ] 1.1 **RED:** Test `canonical-vehicle-catalog` native/provider-only creation, admin access, tenant isolation, and stable names/placement.
- [ ] 1.2 **GREEN→REFACTOR:** Add entities, contracts, ports, and manual use cases; derive scope from `AuthorizationContext`, inject dependencies, and export focused modules.
- [ ] 1.3 **RED:** Test `external-identity-linking` scope, deterministic links, ambiguity, admin resolution, and prohibited automatic merge/rename/move.
- [ ] 1.4 **GREEN→REFACTOR:** Implement matching/review states and use cases with explicit discriminated outcomes.
- [ ] 1.5 **RED:** Test every `capability-source-precedence` scenario: independent defaults, provider-only source, hierarchy, ordered fallback, unavailable, and Cybermapa deferral.
- [ ] 1.6 **GREEN→REFACTOR:** Implement pure policy resolution and provider-neutral eligibility ports.

## Phase 2: MongoDB Persistence

- [ ] 2.1 **RED:** Test seven strict validators, required indexes, and no unbounded arrays on a replica set.
- [ ] 2.2 **GREEN→REFACTOR:** Add versioned documents, repositories, indexes, mappings, exports, and idempotent migrations.
- [ ] 2.3 **RED:** Reproduce concurrent identity, review, policy, and import races; assert rollback, idempotency, and tenant isolation.
- [ ] 2.4 **GREEN→REFACTOR:** Add bounded transactions and duplicate-key reread/retry without roster-wide atomicity assumptions.

## Phase 3: Howen Import

- [ ] 3.1 **RED:** Test `howen-catalog-import` verified field mapping, invalid-record isolation, fetch failure, linked-new/existing, pending review, and repeated/concurrent import.
- [ ] 3.2 **GREEN→REFACTOR:** Add provider-neutral candidates over the existing Howen client and per-candidate transactional import without invented fields or canonical overwrites.

## Phase 4: Admin Delivery

- [ ] 4.1 **RED:** Test same-origin admin authorization, invalid input, tenant denial, creation, import, review, and page/form states.
- [ ] 4.2 **GREEN→REFACTOR:** Add composition, thin routes, and admin UI that translate use-case outcomes without provider business rules.

## Phase 5: Live Seam and Release Gate

- [ ] 5.1 **RED:** Test modified `live-core-contracts`: canonical identity, external source links, and independent multi-source capabilities while the Howen fallback remains.
- [ ] 5.2 **GREEN→REFACTOR:** Add projection types/seam without UI provider branches or premature runtime cutover.
- [ ] 5.3 Update architecture docs `03` and `05` with the seam, Cybermapa deferral, and rollback.
- [ ] 5.4 Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:coverage`, and `npm run build`; verify 23 scenarios and identity-safe rollback.
