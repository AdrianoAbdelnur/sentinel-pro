# Delta for External Identity Linking

## MODIFIED Requirements

### Requirement: Review resolution is explicit and atomic
Only an authorized tenant administrator MUST resolve a pending review to a Vehicle in the bound Company or to a new Vehicle there. The resolved review, selected Vehicle when new, and scoped external identity association MUST commit atomically.

#### Scenario: Identity persistence fails
- GIVEN a pending vehicle review and a selected valid target
- WHEN identity or Vehicle persistence fails during resolution
- THEN the review remains pending and no new Vehicle or identity association is committed

#### Scenario: Concurrent synchronization creates the same identity
- GIVEN a pending vehicle review and synchronization concurrently creates its scoped external identity
- WHEN both operations select the same Vehicle
- THEN resolution succeeds idempotently with one identity association

#### Scenario: Concurrent synchronization targets a different Vehicle
- GIVEN a pending vehicle review and synchronization concurrently creates its scoped external identity for another Vehicle
- WHEN resolution is attempted
- THEN the resolution returns an explicit conflict and the review remains pending

#### Scenario: Resolution is retried
- GIVEN a prior successful review resolution
- WHEN the identical resolution is retried
- THEN it reports already resolved and does not create another Vehicle or identity
