# Provider Fleet Binding Specification

## Purpose
Define provider Fleet metadata and conservative group evidence.

## Requirements

### Requirement: Provider fleet memberships are independent
Each current provider fleet membership MUST be stored with provider identity and MUST NOT prove vehicle identity or alter existing Sentinel placement. Fleet labels MUST NOT auto-merge fleets. Synchronization MUST replace that contribution's prior current membership and MUST retain direct fleet identity plus any distinct company-source fleet identity and resolution outcome.
(Previously: Memberships were independent but replacement and company-resolution provenance were undefined.)

#### Scenario: Providers disagree on fleets
- GIVEN one vehicle belongs to differently named provider fleets
- WHEN both contributions synchronize
- THEN one vehicle retains both current memberships and its Sentinel placement

#### Scenario: Provider moves a vehicle
- GIVEN a contribution has an existing fleet membership
- WHEN a complete sync reports a different fleet
- THEN the new membership replaces the old one for that contribution

### Requirement: Group evidence resolves conservatively

`GroupEvidenceBinding` MUST persist in `group_evidence_bindings` and bind `(connectionId, kind, externalKey)` to one `CatalogGroup`, retaining label and authority. Resolution MUST prefer an exact stable binding, then a unique normalized label. Multiple bindings or groups MUST retain the existing pending manual review for ambiguous group evidence rather than merge.

#### Scenario: Stable evidence repeats
- GIVEN one evidence key is bound to a group
- WHEN it appears with an updated label
- THEN the same group is resolved and only evidence metadata changes

#### Scenario: Label is ambiguous
- GIVEN a normalized label matches multiple groups
- WHEN group evidence is resolved
- THEN no placement or merge occurs
- AND a pending manual review records the ambiguous group evidence
