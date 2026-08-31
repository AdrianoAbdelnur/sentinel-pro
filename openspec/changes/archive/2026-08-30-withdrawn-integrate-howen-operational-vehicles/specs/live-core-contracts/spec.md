# Delta for live-core-contracts

## MODIFIED Requirements

### Requirement: Operational live entities

The system MUST define internal live entities for fleet, vehicle, device, telemetry, and live selection before provider-specific implementation begins. It MUST remove the unused `Customer` entity and MUST NOT require `customerId` on `Fleet` or `Vehicle` until tenancy is designed separately. `Vehicle` MUST support one primary plate/headline with an optional secondary label.

(Previously: The model exposed an unused `Customer`, required customer ownership on fleets and vehicles, and required a secondary vehicle label before tenancy and display semantics were approved.)

#### Scenario: Normalized operational model exists

- GIVEN Sentinel Pro starts live feature implementation
- WHEN developers read the project contracts
- THEN they find fleet, vehicle, device, telemetry, and selection contracts
- AND no unused customer contract or mandatory owner identifier remains

#### Scenario: Provider identity does not replace business identity

- GIVEN provider payloads contain external identifiers
- WHEN those payloads are normalized
- THEN internal fleet, vehicle, and device identities remain distinct from provider identifiers

#### Scenario: Tenancy remains deferred

- GIVEN provider fleets and vehicles have no approved customer relationship
- WHEN they are normalized
- THEN neither receives a placeholder owner identifier

#### Scenario: Vehicle secondary label is optional

- GIVEN a vehicle has one verified visible plate or headline
- WHEN it has no distinct business label
- THEN no duplicate headline or technical identifier is required as a secondary label
