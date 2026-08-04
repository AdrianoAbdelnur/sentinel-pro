# Tenant Authorization Specification

## Requirements

### Requirement: Active tenant selection

The system MUST auto-select one active membership and require selection when several exist.

#### Scenario: Single membership
- GIVEN one active membership
- WHEN login completes
- THEN its organization becomes active

#### Scenario: Multiple memberships
- GIVEN multiple active memberships
- WHEN login completes
- THEN tenant access waits for selection

### Requirement: Tenant switching

The system MUST allow switching only to an active membership.

#### Scenario: Valid switch
- GIVEN another active membership
- WHEN its organization is selected
- THEN it becomes active

#### Scenario: Cross-tenant rejection
- GIVEN no active membership for an organization
- WHEN it is selected or accessed
- THEN access is denied

### Requirement: Tenant-scoped roles

The system MUST evaluate the active membership on every request. Operators MAY read Live; only admins MAY mutate catalogs or users.

#### Scenario: Operator mutation
- GIVEN an operator membership
- WHEN an admin mutation is attempted
- THEN the operation is denied
