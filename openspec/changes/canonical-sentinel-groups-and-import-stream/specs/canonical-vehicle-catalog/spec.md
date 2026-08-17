# Delta for Canonical Vehicle Catalog

## MODIFIED Requirements

### Requirement: Global catalog owns vehicle identity
Each physical vehicle MUST have one global Sentinel identity independent of tenant, Company, provider, provider fleet, and canonical group. Contributions MUST reuse an existing match and MUST NOT create duplicates. Initial placement MAY come from Howen, but unambiguous Cybermapa group evidence MUST establish or replace it as authoritative; no later Howen contribution may replace that placement.
(Previously: The provider contribution that first created a vehicle fixed its Sentinel placement permanently.)

#### Scenario: Later Howen contribution uses a different fleet
- GIVEN a placed vehicle matches a later Howen contribution
- WHEN that contribution is linked
- THEN the existing vehicle is reused
- AND a Cybermapa-authoritative placement remains unchanged

#### Scenario: Later Cybermapa contribution finds Howen placement
- GIVEN a vehicle has Howen-derived placement and an exact global match
- WHEN Cybermapa contributes unambiguous group evidence
- THEN the existing vehicle is reused and moved to the Cybermapa group
- AND no duplicate vehicle is created

### Requirement: Canonical existence is source independent
A global Vehicle MUST remain when a provider stops reporting it; synchronization MUST change only that provider contribution.
(Previously: Source independence applied inside a tenant Company hierarchy.)

#### Scenario: Provider omits a vehicle
- GIVEN a linked global vehicle
- WHEN one complete snapshot omits it
- THEN the vehicle remains and only that contribution becomes absent
