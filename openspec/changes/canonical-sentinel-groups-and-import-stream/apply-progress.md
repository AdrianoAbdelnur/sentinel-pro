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
- `npm run lint`: PASS with pre-existing warning in `coverage/block-navigation.js`.
- `git diff --check`: PASS.
- `npm run typecheck`: BLOCKED by pre-existing malformed `.next/dev/types/routes.d.ts` generated file (TS1434/TS1005/TS1128).
