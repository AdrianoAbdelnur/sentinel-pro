# Delta for Provider Fleet Binding

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
