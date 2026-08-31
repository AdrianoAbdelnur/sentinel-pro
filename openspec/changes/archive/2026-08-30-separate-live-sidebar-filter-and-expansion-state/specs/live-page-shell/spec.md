# Delta for live-page-shell

## ADDED Requirements

### Requirement: Sidebar filtering and fleet expansion are independent

The system MUST determine sidebar visibility from provider, status, and search filters. It MUST project each fleet's expanded state independently from the current expansion-state input. A filter change MUST NOT open, close, or otherwise alter any fleet's expansion state. Separate page-loading behavior MAY initialize expansion as defined by the active pagination contract.

#### Scenario: Filtering preserves collapsed fleets
- GIVEN all fleets are collapsed
- WHEN the operator changes provider, status, or search filters
- THEN matching fleets may remain visible
- AND every visible matching fleet remains collapsed

#### Scenario: Status filtering preserves an opened fleet
- GIVEN the operator has explicitly opened a fleet
- WHEN the operator changes the status filter
- THEN the fleet remains open if it remains visible
- AND its matching vehicle rows remain visible

#### Scenario: Provider filtering preserves an opened fleet
- GIVEN the operator has explicitly opened a fleet
- WHEN the operator changes the provider filter
- THEN the fleet remains open if it remains visible
- AND its matching vehicle rows remain visible

#### Scenario: Search filtering preserves an opened fleet
- GIVEN the operator has explicitly opened a fleet
- WHEN the operator changes the search query
- THEN the fleet remains open if it remains visible
- AND its matching vehicle rows remain visible

#### Scenario: Closing remains effective across filters
- GIVEN the operator has explicitly closed a fleet
- WHEN the operator changes provider, status, or search filters
- THEN the fleet remains closed whenever it is visible
- AND its vehicle rows are not shown

#### Scenario: Filters hide without expanding
- GIVEN one or more filters exclude fleets or vehicles
- WHEN the sidebar renders filtered results
- THEN excluded entries are hidden
- AND no remaining fleet is expanded unless explicitly opened

#### Scenario: Filters never mutate expansion
- GIVEN any combination of provider, status, and search filters
- WHEN the operator changes a filter without toggling a fleet
- THEN no fleet expansion state changes
- AND the sidebar projects the existing expansion-state input unchanged
