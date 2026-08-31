# Catalog Synchronization Specification

## Purpose
Define canonical provider synchronization, retries, leases, and snapshot safety.

## Requirements

### Requirement: Enabled global connections synchronize automatically
Scheduled synchronization MUST enumerate enabled global provider connections through internal service authentication. Initial/manual runs MUST require SUPER ADMIN; tenant administrators MUST NOT start them. All triggers MUST share idempotency, leases, checkpoints, retry behavior, and complete-snapshot absence safeguards.
(Previously: Tenant connections synchronized every six hours and tenant administrators could run them.)

#### Scenario: Scheduler runs
- GIVEN enabled due global connections and valid internal service authentication
- WHEN the schedule fires
- THEN each eligible connection uses the shared synchronization behavior

#### Scenario: Snapshot is incomplete
- GIVEN a failed or incomplete provider snapshot
- WHEN synchronization ends
- THEN absence is not reconciled and committed identity is preserved

#### Scenario: Tenant admin starts import
- GIVEN a tenant administrator
- WHEN initial or manual import is requested
- THEN no run starts

### Requirement: Run status is globally administrable
Latest run status, counts, freshness, and failures MUST be visible to SUPER ADMIN.
(Previously: Status was tenant-administrator visible.)

#### Scenario: SUPER ADMIN inspects synchronization
- GIVEN synchronization history
- WHEN global status is requested
- THEN connection outcomes and freshness are returned

### Requirement: Candidate processing replaces current source state
Each successfully processed candidate MUST upsert its device by `(connectionId, deviceId)` and replace that contribution's mutable observation, device facts, status, capabilities, presence, and current fleet relationship. It MUST recompute affected canonical projections and conflicts. Candidate processing, including eligible legacy-review reconciliation, MUST NOT require a complete snapshot; failed or incomplete snapshots MUST NOT reconcile absence.

#### Scenario: Facts mutate between runs
- GIVEN a device's company, fleet, metadata, status, or capabilities changed
- WHEN its next candidate is successfully processed
- THEN current source state is replaced and canonical fields and conflicts are recomputed

#### Scenario: Snapshot is incomplete
- GIVEN some candidates committed before a snapshot failed or proved incomplete
- WHEN synchronization ends
- THEN their record-local changes remain committed and no omitted source is marked absent

### Requirement: Complete omission marks source absence
A successful complete omission MUST mark only that connection's omitted device and contribution absent. It MUST preserve the vehicle, other devices, source identity, and prior evidence needed for audit; canonical projections MUST use current observations according to their lifecycle policy.

#### Scenario: One provider omits a shared vehicle
- GIVEN a vehicle has devices from two providers
- WHEN one complete snapshot omits its device
- THEN only that provider device becomes absent and the shared vehicle remains

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
