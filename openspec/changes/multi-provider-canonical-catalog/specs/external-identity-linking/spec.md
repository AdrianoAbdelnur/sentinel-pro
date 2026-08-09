# External Identity Linking Specification

## Purpose
Link sources to canonical vehicles safely.

## Requirements

### Requirement: Identities are scoped
External identity MUST be unique by organization, provider connection, entity kind, and external identifier. Multiple identities MAY link to one vehicle.

#### Scenario: Connections reuse identifiers
- GIVEN two connections report one identifier
- WHEN identities are recorded
- THEN distinct scoped identities remain

#### Scenario: Sources share one vehicle
- GIVEN deterministic evidence identifies one vehicle
- WHEN another identity arrives
- THEN it links without duplicating the vehicle

### Requirement: Ambiguity requires review
Only deterministic matches MUST link automatically. Ambiguity MUST retain review and MUST NOT cause automatic link, merge, rename, or move.

#### Scenario: Match is deterministic
- GIVEN exactly one deterministic match
- WHEN evaluated
- THEN it links automatically

#### Scenario: Match is ambiguous
- GIVEN multiple plausible matches
- WHEN evaluated
- THEN no merge occurs and review remains pending

#### Scenario: Admin resolves review
- GIVEN pending review
- WHEN an authorized administrator selects a vehicle
- THEN the identity links only there
