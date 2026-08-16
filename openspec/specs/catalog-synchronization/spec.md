# Delta for Catalog Synchronization

## MODIFIED Requirements

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
