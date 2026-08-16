# live-core-contracts Specification

## Purpose

Define the normalized live domain and playback contracts that every provider integration must map into.

## Requirements

### Requirement: Operational live entities
The system MUST project global vehicles with independently resolved capability sources, then filter them through tenant access assignments. Tenants MUST NOT influence ingestion, matching, placement, or source resolution, and UI MUST remain provider-agnostic.
(Previously: Live projected a tenant-owned Company/Fleet catalog with multi-provider capabilities.)

#### Scenario: Tenant opens Live
- GIVEN global vehicle sources are resolved and access assignments exist
- WHEN Live is projected for a tenant
- THEN only assigned vehicles appear with provider-neutral capability contracts

#### Scenario: Provider source changes
- GIVEN SUPER ADMIN changes one capability source
- WHEN Live is projected
- THEN the UI contract is unchanged
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
