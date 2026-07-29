# live-runtime-contracts Specification

## Purpose

Make the documented live contracts executable inside Sentinel Pro so later slices can depend on real TypeScript modules instead of prose alone.

## Requirements

### Requirement: Domain live contracts are exported from code

The system MUST expose provider-agnostic operational and playback contracts from `domain/live`.

#### Scenario: Developers can import normalized live entities

- GIVEN a new live use case is implemented
- WHEN it depends on customer, fleet, vehicle, device, telemetry, monitor, or tile contracts
- THEN it can import those contracts from `domain/live`

#### Scenario: GPS validity is codified

- GIVEN telemetry may have missing or invalid coordinates
- WHEN the application evaluates whether a vehicle is mappable
- THEN a domain helper determines GPS validity from telemetry data

### Requirement: Application contracts stay provider-agnostic

The system MUST expose application-facing live contracts without importing provider adapters.

#### Scenario: Application defines live page composition contracts

- GIVEN a live page use case needs stable outputs
- WHEN developers import application live contracts
- THEN they find view models, playback notices, and open-live result contracts in `application/live`

#### Scenario: Playback resolution stays behind a port

- GIVEN provider-specific playback data is needed
- WHEN the application opens live playback
- THEN it depends on a resolver port/function instead of direct provider modules
