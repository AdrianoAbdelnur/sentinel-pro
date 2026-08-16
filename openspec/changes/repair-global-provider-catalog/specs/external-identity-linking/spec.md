# Delta for External Identity Linking

## MODIFIED Requirements

### Requirement: Vehicle identities are globally provider scoped
External identity MUST be unique by provider connection, entity kind, and external identifier and MUST reuse its existing global vehicle before any plate match. Multiple provider identities MAY link one vehicle.
(Previously: Identity was tenant-scoped and constrained to a bound Company.)

#### Scenario: External identity repeats
- GIVEN an identity already links a vehicle
- WHEN it appears again
- THEN the same link is reused idempotently

### Requirement: Plate matching is global and exact
For a new external identity, the system MUST auto-link only one exact normalized global plate match. Missing, ambiguous, malformed, or conflicting evidence MUST create SUPER ADMIN review and MUST NOT silently merge or create duplicates.
(Previously: Exact plate matching was limited to one bound Company.)

#### Scenario: One exact global plate matches
- GIVEN one trustworthy normalized plate match and no identity conflict
- WHEN evaluated
- THEN the contribution links that vehicle

#### Scenario: Evidence is unsafe
- GIVEN zero trustworthy plate evidence, multiple matches, or a conflict
- WHEN evaluated
- THEN review is retained without a merge

### Requirement: Review resolution is global
Only a SUPER ADMIN MUST resolve global identity review; tenant administrators MUST NOT resolve it.
(Previously: A tenant administrator resolved review inside a bound Company.)

#### Scenario: Tenant admin resolves review
- GIVEN pending global review
- WHEN a tenant administrator submits a resolution
- THEN the request is rejected without catalog changes
