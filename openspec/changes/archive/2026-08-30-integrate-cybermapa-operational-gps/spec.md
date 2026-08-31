# Specification: Cybermapa Operational GPS

## Requirements

### Requirement: Group-scoped GPS loading

The system MUST request Cybermapa current data only for vehicles loaded from the opened catalog group.

#### Scenario: Open a group

- GIVEN a group has vehicles assigned to the organization
- WHEN the group vehicle endpoint loads
- THEN the system requests `DATOSACTUALES` using only that group's vehicle identifiers

### Requirement: Telemetry projection

The system MUST map valid Cybermapa coordinates, timestamp, speed, and heading to the provider-neutral telemetry contract.

#### Scenario: Current position is available

- GIVEN Cybermapa returns a current record with valid coordinates
- WHEN the response is projected
- THEN the corresponding catalog vehicle contains GPS telemetry

### Requirement: Provider isolation

The system MUST preserve Howen as an independent operational adapter and MUST NOT expose provider-specific branching in the UI.

#### Scenario: Cybermapa is unavailable

- GIVEN Cybermapa cannot provide current data
- WHEN the group is loaded
- THEN catalog vehicles remain visible and existing provider fallback behavior remains available
