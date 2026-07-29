# live-operator-panels Specification

## Purpose

Define the application behavior that composes the live sidebar and bottom panel from normalized internal state.

## Requirements

### Requirement: Sidebar composition stays operational and provider-agnostic

The system MUST compose the sidebar from fleet and vehicle operational state without leaking provider logic into delivery.

#### Scenario: Fleets start collapsed

- GIVEN live fleet data is composed for first render
- WHEN no explicit expansion override exists
- THEN each fleet is returned with `isExpanded = false`

#### Scenario: Fleet selection reflects child vehicle selection

- GIVEN a fleet contains selected and unselected vehicles
- WHEN the sidebar view model is composed
- THEN the fleet checkbox state reflects whether all child vehicles are selected

#### Scenario: Search expands matching fleets

- GIVEN a search term matches a fleet or one of its vehicles
- WHEN the sidebar view model is composed
- THEN matching fleets are expanded and non-matching fleets are dropped

#### Scenario: A vehicle-level match narrows the fleet

- GIVEN a search term matches some vehicles of a fleet but not the fleet label
- WHEN the sidebar view model is composed
- THEN only the matching vehicles of that fleet remain visible

#### Scenario: A fleet-label match keeps the whole fleet visible

- GIVEN a search term matches the fleet label itself
- WHEN the sidebar view model is composed
- THEN every vehicle of that fleet remains visible, even those that do not match the term

#### Scenario: Search matches labels and plates only

- GIVEN a search term
- WHEN vehicles are matched against it
- THEN it is compared against the vehicle label, the vehicle plate, and the fleet label, ignoring case and surrounding whitespace, and never against `internalCode`

#### Scenario: Fleet selection state ignores search filtering

- GIVEN a search term hides some selected vehicles of a fleet
- WHEN the sidebar view model is composed
- THEN the fleet checkbox state still reflects all of its vehicles, not only the visible ones

### Requirement: Bottom panel composition preserves selected-vehicle context

The system MUST compose bottom-panel tabs from selected vehicles even when some rows have partial data.

#### Scenario: No selection returns empty state

- GIVEN no vehicles are selected
- WHEN the bottom panel view model is composed
- THEN it returns empty state `no-selection`

#### Scenario: Selected vehicles produce rows with fallback cells

- GIVEN selected vehicles exist and some tab cells are missing
- WHEN the bottom panel view model is composed
- THEN each selected vehicle still appears and missing values are represented as `null` for delivery fallback rendering

#### Scenario: Active tab changes dataset, not selection scope

- GIVEN multiple vehicles are selected
- WHEN the active bottom-panel tab changes
- THEN the composed rows keep the same selected vehicle scope for that tab dataset
