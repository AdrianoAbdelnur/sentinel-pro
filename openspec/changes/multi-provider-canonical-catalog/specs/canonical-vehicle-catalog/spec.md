# Canonical Vehicle Catalog Specification

## Purpose
Define Sentinel-owned fleets and vehicles.

## Requirements

### Requirement: Organization owns the catalog
Every record MUST belong to one organization. Access MUST use the authorized active organization; creation MUST require an administrator.

#### Scenario: Admin creates native records
- GIVEN an authorized administrator
- WHEN a fleet and vehicle are created
- THEN canonical records exist without provider identities

#### Scenario: Creation is forbidden
- GIVEN an operator or unauthenticated caller
- WHEN creation is requested
- THEN no state changes

#### Scenario: Tenant isolation applies
- GIVEN another organization owns records
- WHEN they are read or mutated
- THEN they remain undisclosed and unchanged

### Requirement: Canonical records survive sources
Native and provider-only vehicles MUST remain valid. Synchronization MUST NOT silently rename fleets or move vehicles.

#### Scenario: Provider-only vehicle arrives
- GIVEN an unambiguous import has no match
- WHEN it is accepted
- THEN one canonical vehicle and source link remain

#### Scenario: Source structure changes
- GIVEN a linked source changes label or fleet
- WHEN synchronization runs
- THEN canonical name and placement remain unchanged
