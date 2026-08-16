# Tasks: Repair Global Provider Catalog

## Review Workload Forecast

Estimated changed lines: 2,500-4,000
Delivery strategy: auto-chain
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Tracker `feature/global-provider-catalog`: draft/no-merge, base `main`. Each PR targets its predecessor and contains only its slice.

### Suggested Work Units

| PR | Branch | Base |
|---|---|---|
| 1 | `catalog-v2-01-platform-auth` | tracker |
| 2 | `catalog-v2-02-domain` | PR 1 |
| 3 | `catalog-v2-03-mongodb` | PR 2 |
| 4 | `catalog-v2-04-matcher` | PR 3 |
| 5 | `catalog-v2-05-cybermapa` | PR 4 |
| 6 | `catalog-v2-06-howen` | PR 5 |
| 7 | `catalog-v2-07-policy-registry` | PR 6 |
| 8 | `catalog-v2-08-sync` | PR 7 |
| 9 | `catalog-v2-09-grants-live` | PR 8 |
| 10 | `catalog-v2-10-migration` | PR 9 |

Gate every PR with lint, typecheck, focused tests, and full tests before starting its successor.

## 1. Platform Authorization

- [x] 1.1 RED: test platform SUPER ADMIN allowed and tenant admin denied.
- [x] 1.2 GREEN: add `authorizePlatform()` through `domain/identity/*`, `application/identity/*`, and admin-import routes.
- [x] 1.3 REFACTOR: remove tenant-membership coupling.

## 2. Global Domain

- [x] 2.1 RED: test global identity, immutable placement, contributions, memberships, grants, and reviews.
- [x] 2.2 GREEN: create `domain/catalog-global/*` and `application/catalog-global/ports.ts`.
- [x] 2.3 REFACTOR: enforce provider-neutral contracts.

## 3. V2 Persistence

- [x] 3.1 RED: test validators, unique indexes, races, and atomic writes.
- [x] 3.2 GREEN: create `integrations/persistence/mongodb/catalog-global-{documents,validators,repositories,migrations}.ts`.
- [x] 3.3 REFACTOR: prove empty-V2-only rollback.

## 4. Matching

- [x] 4.1 RED: test external-ID reuse, exact plate, unsafe review, and concurrency.
- [x] 4.2 GREEN: create `application/catalog-global/match-and-apply-provider-candidate.ts`.
- [x] 4.3 REFACTOR: exclude tenant, Company, and fleet identity.

## 5. Cybermapa

- [x] 5.1 RED: test placement and absent fleet evidence in `integrations/cybermapa/map-cybermapa-catalog.test.ts`.
- [x] 5.2 GREEN: seed V2 GPS, alerts, and placement.
- [x] 5.3 REFACTOR: prove idempotency.

## 6. Howen

- [ ] 6.1 RED: test exact match, unchanged placement, memberships, and Howen-only creation.
- [ ] 6.2 GREEN: update `integrations/howen/*` for V2 video contributions.
- [ ] 6.3 REFACTOR: prove shared plates never duplicate.

## 7. Policies/Registry

- [ ] 7.1 RED: test defaults, direct-GPS override, unknown adapter, and registration.
- [ ] 7.2 GREEN: add policy use case and registry-backed `app/api/catalog/connection-sources.ts`.
- [ ] 7.3 REFACTOR: confine provider branches to integrations.

## 8. Synchronization

- [ ] 8.1 RED: test leases, checkpoints, retries, incomplete snapshots, due connections, auth, and status.
- [ ] 8.2 GREEN: create `synchronize-global-connection.ts`; wire manual/internal triggers and scheduler.
- [ ] 8.3 REFACTOR: update `.env.example` and synchronization docs.

## 9. Grants/Live

- [ ] 9.1 RED: test disclosure, policies, legacy parity, and stable Live contracts.
- [ ] 9.2 GREEN: add grants and compatibility loader beside `application/live/project-canonical-live.ts`.
- [ ] 9.3 REFACTOR: prove default/rollback switches.

## 10. Migration

- [ ] 10.1 RED: test dry-run, conflicts, absent approval, apply, and parity gates.
- [ ] 10.2 GREEN: create `migrate-global-catalog.ts`, Mongo CLI, approval token, and read switch.
- [ ] 10.3 REFACTOR: run build/dry-run; forbid legacy writes.
