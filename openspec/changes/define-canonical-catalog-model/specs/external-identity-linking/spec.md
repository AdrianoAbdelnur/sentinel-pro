# Delta for External Identity Linking

## MODIFIED Requirements

### Requirement: Vehicle identities are globally provider scoped

The system MUST resolve an existing `ProviderContribution` by `(connectionId, externalId)` before any plate match, reuse its `CatalogVehicle`, and permit contributions from multiple connections to reference that vehicle.
(Previously: External identity used rollout terminology and a parallel entity-kind key.)

#### Scenario: Contribution repeats
- GIVEN a contribution already links a vehicle
- WHEN its external identity appears again
- THEN the same vehicle and contribution are reused

### Requirement: Plate matching is global and exact

For a new contribution, the system MUST auto-link only one exact trustworthy normalized plate match without a connection conflict. A valid unmatched plate MAY create a vehicle only when group placement resolves. Missing, malformed, conflicting, or ambiguous evidence MUST retain one pending manual review and MUST NOT merge or create a vehicle.
(Previously: Matching targeted rollout-named global entities.)

#### Scenario: Exact plate matches once
- GIVEN one eligible vehicle has the trustworthy normalized plate
- WHEN the candidate is evaluated
- THEN the contribution links that vehicle

#### Scenario: Evidence is unsafe
- GIVEN plate or placement evidence is missing, malformed, conflicting, or ambiguous
- WHEN the candidate is evaluated
- THEN one pending review is retained without a merge or new vehicle

#### Scenario: Valid unmatched evidence creates a vehicle
- GIVEN a trustworthy plate has no match and placement resolves unambiguously
- WHEN the candidate is evaluated
- THEN one vehicle and contribution are created in the resolved group

### Requirement: Existing manual review behavior targets the canonical catalog

The manual review flow MUST use `CatalogReview` in `catalog_reviews`, select only currently supported canonical vehicle or group targets, preserve its current authorization boundary, and MUST NOT overwrite a resolved decision. This consolidation MUST NOT add review subjects, audit fields, or resolution cases.
(Previously: Manual review targeted the parallel organization-owned catalog.)

#### Scenario: Unauthorized actor resolves review
- GIVEN a pending catalog review
- WHEN an actor outside the existing authorization boundary submits a resolution
- THEN it is rejected without catalog changes

#### Scenario: Resolved review is submitted again
- GIVEN a review was resolved to one target
- WHEN another target is submitted
- THEN the existing decision remains unchanged
