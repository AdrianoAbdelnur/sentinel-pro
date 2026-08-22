# Verification Report

**Change**: `define-canonical-catalog-model`  
**Baseline**: `9d786a7..HEAD`  
**Mode**: Strict TDD  
**Persistence**: Hybrid  
**Verdict**: **FAIL**

The definitive module and route rename is largely complete and every executed quality command passes, but the implementation is not archive-ready. Production catalog initialization is not wired, normalized group-label resolution differs from the tested fake repository, the run-status response drops required fields, canonical Live cannot load Cybermapa operational snapshots and turns a Howen snapshot failure into total catalog failure, and the repository still publishes V2/legacy/migration configuration and architecture guidance. Strict TDD evidence is also incomplete.

## Completeness

| Metric | Value |
|---|---:|
| Tasks total | 16 |
| Tasks complete | 16 |
| Tasks incomplete | 0 |
| Spec scenarios | 47 |
| Runtime-compliant scenarios | 33 |
| Partial scenarios | 2 |
| Untested scenarios | 9 |
| Failing scenarios | 3 |

Task checkboxes are complete, but completion does not override the correctness and Strict TDD failures below.

## Build and Test Execution

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | PASS; 0 errors, 1 warning in generated `coverage/block-navigation.js` |
| Type check | `npm run typecheck` | PASS |
| Main Vitest | `npm test` | PASS; 84 files / 575 tests |
| System Vitest | included in `npm test` | PASS; 1 file / 1 test |
| MongoDB Vitest | included in `npm test` | PASS; 4 files / 32 tests |
| Coverage | `npm run test:coverage` | PASS; 89 files / 608 tests; 89.04% statements, 79.65% branches, 91.65% functions, 93.31% lines |
| Build | `npm run build` | PASS; Next.js 16.2.10; only unversioned catalog routes appear in the route manifest |
| OpenSpec | `npx --offline @fission-ai/openspec validate define-canonical-catalog-model --strict --no-interactive` | PASS; change is valid |

## Spec Compliance Matrix

| Capability / requirement | Scenario | Runtime evidence | Result |
|---|---|---|---|
| Canonical vehicle identity | Providers describe one vehicle | `application/catalog/match-and-apply-provider-candidate.test.ts`; Mongo concurrency tests | COMPLIANT |
| Canonical vehicle identity | Group label changes upstream | Stable binding update exists at `application/catalog/match-and-apply-provider-candidate.ts:67-69`, but no covering label-change test | UNTESTED |
| Canonical existence | Provider omits a vehicle | Unsafe omission is tested, but safe complete-snapshot absence reconciliation and canonical retention are not | UNTESTED |
| Canonical placement | Authoritative evidence follows fallback | `application/catalog/match-and-apply-provider-candidate.test.ts` | COMPLIANT |
| Capability precedence | Mixed contributions serve one vehicle | `application/live/project-catalog-live.test.ts` | COMPLIANT |
| Capability precedence | Preferred source is unavailable | Projector fallback test passes, but production loading fails the entire source on Howen failure | PARTIAL |
| Capability precedence | No source can serve | No covering projector test proves only the affected capability becomes unavailable | UNTESTED |
| Capability precedence | Policy changes | `application/live/project-catalog-live.test.ts` | COMPLIANT |
| Synchronization | Scheduler runs | `app/api/internal/catalog/synchronize/synchronize.test.ts` | COMPLIANT |
| Synchronization | Organization administrator starts import | `app/api/admin/import/route.test.ts` | COMPLIANT |
| Run status | Status is inspected | `projectCatalogSyncRun` omits lineage ID, attempt number, and total | FAILING |
| Runs/checkpoints | Failed attempt resumes | `application/catalog/synchronize-connection.test.ts`; Mongo run tests | COMPLIANT |
| Lease | Lease is lost | Lease persistence is tested, but no test exercises renewal loss stopping later candidates while preserving committed effects | UNTESTED |
| Checkpoints | Retry processes the remainder | `application/catalog/synchronize-connection.test.ts` | COMPLIANT |
| Snapshot safety | Snapshot is unsafe | `application/catalog/synchronize-connection.test.ts` | COMPLIANT |
| Cybermapa evidence | Valid candidate is imported | Adapter and matcher tests jointly cover capabilities and authoritative placement | COMPLIANT |
| Cybermapa evidence | Existing vehicle matches | Matcher authoritative-after-fallback test | COMPLIANT |
| Cybermapa evidence | No provider fleet identifier exists | `integrations/cybermapa/map-cybermapa-catalog.test.ts` | COMPLIANT |
| Cybermapa evidence | Group evidence is ambiguous | Unit test passes only because its fake repository normalizes labels; Mongo repository performs exact-label lookup | FAILING |
| External identity | Contribution repeats | `application/catalog/match-and-apply-provider-candidate.test.ts` | COMPLIANT |
| Plate matching | Exact plate matches once | Application and Mongo concurrency tests | COMPLIANT |
| Plate matching | Evidence is unsafe | Parameterized matcher test | COMPLIANT |
| Plate matching | Valid unmatched evidence creates a vehicle | Matcher and provider adapter tests | COMPLIANT |
| Manual review | Unauthorized actor resolves review | Platform authorization tests plus platform-authorized route boundary | COMPLIANT |
| Manual review | Resolved review is submitted again | `application/catalog/reviews.test.ts`; `domain/catalog/catalog.test.ts` | COMPLIANT |
| Provider registry | Provider is added | Provider persistence and adapter registry are tested separately; no registration-to-synchronization test exists | PARTIAL |
| Provider registry | Tenant admin configures provider | Platform authorization/import rejection tests | COMPLIANT |
| Provider registry | Connection is assigned to organization | No covering test for rejecting organization ownership | UNTESTED |
| Howen evidence | Howen matches authoritative vehicle | `integrations/howen/seed-howen-catalog.test.ts` | COMPLIANT |
| Howen evidence | Howen-only candidate is valid | `integrations/howen/seed-howen-catalog.test.ts` | COMPLIANT |
| Howen evidence | Device name is not a valid plate | `integrations/howen/seed-howen-catalog.test.ts` | COMPLIANT |
| Howen evidence | Stable fleet repeats with new label | No covering updated-label test | UNTESTED |
| Operational Live | Tenant opens Live | Identity authorization, page composition, and catalog projector tests | COMPLIANT |
| Operational Live | Provider source changes | Catalog projector policy-order test | COMPLIANT |
| Operational Live | Multiple providers contribute | Catalog projector independent GPS/video test | COMPLIANT |
| Operational Live | Provider fleet differs | Canonical placement tests and projector grouping by catalog group | COMPLIANT |
| Operational Live | Direct roster source is requested | `app/live/create-operational-sources.test.ts`; production composes only canonical source | COMPLIANT |
| Playback | Playback is modeled as tiles | `application/live/open-vehicle-live.test.ts` | COMPLIANT |
| Playback | UI branches on renderer, not provider | No playback tile renderer component or rendering test exists; only domain types/use-case tiles exist | UNTESTED |
| Provider fleet membership | Providers disagree on fleets | Domain and Mongo membership tests | COMPLIANT |
| Provider fleet membership | Provider label changes | Save path updates metadata, but no covering label-change test exists | UNTESTED |
| Group evidence | Stable evidence repeats | Static update exists, but no covering updated-label test exists | UNTESTED |
| Group evidence | Label is ambiguous | Fake-repository test normalizes labels while production Mongo repository does not | FAILING |
| Organization access | Active member opens Live | Identity authorization and canonical Live tests | COMPLIANT |
| Organization access | Membership is absent | `application/identity/identity.test.ts` | COMPLIANT |
| Organization access | Grant belongs to another organization | `application/live/project-catalog-live.test.ts` | COMPLIANT |
| Bounded organization roles | Organization admin changes provider configuration | Platform authorization/import rejection tests | COMPLIANT |

**Compliance summary**: 33/47 scenarios are fully compliant under the required runtime-evidence rule.

## Correctness and Static Evidence

| Concern | Status | Evidence |
|---|---|---|
| One canonical domain/application model | Implemented | Surviving paths are `domain/catalog/**` and `application/catalog/**`; parallel `catalog-global` modules and organization-owned catalog modules are deleted |
| Definitive unversioned routes | Implemented | Build manifest exposes `/api/admin/catalog/...` and `/api/internal/catalog/synchronize`; V2 route files are deleted |
| Definitive collections/indexes | Defined but not activated | `catalogValidators` and `catalogIndexes` define the 12 catalog collections, but production never calls `initializeCatalogDatabase` |
| Import/admin/reviews/sync convergence | Implemented with gaps | All use the canonical application/runtime; run-status projection is incomplete |
| Organization disclosure | Implemented | Live page requires active membership and projector filters `OrganizationVehicleAccess` by organization |
| Provider-neutral Live projector | Implemented with production snapshot failure | Projector is provider-neutral, but snapshot adapter coverage is Howen-only and fail-fast |
| V2/legacy/migration removal | Incomplete | Runtime code/routes are removed; `.env.example` and architecture docs still describe active V2, legacy, global, and migration paths |
| File size | PASS | 74 added/modified/renamed files measured; largest is 253 lines; none reaches 700 lines |
| Diff shape | Informational | 170 files; +1,678/-10,054, dominated by removal and rename churn |

## Design Coherence

| Decision | Followed? | Notes |
|---|---|---|
| One model for import, persistence, review, and Live | Mostly | Dependency paths converge, but production schema initialization and operational snapshot composition are incomplete |
| Keep checkpoint retry; remove import items | Yes | No `CatalogItem` or `catalog_items` remains in active code |
| Existing manual review only | Yes | Canonical vehicle resolution retained; Company UI/actions removed |
| Initialize definitive collections only | No | Initializer defines only definitive collections but has no production invocation or script |
| No conversion, compatibility, flags, or versioned product contract | No | Runtime bridge code is removed, but active environment/example and architecture documentation still advertise those mechanisms |

## Strict TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | FAIL | A table exists in Engram apply-progress, but it does not satisfy the required schema |
| All tasks represented | FAIL | Only tasks 4.2, 4.3, 4.4, 5.1, and 5.2 appear; tasks 1.1-4.1 are absent |
| RED confirmed | FAIL | Rows contain narrative text, not `Written` evidence or test-file paths; no RED evidence can be cross-checked |
| GREEN confirmed | PARTIAL | Current tests pass, but reported task-to-test claims cannot be traced to named files |
| Triangulation adequate | FAIL | TRIANGULATE column is absent |
| Safety net for modified files | FAIL | SAFETY NET column is absent |
| Assertion quality | PASS | No tautologies, ghost loops, assertion-free tests, or smoke-only tests were found in the 20 changed test files |

**TDD compliance**: 0/16 tasks have complete, independently verifiable Strict TDD evidence.

## Test Layer Distribution for Changed Tests

| Layer | Tests | Files | Tool |
|---|---:|---:|---|
| Unit | 59 | 10 | Vitest |
| Integration | 54 | 10 | React Testing Library, route tests, MongoMemoryServer |
| E2E | 0 | 0 | Not installed |
| **Total** | **113** | **20** | |

## Changed-File Coverage

Aggregate coverage is healthy, but Strict TDD requires changed-file inspection. Notable changed files below 80% line coverage or absent from the default coverage run include:

| File | Line coverage | Evidence |
|---|---:|---|
| `app/api/admin/catalog/canonical-delivery.ts` | 50% | coverage output |
| `app/api/admin/catalog/reviews/[reviewId]/resolve/route.ts` | 75% | coverage output |
| `app/api/internal/catalog/delivery.ts` | 37.5% | coverage output |
| `application/catalog/synchronize-connection.ts` | 76.59% | coverage output |
| `integrations/catalog/live-snapshot-adapters.ts` | 35.29% | coverage output |
| `integrations/persistence/mongodb/catalog-repositories.ts` | 78.84% | coverage output |
| `integrations/persistence/mongodb/catalog-transaction-runner.ts` | 0% | coverage output |
| `integrations/catalog/sync-source-adapters.ts` | Not reported | Not exercised by the default coverage run |
| `integrations/persistence/mongodb/catalog-initializer.ts` | Not reported | Exercised only by the separate MongoDB test configuration |

Coverage is informational under the Strict TDD module, so these are warnings rather than independent archive blockers.

## Issues Found

### CRITICAL

1. **Production never initializes the definitive catalog schema.** `integrations/persistence/mongodb/catalog-initializer.ts:21-27` defines strict collections and indexes, but repository-wide references to `initializeCatalogDatabase` exist only in MongoDB tests. Production compositions (`app/api/admin/import/composition.ts:7-18`, `app/api/internal/catalog/composition.ts:8-22`, `app/live/create-catalog-source.ts:10-24`) create repositories directly. On an empty database, first writes can auto-create unvalidated, unindexed collections; uniqueness and lease/identity guarantees are therefore not established.
2. **Normalized group-label resolution is not implemented by the production repository.** The requirement says resolution must use a unique normalized label. The unit ambiguity test injects normalization at `application/catalog/match-and-apply-provider-candidate.test.ts:153-156`, while Mongo uses exact `{ label }` matching at `integrations/persistence/mongodb/catalog-repositories.ts:58`. Equivalent labels such as `North Hub` and `North-Hub` can create duplicates or avoid the required ambiguity review.
3. **Run-status delivery drops required contract fields.** `app/api/internal/catalog/delivery.ts:28-31` projects status, trigger, timestamps, checkpoint, counts, snapshot, and sanitized failure but omits run ID, lineage ID, attempt number, and total. This violates `Run status is globally administrable`; the route test at `app/api/admin/catalog/canonical-admin.test.ts:77-85` mocks only `{ connectionId, isDue }` and cannot detect the loss.
4. **Canonical Live operational snapshot composition is neither capability-independent nor multi-provider.** `integrations/catalog/live-snapshot-adapters.ts:43-47` silently skips every adapter except Howen, so Cybermapa GPS contributions can never receive production snapshots. `loadHowenSnapshots` throws on a Howen operational failure at lines 29-34, `Promise.all` rejects, and `createCatalogOperationalSource` converts the entire canonical catalog to unavailable. A single video provider failure can therefore hide canonical groups/vehicles and unrelated capabilities, contradicting capability-independent fallback and Live scenarios.
5. **The repository still publishes the removed V2/legacy/migration product model.** `.env.example:37` documents `/api/internal/catalog/v2/synchronize`; lines 42-48 expose `SENTINEL_CATALOG_V2_SYNC_ENABLED` and `SENTINEL_LIVE_CATALOG_MODE=legacy`. `docs/architecture/08-catalog-synchronization.md` still defines V2 synchronization, and `docs/architecture/09-global-catalog-migration.md` still instructs operators to run a removed migration and enable global Live after parity. These are active configuration/architecture sources, not exclusion history, and contradict the design and removed migration/compatibility requirements.
6. **Strict TDD evidence is not independently verifiable.** The Engram `apply-progress` table omits 11 of 16 tasks and lacks test paths, TRIANGULATE, and SAFETY NET columns. Under `strict-tdd-verify.md`, missing or unverifiable TDD evidence is CRITICAL.
7. **Required scenarios remain without passing covering tests.** Nine scenarios are UNTESTED, including safe provider omission, lease-loss behavior, stable evidence/label updates, organization ownership rejection, and UI renderer/status branching. Strict SDD verification forbids treating source inspection as scenario compliance.

### WARNING

1. Several changed files are below 80% line coverage, especially operational snapshot and HTTP delivery boundaries.
2. The linter reports one generated-artifact warning in `coverage/block-navigation.js`; there are no source lint errors.
3. Provider registration is tested only as separate persistence and adapter-registry units, not as the scenario's registration-to-synchronization flow.

### SUGGESTION

1. Add one composition-level test that starts from an empty Mongo database and proves initialization, import, organization grant, canonical Live projection, and independent provider snapshot degradation in one vertical slice.
2. Add an actual playback tile presenter test before claiming the renderer/status UI scenario.

## Final Verdict

**FAIL** — quality commands and structural renames pass, but correctness, documentation/configuration convergence, required runtime scenario evidence, and Strict TDD evidence do not satisfy the specification. Do not archive this change.
