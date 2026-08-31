# Tasks: Protect Catalog Snapshot Integrity

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 450–650 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 contracts/domain/persistence ? PR 2 adapters/use cases/tests/docs |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Assessment model, baseline persistence, and tests | PR 1 | Base: main; independently verifiable |
| 2 | Source evidence, synchronization gate, status/docs/tests | PR 2 | Base: PR 1; includes regression suite |

## Phase 1: Contracts and Persistence

- [x] 1.1 RED: Add table tests in `domain/catalog/sync-run.test.ts` for 98% parse quality, empty prior population, 90% decline, missing baseline, and reconciliation eligibility.
- [x] 1.2 GREEN: Define evidence, assessment, reasons, constants, and pure predicates in `domain/catalog/sync-run.ts`.
- [x] 1.3 REFACTOR: Align `application/catalog/ports.ts` and `integrations/persistence/mongodb/catalog-{documents,validators,repositories}.ts` to persist evidence and query only new-format confirmed baselines.
- [x] 1.4 Test repository/document round trips; verify legacy and partial runs cannot become confirmed baselines.

## Phase 2: Provider Evidence

- [x] 2.1 RED: Extend mocked Cybermapa and Howen source/client tests for raw-vs-parseable counts and unproven pagination, with no network calls.
- [x] 2.2 GREEN: Return `CatalogSnapshotResult` evidence from `integrations/{cybermapa,howen}/{client,responses,source}.ts`, preserving valid candidates.
- [x] 2.3 REFACTOR: Remove obsolete implicit-full assumptions while keeping provider details inside integrations.

## Phase 3: Conservative Synchronization

- [x] 3.1 RED: Add `application/catalog/synchronize-catalog-connection.test.ts` scenarios: normal full baseline, partial/no absence, unexpected empty, parse-degraded, confirmed absence, recovery, and idempotence.
- [x] 3.2 GREEN: Update `application/catalog/synchronize-catalog-connection.ts` to authorize before assessment, import valid partial candidates, persist reasons, and reconcile only with an eligible prior baseline.
- [x] 3.3 GREEN: Update `synchronize-due-catalog-connections.ts` and `get-catalog-sync-status.ts` to use last confirmed full-run freshness.
- [x] 3.4 REFACTOR: Keep absence gating in application/domain contracts; assert no duplicate identities or associations on retry.

## Phase 4: Documentation and Verification

- [x] 4.1 Update `docs/architecture/08-catalog-synchronization.md` with deny-by-default, thresholds, first-baseline, partial cadence, and recovery policy.
- [x] 4.2 Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`; record outcomes in verification artifacts.


