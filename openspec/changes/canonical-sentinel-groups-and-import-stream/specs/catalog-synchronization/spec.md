# Delta for Catalog Synchronization

## MODIFIED Requirements

### Requirement: Enabled global connections synchronize automatically
Scheduled and admin synchronization MUST enumerate stable enabled V2 global provider connections. Initial/manual runs MUST require SUPER ADMIN; tenant administrators MUST NOT start them. All triggers MUST reuse persisted run identity, idempotency, leases, cumulative counts, checkpoints, retry behavior, and complete-snapshot absence safeguards. Resume MUST continue after the durable checkpoint without duplicating completed effects.
(Previously: Triggers shared synchronization safeguards but stable V2 run reuse and cumulative progress were not required.)

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

#### Scenario: Stable run resumes
- GIVEN an incomplete V2 run with persisted counts and checkpoint
- WHEN an authorized retry starts
- THEN the same logical run resumes after its checkpoint
- AND cumulative counts do not reset

### Requirement: Run status is globally administrable
Latest run status, freshness, failures, checkpoint, and cumulative `total`, `processed`, `created`, `linked`, `reviewed`, and `rejected` counts MUST be visible to SUPER ADMIN. Current group MAY be included as non-identity context.
(Previously: Global status exposed counts without requiring cumulative fields or checkpoint visibility.)

#### Scenario: SUPER ADMIN inspects synchronization
- GIVEN synchronization history
- WHEN global status is requested
- THEN connection outcomes, freshness, checkpoint, and cumulative counts are returned
