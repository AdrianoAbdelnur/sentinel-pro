# Global Catalog Synchronization

## Boundary

V2 synchronization operates on global provider connections and global catalog
repositories. The application use case depends on internal ports only; provider
clients and payload mapping remain in `integrations/`. Manual, internal, and
scheduler delivery adapters call the same `synchronize` use case.

## Triggers and authorization

- Manual synchronization is exposed under `/api/admin/import` and requires
  an active platform `super-admin` session.
- Internal synchronization is exposed under `/api/internal/catalog/v2` and
  requires the server-only `SENTINEL_CATALOG_SYNC_SECRET` Bearer token.
- The admin import route resolves one enabled V2 connection per provider and
  never invokes the legacy catalog importer. Cybermapa company evidence is
  authoritative; Howen fleet evidence is fallback placement and metadata.
- The internal route enumerates enabled due connections and invokes the same
  use case with the `scheduler` trigger. `SENTINEL_CATALOG_V2_SYNC_ENABLED`
  controls scheduler rollout; manual runs are independent of that switch.
- Authorization is performed by delivery adapters and is not part of the
  synchronization algorithm.

## Leases, checkpoints, and retries

Every connection claims one V2 lease before loading a snapshot. A held lease
returns `already-running`; lease renewal must succeed before processing the next
candidate. Sorted external IDs are persisted as checkpoints after each applied
candidate. A failed run resumes after its last checkpoint through a stable
lineage and cumulative counts, while contribution and group-evidence identity
make repeated application idempotent.

Cybermapa may replace a Howen-derived placement for the same plate. Howen may
enrich a Cybermapa placement but cannot replace it. Provider fleet IDs and
labels remain metadata; canonical group IDs are Sentinel-owned.

Failures are classified without persisting provider secrets. Connectivity,
timeout, rate-limit, and internal failures are retryable. Authentication and
invalid-response failures are reported as non-retryable.

## Snapshot integrity

Retrieval completeness, pagination completeness, parse quality, empty results,
and population decline are assessed before absence reconciliation. Valid
candidates from an incomplete snapshot may still be applied, but an incomplete
snapshot NEVER marks unseen contributions absent. Absence is reconciled only by
a complete snapshot after a previous complete baseline.

## Status

Platform status returns the latest run, last successful completion, due state,
checkpoint, counts, snapshot assessment, and sanitized failure classification.
Credentials and raw provider errors are never returned.

## Rollout and rollback

Keep `SENTINEL_CATALOG_V2_SYNC_ENABLED=false` until adapters and V2 persistence
are configured. Manual runs remain the controlled verification path. Disable
the scheduler switch to stop recurring work; leases, runs, contributions, and
global identities remain intact for inspection and retry. HTTP disconnects detach
NDJSON delivery only; they do not cancel or fail the persisted application run.
