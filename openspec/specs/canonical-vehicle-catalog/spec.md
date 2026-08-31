# Delta for Canonical Vehicle Catalog

## RENAMED Requirements

### Requirement: Tenant owns catalog companies → Global catalog owns vehicle identity

(Reason: Vehicle identity is global rather than tenant-owned.)
(Migration: Replace tenant ownership with separate access assignments.)

## MODIFIED Requirements

### Requirement: Global catalog owns vehicle identity
Each physical vehicle MUST have one global Sentinel `vehicleId` independent of tenant, business company, provider, and provider fleet. It MUST retain optional canonical company, name, plate, vehicle make/model, and derived active state. The provider contribution that first creates it MUST establish its Sentinel placement; later contributions MUST NOT move it.
(Previously: The vehicle retained identity and placement but required no canonical descriptive or company fields.)

#### Scenario: Later provider uses a different fleet
- GIVEN a placed vehicle matches a later contribution
- WHEN that contribution is linked
- THEN the existing vehicle and placement remain unchanged

#### Scenario: Vehicle has no plate
- GIVEN a valid new device identity and no plate
- WHEN the vehicle is created
- THEN it receives a global vehicle identity with an empty canonical plate

### Requirement: Canonical existence is source independent
A global Vehicle MUST remain when a provider stops reporting it; synchronization MUST change only that provider's device, contribution, and current observation. A vehicle MUST be active if at least one current linked device is present with normalized active operational status and MUST otherwise be inactive; provider processing order MUST NOT affect this result.
(Previously: Omission changed only provider contribution presence, without defining device or vehicle status semantics.)

#### Scenario: Provider omits a vehicle
- GIVEN a linked global vehicle
- WHEN one complete snapshot omits it
- THEN the vehicle remains and only that provider's device and contribution become absent

#### Scenario: Device states differ
- GIVEN linked devices have different presence or operational statuses
- WHEN active state is reconciled
- THEN vehicle activity reflects whether any present linked device is active without rewriting device states
