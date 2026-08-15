# Apply Progress: repair-global-provider-catalog

## Scope

PR 3 only: tasks 3.1, 3.2, and 3.3 on `catalog-v2-03-mongodb`, targeting `catalog-v2-02-domain`.

## Completed Tasks

- [x] 1.1-1.3 PR 1 platform authorization completed on `catalog-v2-01-platform-auth`.
- [x] 2.1 RED: tests cover global identity, immutable placement, provider contributions, fleet memberships, tenant grants, and global reviews.
- [x] 2.2 GREEN: created provider-neutral `domain/catalog-global/*` contracts and `application/catalog-global/ports.ts`.
- [x] 2.3 REFACTOR: contracts exclude Company, tenant ownership, provider-specific branches, Next.js, MongoDB, and concrete provider dependencies.
- [x] 3.1 RED: added Mongo integration tests for strict validators, unique indexes, concurrent writes, and atomic updates.
- [x] 3.2 GREEN: created V2 Mongo documents, validators, repositories, and migrations with atomic upsert persistence.
- [x] 3.3 REFACTOR: rollback rejects any non-empty V2 collection and drops only empty V2 collections.

## TDD Cycle Evidence

| Task | Test File | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| 3.1 | `integrations/persistence/mongodb/catalog-global-mongodb.test.ts` | Test-first import failure: `migrateGlobalCatalogDatabase is not a function` | 5 tests passed after validators, indexes, and persistence were implemented | 7 tests passed, including provider registry/listing and independent memberships | Assertions verify real Mongo validator/index/race behavior |
| 3.2 | `integrations/persistence/mongodb/catalog-global-mongodb.test.ts` | Tests referenced missing V2 migration/repository exports | Four requested Mongo files implemented; focused suite passed | Global vehicles, contributions, providers, connections, and memberships exercised | Repository writes use single-operation atomic upserts and preserve domain boundaries |
| 3.3 | `integrations/persistence/mongodb/catalog-global-mongodb.test.ts` | Rollback test referenced missing migration rollback | Empty database rollback passed and populated rollback rejected | Both empty and populated V2 paths verified | Rollback enumerates only declared V2 collections and refuses destructive rollback |

## Verification Evidence

- Focused tests: passed, 7 tests.
- Lint: passed with one pre-existing warning in `coverage/block-navigation.js`.
- Typecheck: passed.
- `git diff --check`: passed.
- Full suite: passed with `npm test` after separating parallel non-Mongo tests from serial Mongo tests; 111 files and 930 tests passed.

## Boundaries

No matching, Cybermapa, Howen, registry, policies, synchronization, cron, functional migration, grants/live compatibility, or PR4+ work was implemented.

## Review

Independent clean-context PR3 review required before merge-readiness verdict.