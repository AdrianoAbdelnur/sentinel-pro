# Tasks: Define Multi-provider Vehicle Catalog Domain

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 2,000-2,700 |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 |
| Delivery strategy | ask-on-risk |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR |
|---|---|---|
| 1 | Domain contracts | PR 1 |
| 2 | Matching and legacy reviews | PR 2 after 1 |
| 3 | Snapshot lifecycle | PR 3 after 2 |
| 4 | Provider adapters | PR 4 after 1 |
| 5 | Persistence/migration | PR 5 after 3 |
| 6 | Wiring/docs | PR 6 after 4-5 |

## Phase 1: Domain — Unit 1

- [x] 1.1 RED: Extend `domain/catalog/{catalog,plate,review}.test.ts` for optional plates, scoped devices, states, observations, conflicts, and eligible/ineligible legacy-review fixtures.
- [x] 1.2 GREEN: Add `domain/catalog/{device,provider-vehicle-observation,catalog-conflict}.ts`; extend related contracts and `domain/catalog/index.ts`.
- [x] 1.3 REFACTOR: Centralize invariants without changing placement or `domain/catalog/organization-vehicle-access.ts`.

## Phase 2: Matching — Unit 2

- [x] 2.1 RED: Extend `application/catalog/match-and-apply-provider-candidate.test.ts` for eligible-review bypass, exact device/contribution reuse, normal unique-plate-or-create fallback, and plate-less separation.
- [x] 2.2 RED: Prove atomic closure covers vehicle, device, contribution, observation, membership, projections, and review; retry is idempotent; collision and unsupported-reason reviews remain pending.
- [x] 2.3 GREEN: Extend `application/catalog/{ports,match-and-apply-provider-candidate}.ts` with exact review lookup, identity-first reconciliation, fallback, and one transaction.
- [x] 2.4 REFACTOR: Extract eligibility, identity, and fallback policies while preserving transaction scope.
- [x] 2.5 RED: Add `application/catalog/reconcile-canonical-vehicle.test.ts` for precedence, conflict retention, order independence, and activity.
- [x] 2.6 GREEN: Add `application/catalog/reconcile-canonical-vehicle.ts` for projection/conflict refresh.

## Phase 3: Snapshot Lifecycle — Unit 3

- [x] 3.1 RED: Extend `application/catalog/synchronize-connection.test.ts`: record-local reconciliation survives a later partial snapshot failure, but absence does not run.
- [x] 3.2 GREEN: Update `application/catalog/synchronize-connection.ts` to replace candidate state locally and reconcile omissions only after complete snapshots.
- [x] 3.3 REFACTOR: Separate record processing from snapshot-finalization policy.

## Phase 4: Adapters — Unit 4

- [x] 4.1 Add sanitized `integrations/howen/fixtures/fleet-find-all.sanitized.json` and describe its schema in `docs/integrations/howen-fleet-fixture.md`.
- [x] 4.2 RED: Extend `integrations/howen/*.test.ts` and `integrations/cybermapa/*.test.ts` for field mappings, Fleet ancestry, missing parents/cycles, metadata, company, states, and capabilities.
- [x] 4.3 GREEN: Update provider adapters and `integrations/catalog/sync-source-adapters.ts` to emit neutral facts/provenance.
- [x] 4.4 REFACTOR: Remove provider interpretation from application policies.

## Phase 5: MongoDB — Unit 5

- [x] 5.1 RED: Extend `integrations/persistence/mongodb/catalog-*.test.ts` for uniqueness, validators, transactions, eligible/ineligible reviews, atomic rollback, retry idempotency, and exact review lookup.
- [x] 5.2 GREEN: Extend `catalog-{documents,repositories,sync-repositories,initializer,validators}.ts`; add `{ connectionId, externalId, status }` index and `catalog-{migrations,migrate}.ts` backfill support.
- [x] 5.3 REFACTOR: Consolidate mappings/indexes while retaining legacy reviews, placement, access, and known facts.

## Phase 6: Wiring — Unit 6

- [x] 6.1 Wire `application/catalog/bootstrap-catalog.ts`; document rollout, reconciliation counts, pending reasons, and rollback in `docs/architecture/08-catalog-synchronization.md`.
- [x] 6.2 Run lint, typecheck, tests, coverage, and build; record SDD verification evidence.
