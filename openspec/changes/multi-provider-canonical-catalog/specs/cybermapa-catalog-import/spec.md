# Cybermapa Catalog Import Specification

## Purpose
Import the operational Cybermapa business catalog.

## Requirements

### Requirement: GETVEHICULOS uses the observed contract
The importer MUST consume operational `GETVEHICULOS` and recognize only `alias`, `anio`, `color`, `consumo`, `descripcion`, `gps_id`, `gps_identificador`, `id`, `marca`, `modelo`, `nombre`, `nombre_empresa`, `nombre_modulo`, and `patente`. It MUST use connection-scoped `gps_id` as vehicle identity. Because the contract exposes no verified fleet identity, it MUST NOT create or infer a Cybermapa Fleet.

#### Scenario: Observed record is valid
- GIVEN usable `gps_id` and `nombre_empresa`
- WHEN normalized
- THEN only observed fields form a provider-neutral candidate

#### Scenario: Required identity is absent
- GIVEN `gps_id` or company label is unusable
- WHEN normalized
- THEN that record is rejected while valid records continue

#### Scenario: Record has no fleet identity
- GIVEN a valid Cybermapa record and bound Company
- WHEN its canonical Vehicle is created
- THEN it enters Company `Unassigned` without an invented Fleet

### Requirement: Company binding gates vehicle composition
The importer MUST stage unbound company candidates and MUST compose Vehicles only inside their bound canonical Company.

#### Scenario: Company is unbound
- GIVEN a `nombre_empresa` candidate has no Company binding
- WHEN vehicle records import
- THEN they remain staged and no canonical Vehicle is created

#### Scenario: Company is bound
- GIVEN a candidate is bound inside the connection's tenant
- WHEN vehicle records import
- THEN matching occurs only inside that Company

### Requirement: Full import is resumable and idempotent
The system MUST process a 5,542-record-sized response in bounded batches. Initial and reconciliation runs MUST follow catalog synchronization behavior. Repeated, concurrent, or resumed imports MUST NOT duplicate candidates, identities, Vehicles, or reviews.

#### Scenario: Full observed scale imports
- GIVEN 5,542 valid records
- WHEN import completes
- THEN every unique scoped `gps_id` has one outcome

#### Scenario: Batch persistence fails
- GIVEN committed batches and a later failure
- WHEN import resumes
- THEN unfinished records continue without duplicating committed outcomes

#### Scenario: Provider fetch fails
- GIVEN no valid complete response
- WHEN import starts
- THEN canonical state remains unchanged and failure is reported

### Requirement: Cybermapa composes first
Cybermapa candidates MUST precede other external catalog candidates when present. This order MUST retain Howen-only, other-provider-only, and native Vehicles, and synchronization MUST preserve administrator Fleet assignments.

#### Scenario: Cybermapa and Howen represent one Vehicle
- GIVEN both sources contribute matching candidates
- WHEN composition runs
- THEN Cybermapa is considered first and both identities may link one Vehicle

#### Scenario: Admin moved imported Vehicle
- GIVEN a Cybermapa Vehicle is assigned to a real Fleet
- WHEN synchronization repeats without hierarchy
- THEN it is not returned to `Unassigned`
