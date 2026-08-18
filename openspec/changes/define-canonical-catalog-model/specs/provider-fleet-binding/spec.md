# Delta for Provider Fleet Binding

## MODIFIED Requirements

### Requirement: Provider fleet memberships are independent

`ProviderFleetMembership` MUST persist in `provider_fleet_memberships`, unique by `(connectionId, externalFleetId, vehicleId)`, and associate a vehicle with a provider-reported fleet ID and label within one connection. Membership MUST remain metadata/evidence: it MUST NOT prove vehicle identity, become a `CatalogGroup`, grant organization access, or directly determine Live grouping.
(Previously: Membership independence did not define the definitive collection or all prohibited ownership effects.)

#### Scenario: Providers disagree on fleets
- GIVEN one vehicle has contributions in differently named provider fleets
- WHEN both memberships are stored
- THEN one vehicle retains both metadata records
- AND its canonical group is unchanged

#### Scenario: Provider label changes
- GIVEN stable fleet external evidence exists
- WHEN its reported label changes
- THEN only evidence metadata is updated
- AND no canonical group is renamed or merged

## ADDED Requirements

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
