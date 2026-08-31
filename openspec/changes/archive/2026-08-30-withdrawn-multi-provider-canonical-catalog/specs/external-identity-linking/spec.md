# External Identity Linking Specification

## Purpose
Link source vehicles within a bound catalog Company.

## Requirements

### Requirement: Vehicle identities are tenant and connection scoped
External vehicle identity MUST be unique by tenant, provider connection, entity kind, and external identifier. A link MUST target a Vehicle inside the connection's bound Company. Multiple identities MAY link one Vehicle.

#### Scenario: Deterministic identity repeats
- GIVEN a scoped identity already links a Vehicle
- WHEN it appears again
- THEN the same link is reused without duplication

#### Scenario: Connections reuse an identifier
- GIVEN two connections report one external identifier
- WHEN recorded
- THEN distinct scoped identities remain

#### Scenario: Later provider identifies an existing Vehicle
- GIVEN a later source candidate has one safe Company-scoped Vehicle match
- WHEN its identity is linked
- THEN it attaches to that Vehicle without creating another Vehicle

### Requirement: Plate matching stays within Company
An exact normalized plate MUST auto-link only when exactly one active Vehicle matches inside the bound Company and no deterministic identity conflicts. Names, aliases, and descriptions MUST NOT auto-link.

#### Scenario: Plate has one safe Company match
- GIVEN one active plate match in the bound Company and no conflict
- WHEN evaluated
- THEN the source identity auto-links to that Vehicle

#### Scenario: Plate has no Company match
- GIVEN no matching Vehicle in the bound Company
- WHEN evaluated
- THEN a Vehicle is created in that Company's `Unassigned` Fleet

#### Scenario: Match is multiple or conflicting
- GIVEN multiple Company matches or a deterministic conflict
- WHEN evaluated
- THEN no merge occurs and pending review is retained

#### Scenario: Match exists only outside Company
- GIVEN the plate matches a Vehicle in another Company or tenant
- WHEN evaluated
- THEN it does not auto-link

#### Scenario: Only name or alias matches
- GIVEN no exact Company plate match
- WHEN a name or alias matches
- THEN it does not auto-link

### Requirement: Review resolution is explicit
Only an authorized tenant administrator MUST resolve pending review to a Vehicle in the bound Company or to a new Vehicle there.

#### Scenario: Admin resolves review
- GIVEN pending review
- WHEN an authorized administrator chooses its outcome
- THEN exactly one Company-scoped link is retained
