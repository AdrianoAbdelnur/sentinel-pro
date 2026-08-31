# Delta for Catalog Synchronization

## ADDED Requirements

### Requirement: Runs retain attempt and checkpoint behavior

`CatalogRun` MUST persist in `catalog_runs`. Each attempt MUST retain its unique run ID, lineage, increasing attempt number, trigger, status, checkpoint, counts, snapshot assessment, timestamps, and sanitized failure. A retry after failure MUST create the next attempt and resume after the persisted checkpoint without resetting counts.

#### Scenario: Failed attempt resumes
- GIVEN an attempt failed after a durable checkpoint
- WHEN an authorized retry begins
- THEN a new attempt continues after that checkpoint with retained counts

### Requirement: One renewable lease guards a connection

`CatalogLease` MUST persist in `catalog_leases`, with at most one unexpired lease per connection owned by the active run. It MUST be renewed during processing and released on termination. Lease acquisition or renewal failure MUST prevent further candidates without rolling back committed effects.

#### Scenario: Lease is lost
- GIVEN a run has committed some candidates
- WHEN lease renewal fails
- THEN the run fails, later candidates stop, and committed effects remain

### Requirement: Checkpoints replace unused import items

Synchronization MUST resume through its existing run checkpoint and MUST NOT require a per-candidate `CatalogItem` entity or `catalog_items` collection.

#### Scenario: Retry processes the remainder
- GIVEN a failed run persisted its last completed external identifier
- WHEN the connection is retried
- THEN processing continues after that identifier without reading import items

### Requirement: Absence requires a proven snapshot

Unseen contributions MUST become absent only after successful processing of a proven complete, safe snapshot against a prior complete baseline. Unsafe snapshots MUST retain unseen presence.

#### Scenario: Snapshot is unsafe
- GIVEN completeness or population safety is unproven
- WHEN valid candidates finish processing
- THEN committed candidates remain and unseen contributions remain unchanged
