# Howen Fleet Catalog Import Specification

## Purpose

Preserve Howen's fleet hierarchy in Sentinel's canonical Company-owned catalog.

## Requirements

### Requirement: Valid Howen fleets become canonical fleets

When a Howen candidate contains a valid external fleet identity and belongs to an authorized Company, the system MUST create or reuse one canonical standard Fleet for that external fleet and MUST associate the external identity with it.

#### Scenario: First import creates fleets

- GIVEN a Company-scoped Howen roster containing two distinct valid fleets
- WHEN the catalog import runs
- THEN two canonical standard Fleets are available under the Company
- AND each external fleet identity references its corresponding Fleet

#### Scenario: Same fleet appears on many vehicles

- GIVEN many candidates share one external fleet identity
- WHEN the catalog import runs
- THEN only one canonical Fleet is created for that external fleet

### Requirement: Vehicles preserve their provider fleet placement

Every valid Howen vehicle candidate MUST be placed in the canonical Fleet resolved from its external fleet identity. A valid fleet candidate MUST NOT fall back to the Company's unassigned Fleet.

#### Scenario: Vehicles are grouped by Howen fleet

- GIVEN vehicles belong to two different Howen external fleets
- WHEN the catalog import runs
- THEN each vehicle is placed in the Fleet corresponding to its own external fleet

#### Scenario: Fleet identity is missing

- GIVEN a candidate has no valid external fleet identity
- WHEN the catalog import runs
- THEN the candidate is rejected or reviewed according to the catalog contract
- AND it is not silently placed in an unrelated Fleet

### Requirement: Fleet import is idempotent and preserves reviewed bindings

Repeated imports MUST reuse existing canonical Fleets and MUST NOT duplicate Fleets or move vehicles away from administrator-reviewed Fleet bindings.

#### Scenario: Import repeats

- GIVEN a Howen roster was already imported successfully
- WHEN the same roster is imported again
- THEN Fleet and Vehicle cardinality remains unchanged
- AND vehicles retain their canonical Fleet placement

#### Scenario: Existing binding is reviewed

- GIVEN an external Howen fleet identity is already bound to an administrator-selected Fleet
- WHEN a later import reports that external fleet
- THEN the selected binding remains authoritative
- AND the vehicles are placed in that Fleet

### Requirement: Company and tenant boundaries remain enforced

Howen fleet creation and placement MUST remain scoped to the connection's authorized Company and tenant.

#### Scenario: Company is unavailable

- GIVEN a Howen connection has no authorized Company
- WHEN the catalog import runs
- THEN no canonical Fleet or Vehicle is created
