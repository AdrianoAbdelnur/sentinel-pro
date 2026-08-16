# Delta for Provider Company Binding

## REMOVED Requirements

### Requirement: External companies are staged inside a tenant
(Reason: Provider company data is a contribution, not global vehicle ownership.)
(Migration: Preserve it as provider metadata where useful.)

### Requirement: Company binding is explicit
(Reason: Company binding MUST NOT gate global identity matching.)
(Migration: Tenant visibility uses access assignments.)
