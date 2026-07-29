# Delta for live-operator-panels

## MODIFIED Requirements

### Requirement: Sidebar composition stays operational and provider-agnostic

The system MUST compose provider-agnostic fleets with full-roster `online/total` counts. Vehicles MUST lead with plate when present and expose status, report time, provider, and non-offline speed. The composed search contract MUST carry only its term.

#### Scenario: Fleets start collapsed
- GIVEN no expansion override
- WHEN the sidebar is composed
- THEN every fleet is collapsed

#### Scenario: Fleet selection reflects children
- GIVEN mixed selection
- WHEN composition runs
- THEN fleet selection reflects all children

#### Scenario: Search expands matches
- GIVEN a fleet or vehicle matches
- WHEN search is applied
- THEN matching fleets expand and others disappear

#### Scenario: Vehicle match narrows fleet
- GIVEN only some vehicles match
- WHEN search is applied
- THEN only matching vehicles remain

#### Scenario: Fleet match keeps roster
- GIVEN the fleet label matches
- WHEN search is applied
- THEN its full roster remains

#### Scenario: Search boundaries
- GIVEN a normalized search term
- WHEN matching runs
- THEN fleet label, vehicle label, and plate are searched case-insensitively
- AND internal codes, providers, device identifiers, and unrelated fields are ignored

#### Scenario: Selection ignores search
- GIVEN search hides selected children
- WHEN composition runs
- THEN fleet selection still uses the full roster

#### Scenario: Vehicles are plate-first
- GIVEN a vehicle has a plate
- WHEN composition runs
- THEN the node exposes plate, status, report time, speed, and provider

#### Scenario: Missing plate keeps a usable primary label
- GIVEN a vehicle has no plate
- WHEN delivery renders its composed node
- THEN the vehicle label is used as the primary identifier

#### Scenario: Missing telemetry
- GIVEN no telemetry
- WHEN composition runs
- THEN report time and speed are absent and status is `offline`

#### Scenario: Counts ignore filters
- GIVEN filters hide roster members
- WHEN composition runs
- THEN `total` counts the full roster and `online` counts its non-offline members

#### Scenario: Empty fleet counts
- GIVEN an empty unfiltered fleet
- WHEN composition runs
- THEN it remains with zero counts

#### Scenario: Offline speed is suppressed
- GIVEN offline telemetry stores positive speed
- WHEN composition runs
- THEN node speed is absent

#### Scenario: Missing offline speed
- GIVEN offline telemetry has no speed
- WHEN composition runs
- THEN node speed is absent

#### Scenario: Online zero speed is preserved
- GIVEN status is `stopped` at zero speed
- WHEN composition runs
- THEN node speed is `0`

### Requirement: Bottom panel composition preserves selected-vehicle context

The system MUST compose key-only tabs and columns for selected vehicles. Empty state MUST carry only a code; missing cells MUST be `null`.

#### Scenario: No selection is code-only
- GIVEN no selection
- WHEN composition runs
- THEN empty state is code `no-selection` without a message

#### Scenario: Partial rows
- GIVEN selected vehicles have missing cells
- WHEN composition runs
- THEN all vehicles remain and missing cells are `null`

#### Scenario: Tabs preserve scope
- GIVEN multiple selected vehicles
- WHEN the active tab changes
- THEN row scope remains unchanged

#### Scenario: Key-only schema
- GIVEN the source supplies keys only
- WHEN composition runs
- THEN no tab or column label is introduced

## ADDED Requirements

### Requirement: Scalar status and provider filters narrow the sidebar

The system MUST combine one scalar status (`all | en-route | stopped | offline`), one provider, and search. Active filters MUST drop empty visible fleets.

#### Scenario: Scalar status
- GIVEN mixed derived statuses
- WHEN status is `stopped`
- THEN only stopped vehicles remain and no second status is active

#### Scenario: Provider filter
- GIVEN multiple providers
- WHEN one provider is selected
- THEN only matching vehicles remain

#### Scenario: Missing device
- GIVEN a vehicle has no device
- WHEN a specific provider is selected
- THEN that vehicle is excluded

#### Scenario: Default filters
- GIVEN status and provider are `all`
- WHEN composition runs
- THEN neither filter excludes vehicles
