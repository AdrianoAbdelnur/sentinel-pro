# Capability Source Precedence Specification

## Purpose
Resolve sources independently per capability.

## Requirements

### Requirement: Capabilities resolve independently
GPS, operational alerts, video, and video alerts MUST resolve separately. Defaults MUST prefer Cybermapa for the first two and Howen for the latter two.

#### Scenario: Defaults use mixed sources
- GIVEN Cybermapa and Howen sources
- WHEN all capabilities resolve
- THEN each uses its declared default

#### Scenario: Vehicle has one provider
- GIVEN one capable source
- WHEN a capability resolves
- THEN that source MAY serve it

### Requirement: Specific policy controls fallback
Each capability MUST use the first policy found at vehicle, fleet, organization, then default level, preserving its ordered sources.

#### Scenario: Vehicle overrides ancestors
- GIVEN policies at all levels
- WHEN capability resolves
- THEN vehicle order applies

#### Scenario: Preferred source cannot serve
- GIVEN it is absent, unsupported, stale, or unavailable
- WHEN capability resolves
- THEN the next eligible ordered source is tried

#### Scenario: No source can serve
- GIVEN no eligible source
- WHEN capability resolves
- THEN it is unavailable without affecting other capabilities

### Requirement: Cybermapa is contract-only
Cybermapa MUST be representable in ports and policy, but this change MUST NOT expose its import while `GETVEHICULOS` is unverifiable.

#### Scenario: Cybermapa adapter is absent
- GIVEN policy prefers Cybermapa
- WHEN no verified source serves it
- THEN fallback continues without import
