# Delta for Canonical Vehicle Catalog

## MODIFIED Requirements

### Requirement: Global catalog owns vehicle identity

The catalog MUST persist `CatalogVehicle` in `catalog_vehicles`, `CatalogGroup` in `catalog_groups`, and `ProviderContribution` in `provider_contributions`. A vehicle MUST represent one physical vehicle globally, have one accepted group placement, and MAY have many contributions. A contribution MUST be unique by `(connectionId, externalId)` and belong to exactly one vehicle. Groups and vehicles MUST use Sentinel-generated stable identifiers.
(Previously: Vehicle identity was global, but names, collections, contribution cardinality, and placement authority were not definitive.)

#### Scenario: Providers describe one vehicle
- GIVEN two contributions safely resolve to the same physical vehicle
- WHEN both are committed
- THEN one `CatalogVehicle` references both contributions
- AND exactly one canonical group placement is retained

#### Scenario: Group label changes upstream
- GIVEN a group has stable evidence and a canonical label
- WHEN a provider reports a different label
- THEN its identifier and canonical label remain unchanged

### Requirement: Canonical existence is source independent

A `CatalogVehicle` and `CatalogGroup` MUST remain when a provider stops reporting them; only the affected contribution presence and capability eligibility MAY change.
(Previously: Source independence did not name the definitive aggregates.)

#### Scenario: Provider omits a vehicle
- GIVEN a vehicle has a contribution from a complete prior snapshot
- WHEN a safe later snapshot omits that contribution
- THEN the vehicle and group remain
- AND only that contribution becomes absent

## ADDED Requirements

### Requirement: Canonical placement has one authority

Each accepted vehicle MUST store one group placement with typed authority and evidence provenance. Authoritative evidence MUST replace fallback placement; fallback evidence MUST NOT replace authoritative placement. Duplicate placement fields or a second persisted Sentinel fleet aggregate MUST NOT exist.

#### Scenario: Authoritative evidence follows fallback
- GIVEN a vehicle has fallback placement
- WHEN unambiguous authoritative group evidence is accepted
- THEN the vehicle moves to that group with authoritative provenance

