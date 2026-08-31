# Delta for Provider Company Binding

## REMOVED Requirements

### Requirement: External companies are staged inside a tenant
(Reason: Provider company data is a contribution, not global vehicle ownership.)
(Migration: Preserve it as provider metadata where useful.)

### Requirement: Company binding is explicit
(Reason: Company binding MUST NOT gate global identity matching.)
(Migration: Tenant visibility uses access assignments.)

## ADDED Requirements

### Requirement: Business company is separate from authorization
Canonical business company and provider-observed companies MUST belong to vehicle catalog facts and MUST NOT define identity `Organization`, tenant authorization, or vehicle ownership. Every non-empty source value MUST remain inspectable.

#### Scenario: Tenant and business company differ
- GIVEN tenant access and provider company evidence use different names
- WHEN the catalog is read
- THEN authorization is unchanged and business company evidence is preserved

### Requirement: Company conflicts are explicit
The system MUST select canonical company by configured source precedence and MUST retain an explicit conflict whenever normalized current non-empty observations disagree. Priority MUST NOT erase or silently resolve disagreement.

#### Scenario: Priority source disagrees
- GIVEN Cybermapa and Howen report different current companies
- WHEN reconciliation runs
- THEN Cybermapa is canonical initially and a conflict retains both observations
