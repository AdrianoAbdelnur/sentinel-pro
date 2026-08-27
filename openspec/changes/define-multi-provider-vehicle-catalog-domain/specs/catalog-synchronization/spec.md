# Delta for Catalog Synchronization

## ADDED Requirements

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
