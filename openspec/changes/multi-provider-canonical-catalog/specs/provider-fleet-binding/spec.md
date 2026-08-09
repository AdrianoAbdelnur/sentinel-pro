# Provider Fleet Binding Specification

## Purpose
Bind verified provider fleets to canonical Fleets and compose partial rosters.

## Requirements

### Requirement: External fleet binding is explicit and scoped
An external Fleet identity MUST be scoped by tenant, connection, entity kind, and external identifier. Multiple external Fleet identities MAY bind one canonical Fleet in the same Company. An existing exact identity MUST reuse its binding; a new binding MUST require authorized administrator selection or review. Fleet names MUST NOT auto-bind or merge Fleets.

#### Scenario: Verified identity repeats
- GIVEN an external Fleet identity already binds a canonical Fleet
- WHEN that identity appears again
- THEN the existing binding is reused

#### Scenario: Admin binds another provider Fleet
- GIVEN an authorized tenant administrator selects a Fleet in the same Company
- WHEN an unbound verified external Fleet identity is bound
- THEN both external identities may reference that canonical Fleet

#### Scenario: Only fleet names match
- GIVEN two unbound external Fleets share a normalized name
- WHEN candidates are evaluated
- THEN no automatic binding or merge occurs

### Requirement: Canonical fleet roster is a union
A canonical Fleet MUST contain the union of canonical Vehicles linked through its bound external Fleets. Partial or missing provider coverage MUST NOT remove or move canonical Vehicles. A provider omission MUST affect only that source identity and its capabilities.

#### Scenario: Provider rosters partially overlap
- GIVEN two bound external Fleets share some Vehicles and each has unique Vehicles
- WHEN the canonical Fleet is composed
- THEN shared Vehicles appear once and provider-only Vehicles remain

#### Scenario: Provider identity arrives later
- GIVEN a canonical Vehicle already belongs to the Fleet
- WHEN a later provider identity safely matches it
- THEN the identity attaches without creating or moving the Vehicle

#### Scenario: Provider omits a Vehicle
- GIVEN a provider previously reported a canonical Vehicle
- WHEN a later roster omits it
- THEN the Vehicle remains and only that provider contribution becomes unavailable
