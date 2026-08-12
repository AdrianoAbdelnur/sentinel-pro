# Catalog Cross-Provider Identity Matching Specification

## Purpose

Prevent unsafe canonical Vehicle duplication with provider-neutral, Company-scoped identity handling.

## Requirements

### Requirement: Deterministic Provider Identity Reuse

The system MUST reuse a Vehicle for an exact organization, connection, and external identifier. It MUST NOT create another Vehicle, identity, or review.

#### Scenario: Previously bound identity is imported again

- GIVEN an identity is already bound to a Vehicle
- WHEN the same organization, connection, and external identifier is imported
- THEN the system reuses that Vehicle
- AND no Vehicle, identity, or review is duplicated

### Requirement: Strong Registered-Plate Auto-Linking

The system MUST auto-link an unknown identity only when provider-supplied explicit registered-plate evidence matches exactly one active Vehicle in the same organization and bound Company, with no conflicting identity on that connection. A display label MUST NOT be explicit registered-plate evidence.

#### Scenario: Unique explicit plate links two provider identities

- GIVEN Cybermapa and Howen use different external identifiers for one Vehicle
- AND an unknown import has a unique matching explicit registered plate in its Company
- WHEN the import is synchronized
- THEN the identity is bound to the existing Vehicle
- AND no second canonical Vehicle is created

#### Scenario: Connection identity conflicts

- GIVEN the matching Vehicle has a conflicting identity for the importing connection
- WHEN the unknown identity is synchronized
- THEN the system MUST NOT auto-link it
- AND it is handled as a candidate requiring review

### Requirement: Weak Candidate Review

The system MUST create or reuse one pending vehicle-match review, rather than create a Vehicle, when no strong match exists and a Howen display name exactly equals active canonical registered plates in the bound Company. The review MUST preserve typed evidence and candidate Vehicle identifiers. The system MUST NOT treat that evidence as proof.

#### Scenario: Exact Howen display name is one weak candidate

- GIVEN an unknown Howen identity whose normalized display name exactly equals one canonical registered plate
- WHEN it is synchronized
- THEN one pending review is created with typed evidence
- AND no new Vehicle is created

#### Scenario: Exact evidence yields multiple candidates

- GIVEN matching evidence identifies multiple active Vehicles in the Company
- WHEN the unknown identity is synchronized
- THEN one pending review includes every candidate
- AND the system MUST NOT auto-link or create a Vehicle

#### Scenario: Retried weak candidate import is idempotent

- GIVEN a pending review exists for the same connection identity and subject
- WHEN the import is retried
- THEN the system reuses that review
- AND no Vehicle, identity, or review is duplicated

### Requirement: New Vehicle Creation Without Candidates

The system MUST create a Vehicle and bind the imported identity only when no deterministic identity, strong match, or reasonable weak candidate exists.

#### Scenario: No real candidate exists

- GIVEN an unknown identity with no eligible exact candidate in its bound Company
- WHEN it is synchronized
- THEN one new Vehicle and its identity are created

#### Scenario: Similar data is not a candidate

- GIVEN vehicles with similar or partial labels, fleet names, or plate-shaped but non-exact display names
- WHEN an unknown identity is synchronized
- THEN the system MUST NOT merge or review solely from that similarity
- AND it creates a Vehicle only if no eligible candidate exists

### Requirement: Review Resolution and Retry Safety

The system MUST atomically bind an approved review identity to the selected Vehicle. Later imports and repeated resolution MUST reuse the binding without duplicate identities or Vehicles.

#### Scenario: Approved cross-provider review becomes deterministic

- GIVEN a pending review for an unknown Howen identity and an existing Cybermapa Vehicle
- WHEN an operator approves that Vehicle
- THEN the identity is bound to the approved Vehicle
- AND future imports reuse it without a review or new Vehicle
