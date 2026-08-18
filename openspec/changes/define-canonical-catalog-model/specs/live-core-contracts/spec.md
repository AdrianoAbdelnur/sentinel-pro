# Delta for Live Core Contracts

## MODIFIED Requirements

### Requirement: Operational live entities

Live MUST consume only the canonical catalog application projection. It MUST filter vehicles by active organization membership and `OrganizationVehicleAccess`, project each `CatalogGroup` as a provider-neutral Live fleet, and resolve each capability independently from eligible contributions. It MUST NOT load provider rosters directly or treat provider fleets as canonical grouping.
(Previously: Live allowed a global projection but did not require it as the sole production source.)

#### Scenario: Tenant opens Live
- GIVEN an active member and organization vehicle grants exist
- WHEN Live is projected
- THEN only granted canonical vehicles appear under their canonical groups

#### Scenario: Provider source changes
- GIVEN source policy changes one capability to another eligible contribution
- WHEN Live is projected
- THEN the provider-neutral UI contract remains unchanged

#### Scenario: Multiple providers contribute
- GIVEN one vehicle has eligible telemetry and video from different contributions
- WHEN Live is projected
- THEN one vehicle exposes both provider-neutral capabilities

#### Scenario: Provider fleet differs
- GIVEN a contribution reports a provider fleet unlike canonical placement
- WHEN Live is projected
- THEN grouping follows `CatalogGroup` and provider fleet remains metadata

#### Scenario: Direct roster source is requested
- GIVEN the canonical catalog projection is available
- WHEN operational Live data is composed
- THEN no provider-specific roster is used as catalog ownership

### Requirement: Playback contract is provider-agnostic

The system MUST define playback around one global monitor and reproducible tiles. Each playable video MUST be one tile, and rendering MUST branch on renderer and status rather than provider identity.
(Previously: The contract did not explicitly require tile reproducibility.)

#### Scenario: Playback is modeled as tiles
- GIVEN multiple contributions can provide video
- WHEN playback is represented
- THEN each selected playable video is one reproducible tile in the global monitor

#### Scenario: UI branches on renderer, not provider
- GIVEN a live tile is rendered
- WHEN display strategy is selected
- THEN renderer and status determine it without provider branching
