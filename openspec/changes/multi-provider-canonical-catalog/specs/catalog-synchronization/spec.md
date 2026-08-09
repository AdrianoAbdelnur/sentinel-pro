# Catalog Synchronization Specification

## Purpose
Define provider-neutral initial, scheduled, and manual catalog reconciliation.

## Requirements

### Requirement: Connections receive initial and periodic full synchronization
Each enabled Cybermapa or Howen connection MUST receive an initial full synchronization. After success, automatic reconciliation MUST become due every six hours.

#### Scenario: Connection has no successful run
- GIVEN an enabled connection has never synchronized successfully
- WHEN synchronization is evaluated
- THEN a full synchronization is due

#### Scenario: Six hours elapsed
- GIVEN the last successful synchronization completed at least six hours ago
- WHEN the scheduler evaluates the connection
- THEN automatic reconciliation is due

#### Scenario: Recent manual success satisfies cadence
- GIVEN an administrator completed synchronization within the prior six hours
- WHEN the scheduler evaluates the connection
- THEN it MAY skip that connection as fresh

### Requirement: Manual and scheduled triggers share behavior
An authorized tenant administrator MUST be able to request `Sync now`. Initial, scheduled, and manual triggers MUST use the same synchronization behavior and outcome states. Unauthorized callers MUST NOT start a run.

#### Scenario: Administrator synchronizes now
- GIVEN an authorized tenant administrator and enabled connection
- WHEN `Sync now` is requested
- THEN synchronization starts with the shared outcome contract

#### Scenario: Unauthorized manual trigger
- GIVEN a caller lacks tenant administrator authorization
- WHEN `Sync now` is requested
- THEN no run starts

### Requirement: One run is active per connection
At most one synchronization run MUST be active for a provider connection. Repeated or concurrent triggers MUST be idempotent and MUST NOT duplicate canonical changes or run work.

#### Scenario: Concurrent trigger finds active run
- GIVEN a connection has an active synchronization
- WHEN another trigger targets that connection
- THEN it returns an already-running outcome without another run

#### Scenario: Same trigger is retried
- GIVEN a trigger result is retried
- WHEN synchronization completes
- THEN each source record has one canonical outcome

### Requirement: Reconciliation is snapshot safe and isolated
Missing source records MUST be reconciled only after a complete successful snapshot. A missing record MUST change only that source presence and capabilities; it MUST NOT delete or move canonical Companies, Fleets, or Vehicles. Failed or incomplete snapshots MUST NOT reconcile absence. One provider failure MUST NOT prevent other connections from running and MUST remain retryable.

#### Scenario: Successful snapshot omits a linked Vehicle
- GIVEN a complete successful snapshot omits a previously linked source Vehicle
- WHEN absence is reconciled
- THEN that source becomes absent while the canonical Vehicle remains placed

#### Scenario: Snapshot fails or is incomplete
- GIVEN a snapshot is failed or incomplete
- WHEN the run ends
- THEN no missing source record is reconciled

#### Scenario: One provider fails
- GIVEN one connection fails while another is eligible
- WHEN synchronization is processed
- THEN the failure is recorded and the other connection may complete

#### Scenario: Administrator retries failure
- GIVEN a connection has a retryable failed run
- WHEN an authorized administrator requests `Sync now`
- THEN a new run MAY recover without duplicating committed outcomes

### Requirement: Run status is administratively visible
The latest run per connection MUST expose trigger, status, start/completion times, processed outcome counts, failure summary, and freshness sufficient for tenant administrators to understand synchronization state.

#### Scenario: Administrator views synchronization state
- GIVEN a connection has synchronization history
- WHEN an authorized administrator views it
- THEN the latest status, timing, counts, failure summary, and freshness are available
