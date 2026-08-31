# Canonical Sentinel Groups Specification

## Purpose

Define Sentinel-owned placement groups independently from provider identities.

## Requirements

### Requirement: Canonical groups have stable identity and evidence

Each canonical group MUST have a generated stable ID, a canonical label, placement provenance, and zero or more provider-evidence bindings. Provider IDs, keys, and labels MUST remain evidence and MUST NOT become the canonical ID.

#### Scenario: Provider label changes
- GIVEN a canonical group bound to provider evidence
- WHEN that provider reports a different label for the same unambiguous evidence key
- THEN the group ID remains unchanged
- AND the canonical label is not automatically renamed

#### Scenario: Evidence is ambiguous
- GIVEN provider evidence that matches multiple groups after normalization
- WHEN the evidence is resolved
- THEN no groups are merged
- AND the evidence is marked for review

### Requirement: Cybermapa placement is authoritative

Cybermapa `nombre_empresa` MUST resolve canonical-group evidence and establish authoritative placement. It MUST replace a Howen-derived placement for the same matched vehicle, while Howen MUST NOT replace a Cybermapa-authoritative placement.

#### Scenario: Cybermapa arrives after Howen
- GIVEN a vehicle has Howen-derived placement
- WHEN a matching Cybermapa vehicle supplies unambiguous `nombre_empresa` evidence
- THEN the same vehicle moves to the resolved Cybermapa group
- AND the placement change records Cybermapa provenance

#### Scenario: Howen arrives after Cybermapa
- GIVEN a vehicle has Cybermapa-authoritative placement
- WHEN matching Howen evidence is imported
- THEN the placement remains unchanged

### Requirement: Howen-only vehicles receive fallback placement

A Howen vehicle without a global match or Cybermapa placement MUST resolve or create a canonical group from stable Howen `fleetid` evidence and MAY use `fleetname` as its initial label.

#### Scenario: Howen-only vehicle is imported again
- GIVEN a Howen-only vehicle and group already exist
- WHEN the same plate and `fleetid` are re-imported
- THEN the existing vehicle and group are reused
- AND no duplicate vehicle or group is created
