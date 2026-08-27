# Provider Vehicle Observations Specification

## Purpose

Preserve current source facts and reconcile canonical projections without erasing disagreement.

## Requirements

### Requirement: Current observations retain provenance

For each provider contribution, the system MUST retain available observed plate, vehicle name/make/model, company, direct fleet, company-source fleet, resolution outcome, and observation time. A later complete observation MUST replace that contribution's mutable current facts while preserving source identity and explainable provenance.

#### Scenario: Provider facts change
- GIVEN a current observation
- WHEN the same contribution reports changed facts in a complete sync
- THEN its current observation is replaced and other providers' observations remain

### Requirement: Canonical reconciliation is deterministic and safe

Canonical fields MUST be selected from current non-empty observations by provider-neutral configured precedence; initial company precedence MUST rank Cybermapa before Howen. All observations MUST remain inspectable. Differing normalized non-empty company values MUST create or refresh an explicit conflict containing the evidence and selected canonical outcome; ambiguous evidence MUST NOT cause a silent merge or invented value.

#### Scenario: Companies disagree
- GIVEN Cybermapa reports Company A and Howen reports Company B
- WHEN canonical company is reconciled
- THEN Company A is selected, both values remain visible, and a conflict is retained

#### Scenario: Only Howen reports company
- GIVEN Howen is the only current non-empty company source
- WHEN its company changes
- THEN the canonical company changes to the current Howen value

