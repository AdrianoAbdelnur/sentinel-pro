# Delta for Cybermapa Catalog Import

## MODIFIED Requirements

### Requirement: Cybermapa establishes the current rollout catalog
Cybermapa MUST seed or reuse global vehicles, attach GPS and operational-alert contributions, and resolve `nombre_empresa` as authoritative canonical-group evidence. The importer MUST NOT treat that value as a verified provider fleet ID, silently merge ambiguous normalized evidence, or create duplicate vehicles on repeated import.
(Previously: Cybermapa used an authoritative placement mapping but did not define `nombre_empresa` as canonical-group evidence.)

#### Scenario: Shared vehicle is imported first
- GIVEN a valid Cybermapa vehicle with unambiguous `nombre_empresa`
- WHEN initial import runs
- THEN one global vehicle is placed in the resolved canonical group
- AND Cybermapa capabilities are attached

#### Scenario: Cybermapa matches a Howen-first vehicle
- GIVEN a plate match with Howen-derived placement
- WHEN Cybermapa imports unambiguous `nombre_empresa`
- THEN the existing vehicle receives Cybermapa-authoritative placement
- AND no duplicate vehicle is created

#### Scenario: No verified provider fleet exists
- GIVEN the observed adapter payload exposes `nombre_empresa` but no provider fleet identity
- WHEN normalized
- THEN canonical-group evidence is retained
- AND no Cybermapa provider fleet is inferred

#### Scenario: Company evidence is ambiguous
- GIVEN normalized `nombre_empresa` evidence resolves to multiple groups
- WHEN Cybermapa imports the candidate
- THEN no groups are merged
- AND the ambiguity is marked for review
