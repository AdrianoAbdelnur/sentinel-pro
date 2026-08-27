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

The contribution that creates a vehicle establishes its placement. Later
providers may enrich the same vehicle but cannot move it. Provider fleet IDs
and labels remain metadata; canonical group IDs are Sentinel-owned.

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

## Runtime composition

`app/api/admin/import/composition.ts` initializes the catalog schema, registers
the configured adapters, and constructs the synchronizer. The internal
scheduler composition uses the same complete repository set from
`createCatalogRepositories`: vehicles, devices, contributions, observations,
memberships, conflicts, reviews, runs, and leases. `bootstrap-catalog.ts`
registers providers and connections; it is not the synchronizer composition
root and requires no synchronization-specific repositories.

## Rollout

1. Run `npm run migrate:catalog`. Initialization creates missing collections,
   upgrades existing strict validators with `collMod`, creates indexes, and
   backfills devices from existing contributions without changing vehicle IDs,
   placement, access grants, reviews, or known facts.
2. Deploy the application and run a complete Cybermapa synchronization.
3. Run a complete Howen synchronization. Its request-scoped Fleet index is not
   persisted; only current membership and company-resolution provenance remain.
4. Compare run counts and review reasons before enabling scheduled execution.

Run counts distinguish processed, created, linked, reviewed, rejected, and
absent records. Pending reviews remain manual for missing placement, ambiguous
plate matches, conflicting identities, and ambiguous group evidence. Eligible
legacy missing-plate and malformed-plate reviews resolve only through exact
connection-scoped device identity in the same transaction as catalog writes.

Verify rollout with lint, typecheck, focused catalog tests, MongoDB transaction
tests, and a complete snapshot audit. Confirm that repeated synchronization is
idempotent, omitted devices alone become absent, first placement remains stable,
and canonical conflicts retain every current source value.

Rollback disables synchronization entry points and reverts the application
matcher. Additive collections and upgraded validators may remain because they
do not redefine authorization or vehicle ownership. Do not delete devices,
observations, conflicts, memberships, reviews, or grants during rollback.

## Operational notes

Leases, runs, contributions, and canonical identities remain intact for
inspection and retry after a failure. HTTP disconnects detach NDJSON delivery
only; they do not cancel or fail the persisted application run.
