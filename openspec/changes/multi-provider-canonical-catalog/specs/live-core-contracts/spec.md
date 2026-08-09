# Delta for Live Core Contracts

## MODIFIED Requirements

### Requirement: Operational live entities
The system MUST define internal live entities for authenticated tenant Organization, canonical catalog Company, Fleet, Vehicle, linked devices, telemetry, independently resolved capabilities, and live selection. A Vehicle MAY have multiple provider identities contributing capabilities. Raw provider identifiers MUST NOT replace canonical business identity.

(Previously: Operational entities existed without explicit tenant-to-Company ownership or independently resolved multi-source capabilities.)

#### Scenario: Normalized operational model exists
- GIVEN Sentinel Pro starts live feature implementation
- WHEN developers read the project contracts
- THEN they find internal definitions for tenant, Company, Fleet, Vehicle, Device, telemetry, capabilities, and selection

#### Scenario: Provider identity does not replace business identity
- GIVEN provider payloads contain external identifiers
- WHEN normalized
- THEN live uses canonical Company, Fleet, Vehicle, and Device contracts within the authorized tenant

#### Scenario: Multiple providers contribute capabilities
- GIVEN multiple identities link one canonical Vehicle
- WHEN live state is projected
- THEN one Vehicle remains and each capability resolves independently

#### Scenario: Bound fleets project a union roster
- GIVEN multiple external fleet identities bind one canonical Fleet
- WHEN live state is projected
- THEN the Fleet contains the union of their canonical Vehicles

#### Scenario: One provider stops reporting a Vehicle
- GIVEN a complete successful synchronization marks one provider contribution absent
- WHEN live state is projected
- THEN the Vehicle remains and only affected capabilities change

#### Scenario: UI consumes canonical projection
- GIVEN a provider capability selection changes
- WHEN the live view model is composed
- THEN UI contracts do not require a provider-specific branch
