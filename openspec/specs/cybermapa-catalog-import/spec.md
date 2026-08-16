# Delta for Cybermapa Catalog Import

## MODIFIED Requirements

### Requirement: Cybermapa establishes the current rollout catalog
Cybermapa MUST currently seed global vehicles, GPS and operational-alert contributions, and Sentinel placement from the authoritative Cybermapa-derived catalog/import mapping available for this rollout. The importer MUST NOT invent a provider fleet from fields the adapter does not expose.
(Previously: Cybermapa composed tenant Company vehicles into `Unassigned`.)

#### Scenario: Shared vehicle is imported first
- GIVEN a valid Cybermapa vehicle and authoritative placement mapping
- WHEN initial import runs
- THEN one global vehicle is placed and Cybermapa capabilities are attached

#### Scenario: No verified provider fleet exists
- GIVEN the observed adapter payload lacks provider fleet identity
- WHEN normalized
- THEN no Cybermapa provider fleet is inferred
