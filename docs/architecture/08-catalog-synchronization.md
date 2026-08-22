# Catalog Synchronization

## Boundary

Synchronization operates on platform-owned provider connections and the canonical
catalog repositories. The application use case depends on internal ports only; provider
clients and payload mapping remain in `integrations/`. Manual, internal, and
scheduler delivery adapters call the same `synchronize` use case.

## Triggers and authorization

- Manual synchronization is exposed under `/api/admin/import` and requires
  an active platform `super-admin` session.
- Internal synchronization is exposed under `/api/internal/catalog/synchronize` and
  requires the server-only `SENTINEL_CATALOG_SYNC_SECRET` Bearer token.
- The admin import route resolves one enabled connection per provider. Cybermapa
  company evidence is authoritative; Howen fleet evidence is fallback placement
  and metadata.
- The internal route enumerates enabled due connections and invokes the same
  use case with the `scheduler` trigger.
- Authorization is performed by delivery adapters and is not part of the
  synchronization algorithm.

## Leases, checkpoints, and retries

Every connection claims one lease before loading a snapshot. A held lease
returns `already-running`; lease renewal must succeed before processing the next
candidate. A lost renewal stops the run and preserves the committed checkpoint.
Sorted external IDs are persisted as checkpoints after each applied
candidate. A failed run resumes after its last checkpoint through a stable
lineage and cumulative counts, while contribution and group-evidence identity
make repeated application idempotent.

Cybermapa may replace a Howen-derived placement for the same plate. Howen may
enrich a Cybermapa placement but cannot replace it. Provider fleet IDs and
labels remain metadata; canonical group IDs are Sentinel-owned.

Failures are classified without persisting provider secrets. Connectivity,
timeout, rate-limit, and internal failures are retryable. Authentication and
invalid-response failures are reported as non-retryable.

## Group resolution

Group evidence resolves first through an exact stable binding on
`(connectionId, kind, externalKey)`. When no binding exists, resolution falls back
to a unique normalized label: `catalog_groups` persists `normalizedLabel` and the
repository queries that field, so equivalent spellings resolve to the same group.
Multiple matching groups raise a pending manual review instead of merging.

## Snapshot integrity

Retrieval completeness, pagination completeness, parse quality, empty results,
and population decline are assessed before absence reconciliation. Valid
candidates from an incomplete snapshot may still be applied, but an incomplete
snapshot NEVER marks unseen contributions absent. Absence is reconciled only by
a complete snapshot after a previous complete baseline.

## Status

Platform status returns the latest run with its run ID, lineage, and attempt
number, plus last successful completion, due state, checkpoint, counts, snapshot
assessment, and sanitized failure classification. Credentials and raw provider
errors are never returned.

## Schema initialization

`npm run init:catalog` creates the twelve canonical collections with strict
validators and their indexes. It is idempotent and MUST run before the first
synchronization against an empty database; otherwise MongoDB auto-creates
unvalidated, unindexed collections and the uniqueness guarantees that the
matcher relies on do not exist.

## Operational notes

Leases, runs, contributions, and canonical identities remain intact for
inspection and retry after a failure. HTTP disconnects detach NDJSON delivery
only; they do not cancel or fail the persisted application run.
