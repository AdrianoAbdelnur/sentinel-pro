# Global Provider Registry Specification

## Purpose
Define platform-owned provider and connection registration.

## Requirements

### Requirement: Providers are registered globally

`Provider` and `ProviderConnection` MUST persist in `providers` and `provider_connections`. A provider MUST declare its adapter key and capabilities. A connection MUST belong to one provider and hold an opaque credential reference, enabled state, and cadence. Providers and connections MUST be platform-owned, MUST NOT belong to an organization, and MUST require platform authorization to configure. Adding a provider MUST require an adapter, not provider-specific catalog, matching, or UI rules.
(Previously: Global configuration did not define definitive entities, collections, or ownership.)

#### Scenario: Provider is added
- GIVEN a conforming adapter exists
- WHEN a platform-authorized actor registers and enables a connection
- THEN its provider-neutral candidate and capability contracts become available to synchronization

#### Scenario: Tenant admin configures a provider
- GIVEN an organization administrator lacks platform authority
- WHEN provider configuration is attempted
- THEN the request is rejected without changes

#### Scenario: Connection is assigned to organization
- GIVEN a provider connection exists
- WHEN organization ownership is requested
- THEN the request is rejected because disclosure uses vehicle grants
