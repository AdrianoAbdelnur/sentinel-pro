# Delta for Cybermapa Catalog Import

## RENAMED Requirements

### Requirement: Cybermapa establishes the current rollout catalog → Cybermapa emits authoritative catalog evidence

(Reason: Import is a standing adapter contract, not a deployment stage.)

## MODIFIED Requirements

### Requirement: Cybermapa emits authoritative catalog evidence

The Cybermapa adapter MUST emit a stable external identity, an explicit validated `patente` as plate evidence, GPS and operational-alert capabilities, and normalized `nombre_empresa` as authoritative group evidence. It MUST NOT infer provider fleet membership when no provider fleet identifier is exposed. Matching and placement MUST remain application responsibilities.
(Previously: Cybermapa was described as seeding a staged catalog.)

#### Scenario: Valid candidate is imported
- GIVEN Cybermapa reports valid identity, plate, and unambiguous company evidence
- WHEN the candidate is processed
- THEN its contribution exposes GPS and operational alerts
- AND authoritative group evidence determines accepted placement

#### Scenario: Existing vehicle matches
- GIVEN Cybermapa plate evidence matches one fallback-placed vehicle
- WHEN the candidate is processed
- THEN the existing vehicle is reused and authoritative placement applies

#### Scenario: No provider fleet identifier exists
- GIVEN the payload reports `nombre_empresa` without a provider fleet ID
- WHEN it is normalized
- THEN group evidence is retained and no provider fleet membership is created

#### Scenario: Group evidence is ambiguous
- GIVEN normalized group evidence resolves to multiple groups
- WHEN the candidate is processed
- THEN no merge or placement occurs and ambiguous group evidence remains pending for manual review
