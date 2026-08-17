# Unit 1 Apply Progress

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1 | Added domain tests; initial run failed because group factory was absent | Domain suite passed: 13 tests | Contracts are immutable and provider-neutral |
| 1.2 | Domain tests covered missing contracts | Implemented entity, placement, review, and ports | Preserved legacy placement field for compatibility |
| 1.3 | Added Mongo validator/index persistence test | Mongo suite passed: 10 tests | Evidence lookup is indexed and ambiguity remains review-only |
| 1.4 | Mongo test initially had missing persistence surface | Added V2 documents, validators, repositories, indexes, and backfill | Legacy collections/fields remain untouched |
| 1.5 | Existing suites exercised compatibility | Focused suites remain green | No provider logic added; domain/application imports remain Mongo-free |

## Validation

- `npx vitest run domain/catalog-global/catalog-global.test.ts`: PASS, 13 tests.
- `npx vitest run --config vitest.mongodb.config.ts integrations/persistence/mongodb/catalog-global-mongodb.test.ts`: PASS, 10 tests.
- `npx eslint application/catalog-global/match-and-apply-provider-candidate.ts`: PASS.
- `git diff --check`: PASS.
- `npm run typecheck`: BLOCKED by pre-existing malformed `.next/dev/types/routes.d.ts` generated file (TS1434/TS1005/TS1128).

# Unit 2 Apply Progress

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 2.1 | Added candidate tests for normalized-plate reuse, provider order, fallback-only creation, idempotency, and review outcomes; initial run failed | Focused matcher tests passed: 12 tests | Reused transaction fixture and asserted authority movement without provider-specific application logic |
| 2.2 | Candidate tests exercised authoritative replacement and fallback preservation | Matcher implementation passed focused tests | Placement policy compares authority/provenance; legacy placement is not overwritten by fallback |
| 2.3 | Mapper tests covered Cybermapa company evidence and Howen fleet evidence metadata | Provider mapping tests passed: 35 tests across Unit 2 files | Adapter-specific payload translation remains in integrations; no provider branching added to domain policy |
| 2.4 | Evidence normalization behavior covered by mapper/matcher tests | Focused tests passed | Centralized group evidence normalization and unique normalized-label reuse; labels update binding metadata only |

## Validation

- `npx vitest run application/catalog-global/match-and-apply-provider-candidate.test.ts integrations/cybermapa/map-cybermapa-catalog.test.ts integrations/howen/seed-howen-catalog.test.ts`: PASS, 3 files / 35 tests.
- `npm run lint`: PASS with pre-existing warning in `coverage/block-navigation.js`.
- `git diff --check`: PASS.
- No MongoDB, real provider API, routes, streaming, or Units 3-5 touched.

# Unit 3 Repair Apply Progress

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 3.1 | Unit 3 synchronization tests cover stable connection lookup, lineage, checkpoint resume, cumulative progress, retries, and duplicate-effect prevention | Focused synchronization suite passed: 1 file / 6 tests | Synchronization keeps logical lineage separate from attempts |
| 3.2 | Dedicated Mongo persistence tests cover lineage/attempts, checkpoints/resume, cumulative monotonic progress, leases/retries, and snapshot integrity | Focused Mongo suite passed: 1 file / 17 tests | Mongo persistence serializes optional fields safely and orders tied attempts deterministically |
| 3.3 | Focused synchronization and Mongo tests cover persisted progress publication and attempt/lineage separation | Unit 3 focused evidence passed: 6 synchronization tests + 17 Mongo tests | Persisted progress is the publication source |

## Validation

- `npx vitest run application/catalog-global/synchronize-global-connection.test.ts`: PASS, 1 file / 6 tests.
- `npx vitest run --config vitest.mongodb.config.ts integrations/persistence/mongodb/catalog-global-sync-mongodb.test.ts`: PASS, 1 file / 17 tests.
- Changed-file lint: PASS.
- `git diff --check`: PASS.

## Scope

- Unit 3 synchronization and Mongo persistence implementation/tests are included in the current worktree.
- No Units 4/5, routes, streaming, comments, secrets, or real Mongo data were touched.
- Worktree remains uncommitted.
