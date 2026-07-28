# live-core-contracts Specification

## Purpose

Define the normalized live domain and playback contracts that every provider integration must map into.

## Requirements

### Requirement: Operational live entities

The system MUST define internal live entities for customer, fleet, vehicle, device, telemetry, and live selection before provider-specific implementation begins.

#### Scenario: Normalized operational model exists

- GIVEN Sentinel Pro starts live feature implementation
- WHEN developers read the project contracts
- THEN they can find internal entity definitions for operational live concepts

#### Scenario: Provider identity does not replace business identity

- GIVEN provider payloads contain external identifiers
- WHEN those payloads are normalized
- THEN the business model still uses internal customer, fleet, vehicle, and device contracts

### Requirement: Playback contract is provider-agnostic

The system MUST define a playback contract centered on a global monitor and individually playable tiles.

#### Scenario: Playback is modeled as tiles

- GIVEN multiple providers can contribute live video
- WHEN playback is represented in Sentinel Pro
- THEN each playable video is represented as one tile in a global monitor

#### Scenario: UI branches on renderer, not provider

- GIVEN a live tile is rendered
- WHEN the UI chooses how to display it
- THEN the decision is based on renderer and status rather than provider identity
