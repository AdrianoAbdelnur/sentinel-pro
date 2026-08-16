# Delta for Canonical Vehicle Catalog

## RENAMED Requirements

### Requirement: Tenant owns catalog companies → Global catalog owns vehicle identity

(Reason: Vehicle identity is global rather than tenant-owned.)
(Migration: Replace tenant ownership with separate access assignments.)

## MODIFIED Requirements

### Requirement: Global catalog owns vehicle identity
Each physical vehicle MUST have one global Sentinel identity independent of tenant, Company, provider, and provider fleet. The provider contribution that first creates it MUST establish its Sentinel placement; later contributions MUST NOT move it.
(Previously: Tenant-owned Company, Fleet, and Vehicle hierarchy defined identity and access.)

#### Scenario: Later provider uses a different fleet
- GIVEN a placed vehicle matches a later contribution
- WHEN that contribution is linked
- THEN the existing vehicle and placement remain unchanged

### Requirement: Canonical existence is source independent
A global Vehicle MUST remain when a provider stops reporting it; synchronization MUST change only that provider contribution.
(Previously: Source independence applied inside a tenant Company hierarchy.)

#### Scenario: Provider omits a vehicle
- GIVEN a linked global vehicle
- WHEN one complete snapshot omits it
- THEN the vehicle remains and only that contribution becomes absent
