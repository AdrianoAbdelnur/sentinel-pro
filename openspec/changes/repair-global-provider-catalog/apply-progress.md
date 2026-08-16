# Apply Progress: Repair Global Provider Catalog

## Scope

PR 8 and PR9 evidence: tasks 8.1-8.3 on `catalog-v2-08-sync`, followed by
tasks 9.1-9.3 on `catalog-v2-09-grants-live`.

## Previously Completed

PRs 1-8 were already integrated before the PR9 section. The PR9 section does
not alter earlier task completion markers or implement PR10+.

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

No migration, real API credentials, or PR10+ work was implemented. Existing
tenant-scoped synchronization routes remain unchanged; new V2 delivery adapters
are isolated under `app/api/**/catalog/v2`. The PR8 boundaries above remain
unchanged; PR9 adds only the grants/Live compatibility files documented below.

## Validation Evidence

- RED: focused Vitest run failed before implementation because the use case
  module was missing.
- GREEN: PR8 focused Vitest run passed; typecheck passed.
- REFACTOR: documentation and environment changes applied after GREEN.
- PR8 mandatory full validation passed in three consecutive exact `npm test`
  runs; lint, typecheck, focused tests, MongoDB tests, and diff-check passed.
  The final independent clean-context review passed with no confirmed PR8 issue.
## PR9 — Grants/Live

### 9.1 RED

- Added failing tests for tenant assignment-only disclosure, independent capability source resolution, stable `LiveState` output, and compatibility rollback behavior; the final focused count is 9 tests.
- Confirmed RED with `npx vitest run application/live/project-global-catalog-live.test.ts application/live/live-compatibility-loader.test.ts`: both suites failed because the implementation modules were absent.

### 9.2 GREEN

- Added `project-global-catalog-live.ts` to project global vehicles through tenant grants while preserving the existing Live contracts.
- Added `live-compatibility-loader.ts` with legacy-by-default and explicit global mode selection.
- Added focused tests; 9 tests pass and `npm run typecheck` passes.

### 9.3 REFACTOR

- Reused the global capability default policy, kept source resolution provider-neutral, and made malformed or absent rollout values resolve to legacy.
- Updated `.env.example` with the safe `SENTINEL_LIVE_CATALOG_MODE=legacy` default and marked only PR9 tasks complete.

### Validation status

- Focused PR9 tests: 8 passed.
- Typecheck: passed.
- Lint: passed with the pre-existing `coverage/block-navigation.js` warning.
- `git diff --check`: passed with expected LF/CRLF warnings.
- One complete `npm test` execution passed after the user explicitly waived the three-consecutive-run gate for this iteration: 113 files/894 tests, system 1/1, and MongoDB 5 files/78 tests.
- Final review found and the follow-up fix isolated Live snapshots by `connectionId` plus `externalId`, preventing same-provider connection collisions; a regression test now covers reused external IDs.
