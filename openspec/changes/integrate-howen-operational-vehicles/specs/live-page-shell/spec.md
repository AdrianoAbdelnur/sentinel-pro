# Delta for live-page-shell

## ADDED Requirements

### Requirement: Delivery renders generic source warnings

The live screen MUST render each application warning using its source label and generic delivery-owned copy. It MUST NOT inspect provider payloads, codes, or names to derive warning behavior.

#### Scenario: Partial failure warning accompanies data

- GIVEN a merged roster and a failed-source warning
- WHEN the live screen renders
- THEN successful vehicles remain visible
- AND generic warning copy identifies the failed source label

#### Scenario: Total failure shows warnings without roster

- GIVEN the aggregate has no successful state and multiple warnings
- WHEN the live screen renders
- THEN no roster is shown
- AND every failed source label is visible in generic warning copy

#### Scenario: Canonical provider identity is rendered verbatim

- GIVEN normalized vehicles use the provider value `HOWEN`
- WHEN provider filters and badges render
- THEN they use `HOWEN` as their underlying value and visible label
- AND delivery does not branch on Howen
