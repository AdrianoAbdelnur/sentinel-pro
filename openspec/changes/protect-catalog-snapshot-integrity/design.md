# Design: Protect Catalog Snapshot Integrity

## Technical Approach

Make catalog completeness an explicit contract and deny absence reconciliation by default. Sources return candidates plus retrieval, pagination, and raw/parseable counts; synchronization assesses those facts after connection authorization, imports candidates regardless, and only reconciles after a proven full run also has a prior proven baseline.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Completeness boundary | Provider-neutral evidence in `application/catalog/ports.ts`; provider details remain in clients/sources | UI/route checks; provider branches in use case | Keeps integrations responsible for retrieval/pagination proof and makes application policy testable. |
| Safety policy | `MIN_PARSE_QUALITY_RATIO = 0.98`; authorized observed count must be >= 90% of the last confirmed count; missing evidence is partial | Treat every successful array as full; exact provider total | Ratios detect truncation/degraded mapping while allowing small catalog changes. |
| Baseline | Persist received, parseable, authorized-observed counts and partial reason on each run. Only a prior *new-format confirmed full* run is a reconciliation baseline. | Trust legacy `fullSnapshot: true`; use import outcomes | Historical full flags were optimistic; processed/rejected counts are not source population. Authorized candidate count protects each connection's scope even with shared master credentials. |
| First safe run | It establishes the baseline but cannot reconcile absence. | Reconcile on first apparently full run | There is no demonstrated comparison baseline; retaining legacy identities is the required safe failure mode. |
| Partial handling | Finish import and persist a succeeded non-full run with reason; do not refresh successful-sync freshness. | Fail and discard candidates | records remain useful while stale identities are protected. |

## Data Flow

```
provider client -> { records, receivedCount, paginationComplete }
       -> source maps candidates + parseableCount + retrieval evidence
       -> authorization filters candidates for connection scope
       -> assessSnapshot(priorConfirmedRun, evidence, authorizedCount)
       -> import authorized candidates
       -> save run evidence; reconcile stale identities only when eligible
```

Cybermapa's single catalog request and Howen's documented all-roster request set pagination complete only on a completed request. Any future paged adapter must return `false` on an interrupted/unproven traversal.

## File Changes

| File | Action | Description |
|---|---|---|
| `application/catalog/ports.ts` | Modify | Add snapshot evidence/result contract and confirmed-baseline repository query. |
| `application/catalog/synchronize-catalog-connection.ts` | Modify | Start deny-by-default, authorize before assessment, import partial candidates, gate/reason reconciliation. |
| `application/catalog/synchronize-due-catalog-connections.ts` | Modify | Use last confirmed full run for cadence. |
| `application/catalog/get-catalog-sync-status.ts` | Modify | Report freshness from the last confirmed full run. |
| `domain/catalog/sync-run.ts` | Modify | Define assessment/reason types, constants, run evidence, and pure assessment/reconciliation predicates. |
| `integrations/{cybermapa,howen}/client.ts` | Modify | Return raw received count and pagination-completion evidence without provider payload leakage. |
| `integrations/{cybermapa,howen}/responses.ts` | Modify | Preserve raw array cardinality while parsing usable records. |
| `integrations/{cybermapa,howen}/source.ts` | Modify | Return candidates and mapping/retrieval evidence; do not fail merely for partial usability. |
| `integrations/persistence/mongodb/catalog-{documents,repositories,validators}.ts` | Modify | Persist run assessment; query only new-format confirmed baselines; accept old documents as unproven. |
| Catalog source/sync/domain/persistence tests | Modify | Add evidence, partial, baseline, recovery, and idempotence coverage. |
| `docs/architecture/08-catalog-synchronization.md` | Modify | Document deny-by-default reconciliation and partial-run cadence. |

## Interfaces / Contracts

```ts
type SnapshotReason =
  | "retrieval-unproven" | "pagination-unproven"
  | "parse-quality-below-threshold" | "unexpected-empty"
  | "population-decline" | "missing-baseline";

type CatalogSnapshotEvidence = {
  retrievalComplete: boolean;
  paginationComplete: boolean;
  receivedRecordCount: number;
  parseableRecordCount: number;
};

type CatalogSnapshotAssessment = CatalogSnapshotEvidence & {
  authorizedCandidateCount: number;
  status: "complete" | "partial";
  reason?: SnapshotReason;
};

type CatalogSnapshotResult =
  | { kind: "snapshot"; candidates: CatalogImportCandidate[]; evidence: CatalogSnapshotEvidence }
  | { kind: "failed"; failure: CatalogSyncFailure };
```

A snapshot is full only when retrieval/pagination are true, parseable/received is at least 98% (zero/zero is allowed only when no prior confirmed observed records exist), and authorized observed candidates are at least 90% of the prior confirmed count. Any missing evidence, prior-populated empty result, or lower count is partial. Reconciliation additionally requires a prior confirmed baseline; a full initial run records one but reconciles nothing.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Domain | 98% parse threshold, empty, 90% decline, missing baseline, predicate | Pure table-driven tests. |
| Integration | Raw versus mapped counts and pagination-unproven sources | Mock clients only; no network. |
| Application | Normal full, partial import/no absence, empty, low parse, confirmed absence, recovery, idempotence | Extend in-memory synchronization fixture; assert persisted assessment and identity presence. |
| Persistence | New assessment round-trip and confirmed-baseline query excludes legacy/partial runs | Mongo repository/document tests. |

## Migration / Rollout

No data migration. Existing runs without assessment are unproven and cannot authorize reconciliation. The first newly proven full run establishes the baseline; the next proven full run can reconcile. Partial runs retain cadence due status.

## Open Questions

None.

