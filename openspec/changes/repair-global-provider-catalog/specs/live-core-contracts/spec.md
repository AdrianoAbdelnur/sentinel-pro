# Delta for Live Core Contracts

## MODIFIED Requirements

### Requirement: Operational live entities
The system MUST project global vehicles with independently resolved capability sources, then filter them through tenant access assignments. Tenants MUST NOT influence ingestion, matching, placement, or source resolution, and UI MUST remain provider-agnostic.
(Previously: Live projected a tenant-owned Company/Fleet catalog with multi-provider capabilities.)

#### Scenario: Tenant opens Live
- GIVEN global vehicle sources are resolved and access assignments exist
- WHEN Live is projected for a tenant
- THEN only assigned vehicles appear with provider-neutral capability contracts

#### Scenario: Provider source changes
- GIVEN SUPER ADMIN changes one capability source
- WHEN Live is projected
- THEN the UI contract is unchanged
