# Delta for Tenant Catalog Access

## RENAMED Requirements

### Requirement: Tenant access is assignment-only → Organization access is membership and grant based

(Reason: Organization is the definitive authorization and disclosure boundary.)

## MODIFIED Requirements

### Requirement: Organization access is membership and grant based

`Organization`, `User`, and `OrganizationMembership` MUST persist in `organizations`, `users`, and `organization_memberships`. Users are global identities; an active membership grants an organization role. `OrganizationVehicleAccess` MUST persist in `organization_vehicle_access`, unique by `(organizationId, vehicleId)`. A request MUST disclose only vehicles granted to its active organization, and grants MUST NOT influence ingestion, matching, placement, or source policy.
(Previously: Assignment-only access did not define membership, collection names, or grant uniqueness.)

#### Scenario: Active member opens Live
- GIVEN a user has active membership and the organization has vehicle grants
- WHEN Live is requested for that organization
- THEN only granted vehicles are disclosed

#### Scenario: Membership is absent
- GIVEN a user lacks active membership in the requested organization
- WHEN catalog access is attempted
- THEN catalog existence and grants remain undisclosed

#### Scenario: Grant belongs to another organization
- GIVEN a vehicle is granted only to another organization
- WHEN the active organization queries the catalog
- THEN that vehicle is undisclosed

## ADDED Requirements

### Requirement: Organization roles have bounded authority

Organization administrators MAY manage memberships and consume granted catalog data. Organization operators MAY consume granted data. Platform-authorized actors manage vehicle access grants. Organization roles MUST NOT configure providers, run imports, resolve catalog reviews, change source policy, or manage grants unless separately platform-authorized.

#### Scenario: Organization admin changes provider configuration
- GIVEN an organization administrator lacks platform authority
- WHEN provider configuration is attempted
- THEN the request is rejected without changes
