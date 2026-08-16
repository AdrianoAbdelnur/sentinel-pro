# Apply Progress: repair-global-provider-catalog

## Scope

PR 6 only: tasks 6.1, 6.2, and 6.3 on `catalog-v2-06-howen`, targeting `catalog-v2-05-cybermapa`.

## Completed Tasks

- [x] 1.1-1.3 PR 1 platform authorization completed on `catalog-v2-01-platform-auth`.
- [x] 2.1 RED: tests cover global identity, immutable placement, provider contributions, fleet memberships, tenant grants, and global reviews.
- [x] 2.2 GREEN: created provider-neutral `domain/catalog-global/*` contracts and `application/catalog-global/ports.ts`.
- [x] 2.3 REFACTOR: contracts exclude Company, tenant ownership, provider-specific branches, Next.js, MongoDB, and concrete provider dependencies.
- [x] 3.1 RED: added Mongo integration tests for strict validators, unique indexes, concurrent writes, and atomic updates.
- [x] 3.2 GREEN: created V2 Mongo documents, validators, repositories, and migrations with atomic upsert persistence.
- [x] 3.3 REFACTOR: rollback rejects any non-empty V2 collection and drops only empty V2 collections.
- [x] 4.1 RED: added focused matcher tests for external-ID reuse, exact global plate matching, missing/malformed/conflicting evidence review, unsafe-review retry idempotency, serialized concurrent candidates, and Mongo unique-index transaction races including competing external IDs.
- [x] 4.2 GREEN: created `application/catalog-global/match-and-apply-provider-candidate.ts` with transaction-scoped external identity reuse, exact normalized plate matching, safe creation, contribution application, and provider-neutral review outcomes.
- [x] 4.3 REFACTOR: kept matching contracts free of tenant, Company, and provider-fleet identity; Sentinel placement is only an initial vehicle-placement value and is never changed during enrichment.
- [x] 5.1 RED: added Cybermapa global mapping tests for Sentinel placement, GPS and operational-alert capabilities, absent plate review evidence, and the absence of inferred provider-fleet fields.
- [x] 5.2 GREEN: added `mapCybermapaGlobalCatalog` and `seedCybermapaCatalog`; the seed delegates identity and review decisions to the global matcher and applies only Cybermapa GPS/operational-alert contributions.
- [x] 5.3 REFACTOR: repeated seeding reuses the existing external contribution and global vehicle without creating duplicates; focused tests remained green after explicit dependency composition cleanup.
- [x] 6.1 RED: added Howen global seed tests for exact global-plate matching, video/video-alert contribution, immutable Cybermapa placement, evidence-only memberships, Howen-only creation, invalid plate review, missing initial placement review, and repeated shared plates.
- [x] 6.2 GREEN: added `seedHowenCatalog` and its Howen mapper; it delegates identity to the existing global matcher, contributes only video/video-alert capabilities, and persists provider fleet membership only from complete Howen fleet evidence.
- [x] 6.3 REFACTOR: extracted provider-fleet membership persistence inside the provider-neutral matcher and verified that refreshed existing contributions receive newly exposed membership evidence without changing placement or duplicating a vehicle.

## TDD Cycle Evidence

| Task | Test File | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| 3.1 | `integrations/persistence/mongodb/catalog-global-mongodb.test.ts` | Test-first import failure: `migrateGlobalCatalogDatabase is not a function` | 5 tests passed after validators, indexes, and persistence were implemented | 7 tests passed, including provider registry/listing and independent memberships | Assertions verify real Mongo validator/index/race behavior |
| 3.2 | `integrations/persistence/mongodb/catalog-global-mongodb.test.ts` | Tests referenced missing V2 migration/repository exports | Four requested Mongo files implemented; focused suite passed | Global vehicles, contributions, providers, connections, and memberships exercised | Repository writes use single-operation atomic upserts and preserve domain boundaries |
| 3.3 | `integrations/persistence/mongodb/catalog-global-mongodb.test.ts` | Rollback test referenced missing migration rollback | Empty database rollback passed and populated rollback rejected | Both empty and populated V2 paths verified | Rollback enumerates only declared V2 collections and refuses destructive rollback |
| 4.1 | `application/catalog-global/match-and-apply-provider-candidate.test.ts`, `integrations/persistence/mongodb/catalog-global-mongodb.test.ts` | Test-first import failure: matcher module did not exist | 8 focused matcher tests and 9 Mongo tests passed after implementing conflict retry | Reuse, exact match, unsafe review cases, unsafe retry, in-memory concurrency, and Mongo transaction races for identical and competing external IDs all passed | Assertions verify identity outcome, unique-index convergence, and repository side effects |
| 4.2 | `application/catalog-global/match-and-apply-provider-candidate.test.ts` | Tests referenced missing matcher exports and contracts | Matcher implementation passed all focused scenarios | Existing external identity wins before plate evaluation; unmatched safe candidates create exactly one global vehicle | Application depends only on domain contracts and narrow repository/transaction ports |
| 4.3 | `application/catalog-global/match-and-apply-provider-candidate.test.ts` | Approval tests established the forbidden identity inputs by omitting tenant, Company, and fleet identity from the candidate contract | TypeScript and focused tests pass with only connection/external identity, plate evidence, and initial placement | Concurrent execution is serialized by the transaction boundary and preserves one identity/contribution | No provider-specific, Next.js, MongoDB, tenant, Company, or provider-fleet dependency was introduced |
| 5.1 | `integrations/cybermapa/map-cybermapa-catalog.test.ts` | Test-first import failure: `seed-cybermapa-catalog` did not exist | 18 focused tests passed after global mapping and seed contracts were added | Added missing-plate and no-provider-fleet paths alongside valid placement/capability mapping | Mapping is isolated from legacy tenant/company catalog candidates |
| 5.2 | `integrations/cybermapa/map-cybermapa-catalog.test.ts` | Tests referenced missing global seed exports | Focused suite passed with global candidates carrying GPS and operational-alert eligibility and configured Sentinel placement | Valid and incomplete plate evidence exercise creation and review paths through the matcher | Seed delegates identity safety to the existing provider-neutral application matcher |
| 5.3 | `integrations/cybermapa/map-cybermapa-catalog.test.ts` | Idempotency test referenced the missing seed use case | Repeated seed passed with one vehicle and one contribution | Same external identity is exercised across two complete seed runs | Explicit repository/transaction dependency composition avoids provider or persistence leakage |
| 6.1 | `integrations/howen/seed-howen-catalog.test.ts` | Test-first import failure: `seed-howen-catalog` did not exist | 4 requested behavioral tests passed after the Howen global seed was implemented | 7 tests cover incomplete fleet evidence, later fleet evidence, invalid plate evidence, and unavailable initial placement | The tests exercise the mapper, matcher, contribution, and membership side effects through real in-memory repository ports |
| 6.2 | `integrations/howen/seed-howen-catalog.test.ts` | Tests referenced missing global seed exports | Howen seed maps validated plate evidence and applies only video/video-alert contributions through PR4 matcher | Shared plate records with different external identities converge on one vehicle | Howen integration contains its provider-specific mapping; application matcher remains provider-neutral |
| 6.3 | `integrations/howen/seed-howen-catalog.test.ts` | Refresh-evidence test failed with no membership after an existing contribution was reused | 7 focused Howen tests passed after membership persistence was applied to reused contributions | Existing placement, no-evidence membership absence, late evidence, invalid plate, no placement, and duplicate prevention remain covered | Extracted membership persistence into one matcher helper; focused Howen, Cybermapa, and matcher tests passed after refactor |

## Verification Evidence

- Focused tests: passed, 8 matcher tests; Mongo matcher races included in the 9-test Mongo persistence file.
- Lint: passed with one pre-existing warning in `coverage/block-navigation.js`.
- Typecheck: passed.
- `git diff --check`: passed.
- Full suite: passed with `npm test` after separating parallel non-Mongo tests from serial Mongo tests; 112 files and 940 tests passed (107 non-Mongo files/862 tests and 5 Mongo files/78 tests).
- PR4 focused tests: passed, 8 tests; Mongo race test passed.
- PR5 focused tests: passed, 18 tests in `integrations/cybermapa/map-cybermapa-catalog.test.ts`.
- PR5 typecheck: passed.
- PR5 `git diff --check`: passed.

## Boundaries

No Howen, registry, policies, synchronization, cron, functional migration, grants/live compatibility, or PR6+ work was implemented.

## Review

Independent clean-context PR3 review required before merge-readiness verdict.
