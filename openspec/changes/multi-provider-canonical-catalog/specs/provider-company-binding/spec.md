# Provider Company Binding Specification

## Purpose
Bind external company candidates to canonical catalog Companies.

## Requirements

### Requirement: External companies are staged inside a tenant
Each provider connection MUST belong to one identity Organization tenant. A company candidate MUST be keyed by tenant, connection, and normalized external label. Staging MUST NOT create an identity Organization, user, or membership.

#### Scenario: New Cybermapa company appears
- GIVEN an unrecognized `nombre_empresa` on a tenant connection
- WHEN imported
- THEN one unbound catalog-company candidate is staged

#### Scenario: Candidate repeats
- GIVEN the same normalized label and connection already exist
- WHEN import repeats
- THEN no duplicate candidate is created

#### Scenario: Connections share a label
- GIVEN two tenant connections report one normalized label
- WHEN imported
- THEN separate candidates remain

### Requirement: Company binding is explicit
Only an authorized tenant administrator MUST bind a candidate by selecting or creating a canonical catalog Company in that tenant. Binding MUST NOT infer identity records.

#### Scenario: Admin binds existing Company
- GIVEN an unbound candidate
- WHEN an authorized tenant administrator selects a Company
- THEN later provider records resolve inside that Company

#### Scenario: Admin creates and binds Company
- GIVEN an unbound candidate has no canonical Company
- WHEN the administrator creates and binds one
- THEN a catalog Company exists without new identity users or memberships

#### Scenario: Unauthorized binding is attempted
- GIVEN an operator or another tenant's administrator
- WHEN binding is requested
- THEN candidate and Company remain unchanged
