# Capability Source Precedence Specification

## Purpose
Resolve sources independently per capability.

## Requirements

### Requirement: Capabilities resolve independently
GPS, operational alerts, video, and video alerts MUST resolve separately. Defaults MUST prefer Cybermapa for GPS/operational alerts and Howen for video/video alerts.

#### Scenario: Defaults use mixed sources
- GIVEN eligible Cybermapa and Howen sources for a canonical Vehicle
- WHEN all capabilities resolve
- THEN each capability uses its declared default

#### Scenario: Vehicle has one capable source
- GIVEN only one eligible provider-only source
- WHEN a capability resolves
- THEN that source MAY serve it

### Requirement: Business and tenant policy levels control fallback
Each capability MUST use the first policy defined at Vehicle, Fleet, canonical catalog Company, authenticated tenant Organization, then system level and MUST preserve declared source order.

#### Scenario: Vehicle overrides broader levels
- GIVEN policies exist at Vehicle, Fleet, Company, and tenant Organization
- WHEN the capability resolves
- THEN the Vehicle policy order applies

#### Scenario: Fleet overrides Company and tenant
- GIVEN no Vehicle policy and Fleet, Company, and tenant policies exist
- WHEN the capability resolves
- THEN the Fleet policy order applies

#### Scenario: Company overrides tenant
- GIVEN no Vehicle or Fleet policy and Company/tenant policies exist
- WHEN the capability resolves
- THEN the Company policy order applies

#### Scenario: Tenant supplies broader default
- GIVEN no Vehicle, Fleet, or Company policy and a tenant policy exists
- WHEN the capability resolves
- THEN the tenant Organization policy order applies

#### Scenario: Preferred source cannot serve
- GIVEN the first source is absent, unsupported, stale, or unavailable
- WHEN the capability resolves
- THEN the next eligible source is tried in order

#### Scenario: No source can serve
- GIVEN no ordered source is eligible
- WHEN the capability resolves
- THEN only that capability is unavailable

#### Scenario: Linked source stops reporting a Vehicle
- GIVEN a canonical Vehicle remains present but one source is absent
- WHEN capabilities resolve
- THEN only capabilities lacking another eligible source are unavailable
