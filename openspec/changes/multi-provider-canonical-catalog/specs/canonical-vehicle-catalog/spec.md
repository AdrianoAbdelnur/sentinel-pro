# Canonical Vehicle Catalog Specification

## Purpose
Define the tenant-owned `Company -> Fleet -> Vehicle` business hierarchy.

## Requirements

### Requirement: Tenant owns catalog companies
Every catalog Company MUST belong to one identity Organization tenant. Every Fleet MUST belong to one Company and every Vehicle to one Fleet. Mutations MUST require an authorized tenant administrator; reads MUST remain tenant-scoped.

#### Scenario: Admin creates native hierarchy
- GIVEN an authorized tenant administrator
- WHEN a Company, Fleet, and Vehicle are created
- THEN canonical records exist without provider identities

#### Scenario: Cross-tenant access is attempted
- GIVEN another tenant owns a Company
- WHEN its hierarchy is read or mutated
- THEN it remains undisclosed and unchanged

### Requirement: Unassigned fleet belongs to Company
Each Company MUST have at most one system-managed `Unassigned` Fleet. It MUST be administratively visible and accept vehicles lacking trustworthy provider hierarchy.

#### Scenario: Import lacks fleet hierarchy
- GIVEN a bound Company and unmatched vehicle candidate
- WHEN the vehicle is created
- THEN it enters that Company's `Unassigned` Fleet

#### Scenario: Admin assigns a real Fleet
- GIVEN an imported Vehicle was moved from `Unassigned`
- WHEN provider synchronization repeats
- THEN the administrator's Fleet assignment remains

#### Scenario: Vehicle lacks preferred provider
- GIVEN a native or other-provider-only Vehicle
- WHEN the Company catalog is listed
- THEN the Vehicle remains valid and visible
