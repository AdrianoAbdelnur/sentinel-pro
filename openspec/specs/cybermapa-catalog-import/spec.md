# Delta for Cybermapa Catalog Import

## MODIFIED Requirements

### Requirement: Cybermapa establishes the current rollout catalog
Cybermapa MUST map `gps_id` to connection-scoped `deviceId`; preserve available `nombre_empresa`, `patente`, vehicle `nombre`, `marca`, `modelo`, GPS facts, operational status, and capabilities as source observations or device facts; and seed Sentinel placement from the authoritative rollout mapping. It MUST NOT invent provider fleet or unavailable device make/model.
(Previously: The importer seeded identity, placement, and capabilities but did not preserve detailed vehicle, device, or company facts.)

#### Scenario: Shared vehicle is imported first
- GIVEN a Cybermapa record with `gps_id`, normalized plate, and authoritative placement
- WHEN initial import runs
- THEN one vehicle, its GPS device, observations, capabilities, and placement are retained

#### Scenario: No verified provider fleet exists
- GIVEN the payload lacks provider fleet identity
- WHEN normalized
- THEN no Cybermapa provider fleet is inferred
