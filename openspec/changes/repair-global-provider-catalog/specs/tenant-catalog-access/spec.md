# Tenant Catalog Access Specification

## Purpose
Separate visibility from global ingestion.

## Requirements

### Requirement: Tenant access is assignment-only
Tenants MUST access only assigned global vehicles. Tenant, Company, and tenant fleet data MUST NOT influence ingestion, identity matching, placement, or source resolution.

#### Scenario: Tenant opens Live
- GIVEN global sources are resolved and the tenant has vehicle assignments
- WHEN Live is projected
- THEN only assigned vehicles are returned

#### Scenario: Tenant lacks assignment
- GIVEN a global vehicle exists without an assignment to the tenant
- WHEN that tenant queries Live
- THEN the vehicle is undisclosed
