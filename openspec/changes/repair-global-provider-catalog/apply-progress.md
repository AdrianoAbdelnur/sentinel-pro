# Apply Progress: Repair Global Provider Catalog

## Scope

PR 8 only: tasks 8.1, 8.2, and 8.3 on `catalog-v2-08-sync`, targeting
`catalog-v2-07-policies` at `7af1534`.

## Previously Completed

PRs 1-7 were already integrated in the base branch. PR8 does not alter their
task completion markers or implement PR9+.

## Completed Tasks

- [x] 8.1 RED: added focused tests for leases, checkpoint resume, retry
  classification, incomplete snapshots, due connections, internal
  authorization, manual platform authorization, and status projection.
- [x] 8.2 GREEN: implemented the provider-neutral global synchronization use
  case, V2 Mongo run/lease repositories, global source adapter boundary, manual
  SUPER ADMIN route, authenticated internal trigger, scheduler due enumeration,
  and V2 status route. Provider adapters preserve typed failures and parsed
  snapshot evidence; Howen malformed login/roster responses are non-retryable.
- [x] 8.3 REFACTOR: updated `.env.example` with the V2 scheduler rollout switch
  and documented synchronization boundaries, leases, checkpoints, retries,
  snapshot integrity, authorization, status, and rollback.

## TDD Cycle Evidence

| Task | Test File | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| 8.1 | `application/catalog-global/synchronize-global-connection.test.ts`, `app/api/internal/catalog/v2/synchronize.test.ts`, `app/api/admin/catalog/v2/connections/status.test.ts` | Imports failed because the synchronization use case and V2 delivery contracts did not exist | Nine focused scenarios pass, including held leases, checkpoint resume, incomplete snapshots, retry classification, due filtering, internal auth, manual platform auth, and status projection | Contracts use internal ports and explicit outcome/status projections |
| 8.2 | `application/catalog-global/synchronize-global-connection.test.ts`, `app/api/internal/catalog/v2/synchronize.test.ts`, `app/api/admin/catalog/v2/connections/status.test.ts` | Route/use-case contract was absent | Global use case, V2 persistence, manual/internal delivery, scheduler due enumeration, and status wiring compile and focused tests pass | Provider construction is isolated in `integrations/catalog/global-sync-source-adapters.ts` |
| 8.3 | `application/catalog-global/synchronize-global-connection.test.ts` | Documentation and rollout switch were absent | Environment and synchronization documentation are updated | Scheduler rollout is disabled by default without changing manual authorization |

## Boundaries

No grants, Live compatibility, migration, real API credentials, or PR9+ work was
implemented. Existing tenant-scoped synchronization routes remain unchanged;
new V2 delivery adapters are isolated under `app/api/**/catalog/v2`.

## Validation Evidence

- RED: focused Vitest run failed before implementation because the use case
  module was missing.
- GREEN: focused Vitest run passed with 9 tests; typecheck passed.
- REFACTOR: documentation and environment changes applied after GREEN.
- Mandatory full validation passed in three consecutive exact `npm test` runs;
  lint, typecheck, focused tests, MongoDB tests, and diff-check passed. The
  final independent clean-context review passed with no confirmed PR8 issue.
