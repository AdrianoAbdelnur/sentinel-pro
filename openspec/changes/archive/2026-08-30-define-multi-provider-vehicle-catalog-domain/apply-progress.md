# Apply Progress: Define Multi-provider Vehicle Catalog Domain

**Mode**: Strict TDD  
**Delivery**: Single PR with maintainer-approved `size:exception`  
**Scope**: Closed corrective batch for verified catalog defects

## Corrective Batch

- [x] Provider observation validation and MongoDB round trip
- [x] Immutable first-creator placement
- [x] Later-plate identity conflict review without relinking
- [x] Canonical optional-field removal and MongoDB `$unset`
- [x] Independent canonical field precedence and normalized company comparison
- [x] Explicit device operational activity semantics
- [x] One request-scoped Howen Fleet resolver per import
- [x] Runtime coverage for legacy reconciliation, source replacement, omission, membership replacement, validation, and rollback

## TDD Cycle Evidence

| Behavior | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Placement immutability | `application/catalog/match-and-apply-provider-candidate.test.ts` | Unit | 38 focused tests passed before edits | Failed with changed placement | 19/19 passed | Howen-first and Cybermapa-first orders | Placement mutation restricted to initial creation |
| Later plate conflicts with linked identity | `application/catalog/match-and-apply-provider-candidate.test.ts` | Unit | 38 focused tests passed before edits | Returned `reused` instead of review | 19/19 passed | Existing plate match and no-match paths | Conflict evidence deduplicated without relinking |
| Canonical fields and company normalization | `application/catalog/reconcile-canonical-vehicle.test.ts` | Unit | 4/4 passed before edits | 2 projection tests and normalized-company test failed | 9/9 passed | Priority, fallback, mutation, absence, equivalent company values | Field selection made independent |
| Explicit operational activity | `application/catalog/reconcile-canonical-vehicle.test.ts`, `application/catalog/match-and-apply-provider-candidate.test.ts` | Unit | 4/4 and 17/17 passed before edits | Undefined status and presence-only creation incorrectly activated vehicles | Focused tests passed | Unknown, inactive, active, present, and absent paths | Operational status separated from capability status |
| Reusable Howen Fleet index | `integrations/howen/fleet.test.ts` | Unit | 2/2 passed before edits | Resolver factory did not exist | 3/3 passed | Two child Fleets resolved through one resolver | Index construction extracted from per-vehicle traversal |
| Observation validation and replacement | `integrations/persistence/mongodb/catalog-mongodb.test.ts` | Mongo integration | 4 files / 34 tests passed before edits | Valid observation failed strict validation | 19/19 focused Mongo tests passed | Valid round trip, replacement, invalid type, unexpected field | Domain mapping excludes persistence metadata |
| Canonical `$unset` persistence | `integrations/persistence/mongodb/catalog-mongodb.test.ts` | Mongo integration | 4 files / 34 tests passed before edits | Old plate remained stored | 19/19 focused Mongo tests passed | Plate and descriptive optional fields cleared | Document mapper emits explicit undefined values |
| Legacy review atomic reconciliation | `integrations/persistence/mongodb/catalog-mongodb.test.ts` | Mongo integration | 4 files / 34 tests passed before edits | Blocked initially by observation validator | 19/19 focused Mongo tests passed | Commit, retry, rollback, and ineligible-review paths | Transaction boundary retained |
| Snapshot omission and shared activity | `application/catalog/synchronize-connection.test.ts` | Unit | 10/10 passed before edits | Supplemental coverage added for the already-separated finalization path | 11/11 passed | Omitted source plus remaining active source | No production refactor performed outside the allowlist |

## Validation

| Command | Result |
|---|---|
| `npm run lint` | PASS, 0 errors; one pre-existing generated coverage warning |
| `npm run typecheck` | PASS |
| Serial non-Mongo Vitest | PASS, 102 files / 705 tests |
| Serial system Vitest | PASS, 1 file / 1 test |
| Serial Mongo Vitest | PASS, 4 files / 40 tests |
| `npm run test:coverage -- --pool=forks --maxWorkers=1 --no-file-parallelism` | PASS, 107 files / 746 tests; 90.25% statements, 81.28% branches, 91.48% functions, 94.44% lines |
| `npm run build` | PASS |
| `git diff --check` | PASS; line-ending notices only |

## Remaining Tasks

None.

## Final Verification-Gap Batch

| Behavior | Test file | Layer | Evidence |
|---|---|---|---|
| Existing strict Mongo collection receives the current validator | `integrations/persistence/mongodb/catalog-mongodb.test.ts` | Mongo integration | RED rejected `providerKey`, `presence`, and `active`; GREEN passed after `collMod` migration in initialization |
| Two-provider vehicle owns two durable devices | `application/catalog/match-and-apply-provider-candidate.test.ts` | Unit | One vehicle retained separate Cybermapa GPS and Howen MDVR identities |
| Tenant access and business company coexist | `integrations/persistence/mongodb/catalog-mongodb.test.ts` | Mongo integration | Canonical company and organization grant round-tripped independently |
| Cybermapa shared import persistence | `integrations/cybermapa/map-cybermapa-catalog.test.ts` | Unit | Shared vehicle received durable GPS device and Cybermapa observation |
| Howen matched and plate-less persistence | `integrations/howen/seed-howen-catalog.test.ts` | Unit | Both paths retained durable device and observation records |
| Howen inherited company provenance | `integrations/howen/seed-howen-catalog.test.ts` | Unit | Direct child Fleet, parent company-source Fleet, company, and ancestor outcome persisted |
| Eligible review with existing identity | `application/catalog/match-and-apply-provider-candidate.test.ts` | Unit | Existing contribution vehicle won without relinking and legacy review resolved |

Focused validation: 3 unit files / 38 tests passed; catalog Mongo file / 21 tests passed; typecheck passed; diff check passed with line-ending notices only.

## Completion Batch

| Task | Evidence |
|---|---|
| 3.3 | `finalizeSnapshot` now forms the single boundary between record processing and complete-snapshot absence reconciliation; 11 synchronization tests preserve behavior. |
| 4.1 | One authorized real Fleet response produced a fully sanitized root/subFleet fixture. The fixture-backed parser test verified `fleetname`, ancestry, and inherited `contacts` company evidence. Raw data and credentials were never logged or persisted. |
| 5.3 | Persistence mapping is centralized in `catalog-documents.ts`; validators in `catalog-validators.ts`; indexes and validator application in `catalog-initializer.ts`; `catalog-migrate.ts` delegates initialization. No duplicated mapping or index definition remains to consolidate without churn. Existing Mongo tests prove preservation of reviews, placement, grants, and known facts. |
| 6.1 | Both real synchronization composition roots already spread the complete `createCatalogRepositories` result into the use case and supply runs, leases, clock, IDs, and transactions. `bootstrap-catalog.ts` correctly owns adapter registration only, so no fake wiring was added. `docs/architecture/08-catalog-synchronization.md` now records rollout, counts, pending reasons, verification, and rollback. |

Final focused validation: 7 unit/composition files / 38 tests passed; catalog Mongo file / 21 tests passed; synchronization refactor test / 11 tests passed after its type annotation adjustment; typecheck passed; lint passed with one pre-existing generated coverage warning; diff check passed with line-ending notices only.
