# Delta for Live Core Contracts

## MODIFIED Requirements

### Requirement: Operational live entities
The system MUST define internal live entities for organization, fleet, canonical vehicle, linked devices, telemetry, capabilities, and selection. A vehicle MAY have multiple provider links contributing capabilities.

(Previously: Operational entities lacked durable canonical identity and multiple capability links.)

#### Scenario: Normalized operational model exists
- GIVEN live implementation begins
- WHEN contracts are read
- THEN every operational concept has an internal definition

#### Scenario: Provider identity stays external
- GIVEN provider payload identifiers
- WHEN normalized
- THEN live uses canonical vehicle identity and retains source links

#### Scenario: Providers contribute capabilities
- GIVEN multiple identities link one vehicle
- WHEN live is composed
- THEN one vehicle remains and capabilities resolve independently
