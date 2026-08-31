# Specification: One-click provider catalog import

## Requirement: provider selection
The admin import page MUST display the supported provider choices using internal provider-neutral labels and MUST NOT expose provider-specific API behavior in the UI.

### Scenario: provider choices are available
- GIVEN an authorized administrator opens the import page
- WHEN the page renders
- THEN Cybermapa and Howen are available choices
- AND no provider credentials or secrets are rendered

## Requirement: one-click import
The import action MUST invoke the application import boundary for the selected provider and organization without requiring an internal connection ID from the administrator.

### Scenario: import succeeds
- GIVEN valid server-side credentials and MongoDB configuration
- WHEN the administrator starts an import
- THEN the server fetches the provider snapshot through its integration
- AND persists canonical companies, fleets, vehicles, and external identities according to existing matching rules
- AND returns counts and the synchronization status

### Scenario: provider failure
- GIVEN the provider request fails or returns an invalid snapshot
- WHEN the administrator starts an import
- THEN no invalid empty snapshot is reconciled as authoritative
- AND the page displays a safe translated failure

## Requirement: result visibility
The page MUST show processed, created, linked, reviewed, rejected, and absent counts when available, plus the last run status.

## Requirement: canonical Live composition
Live MUST load the tenant-scoped canonical catalog and project it through application/live after catalog import. The loader MUST preserve capability/source contracts and MUST NOT make UI decisions based on provider names.

### Scenario: imported vehicle appears in Live
- GIVEN a successful import created a canonical vehicle
- WHEN an authorized operator opens Live
- THEN the vehicle is available from the canonical catalog projection
- AND each physical canonical vehicle appears once

## Requirement: authorization and safety
Only an administrator may start imports. Provider credentials MUST remain server-only. A provider import MUST be scoped to the authenticated organization and MUST use the existing authorization and snapshot-integrity rules.

## Closed product decision
New provider-discovered Companies are created automatically in the authenticated organization. Ambiguous vehicle/fleet identity matches still follow existing review rules.
