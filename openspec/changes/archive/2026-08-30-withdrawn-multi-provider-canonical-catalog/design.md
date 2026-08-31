# Design: Multi-provider canonical catalog

## Technical Approach

Build a hexagonal `catalog` slice. Identity `Organization` stays the auth tenant; canonical `Company -> Fleet -> Vehicle` is durable and source-independent. Provider adapters only fetch and normalize. `SynchronizeCatalogConnection` owns every initial, scheduled, and manual run and delegates candidate application to `ImportCatalog`; no trigger duplicates import logic. Union projection and per-source presence preserve canonical assets across partial rosters.

## Architecture Decisions

| Decision | Choice and rationale |
|---|---|
| Fleet union | Connection-scoped external Fleet identities bind many-to-one to canonical Fleets through exact identity reuse or admin review, never labels. Canonical `fleetId` drives union projection; later safe source matches enrich existing Vehicles. |
| Placement/presence | Imports may place new or non-admin-assigned `Unassigned` Vehicles. Conflicting placement enters review. External vehicle identities hold last sighting and bounded capability states; absence never changes canonical placement/existence. |
| Unified synchronization | `SynchronizeCatalogConnection` receives connection, trigger, and injected clock. `SynchronizeDueCatalogConnections` computes `lastSuccessfulAt + 6h` and invokes it independently per due connection; scheduled execution rechecks freshness after leasing. Shared outcomes cover success, skipped-fresh, already-running, and retryable-failure. |
| Mutual exclusion | Acquire a renewable per-connection lease, then create one active run protected by a partial unique index. Expired ownership is atomically abandoned/replaced. This handles concurrent cron/manual requests and process death without relying on in-memory locks. |
| Snapshot safety | Fetch/validate a complete snapshot before absence changes. Existing `ImportCatalog` applies deterministic bounded batches and checkpoints. Only final successful completion marks unseen source identities absent; failures preserve presence and committed idempotent outcomes. |
| Delivery security | Node-runtime `POST /api/internal/catalog/synchronize` validates a constant-time Bearer comparison against server-only `SENTINEL_CATALOG_SYNC_SECRET`, following existing `SENTINEL_*` environment conventions; it never logs/returns the secret. Manual POST uses existing same-origin, session, and fresh tenant-admin authorization. |
| Cybermapa | GETVEHICULOS maps observed fields and scoped `gps_id`; it has no verified Fleet identity. New Vehicles enter Company `Unassigned`; admin placement survives synchronization. |

## MongoDB Model

All documents use `schemaVersion`, timestamps, strict/error validators, and tenant-first indexes. Existing catalog collections remain as designed: Companies, Fleets, Vehicles, provider connections, company candidates, Fleet/Vehicle identities, reviews, policies, and import items.

`catalog_import_runs` stores `trigger`, status, full-snapshot flag, timestamps, sanitized failure summary, checkpoint, and bounded processed/created/linked/reviewed/rejected/absent counts. Indexes: partial unique `{organizationId,connectionId}` for `status:"active"`; latest-run `{organizationId,connectionId,startedAt:-1}`; last-success `{organizationId,connectionId,status,completedAt:-1}`. Status reads derive freshness using the injected clock.

`catalog_sync_leases` stores one `{organizationId,connectionId,runId,leaseUntil}` document. A unique tenant/connection index is the lock authority; TTL on `leaseUntil` is cleanup only. External vehicle identities index tenant/connection/`lastSeenRunId`/presence for bounded absence reconciliation. Growing import items remain referenced.

## Interfaces and Sequence

```text
cron POST -> secret auth -> SynchronizeDueCatalogConnections -> due connections
admin POST -> authorizeAdminRequest -> SynchronizeCatalogConnection
  -> lease claim -> freshness recheck (scheduled) -> active-run claim
  -> CatalogImportSource.loadCompleteSnapshot
  -> ImportCatalog batches/checkpoints
  -> success: reconcile absence, counts, release
  -> failure: record retryable failure, release; other connections continue
admin page -> GetCatalogSyncStatus -> latest timing/status/counts/failure/freshness
```

Ports add `CatalogSyncRunRepository`, `CatalogSyncLeaseRepository`, and existing injected `Clock`; existing connection, identity, transaction, credential, and import-source ports remain. The scheduler returns per-connection outcomes rather than failing the entire batch.

## File Changes

- Create `application/catalog/{synchronize-catalog-connection,synchronize-due-catalog-connections,get-catalog-sync-status,sync-contracts}.ts` and tests; reuse `import-catalog.ts`.
- Extend Mongo catalog documents/repositories/validators/migrations with run, lease, freshness, count, and presence indexes plus replica-set tests.
- Create `app/api/internal/catalog/synchronize/{route,delivery}.ts`, `integrations/security/authorize-internal-secret.ts`, and tests.
- Create `app/api/admin/catalog/connections/[connectionId]/sync/route.ts`; extend catalog composition and Spanish admin status/`Sync now` UI.
- Keep Cybermapa/Howen sources behind `CatalogImportSource`; modify live composition only at the canonical feature-switch seam; update architecture and environment documentation.

## Testing Strategy

Strict TDD covers injected-clock six-hour boundaries, manual freshness, shared outcomes, unauthorized/manual and invalid-secret requests, atomic concurrent claims, lease expiry, duplicate trigger replay, provider isolation, retry recovery, status/count projection, full-success absence, and failed/partial non-reconciliation. Replica-set tests prove indexes, transactions, crash recovery, and races. Adapter tests pin provider snapshots; delivery tests assert secrets never leak. Run lint, typecheck, tests, coverage, then build.

## Migration and Rollback

Add collections/indexes idempotently, configure the server-only secret, run Cybermapa then Howen initial sync, and enable cron after parity. Keep current Howen live fallback. Rollback disables cron/manual routes and canonical projection; data, run history, bindings, reviews, and admin placement remain.

## Open Questions

None.
