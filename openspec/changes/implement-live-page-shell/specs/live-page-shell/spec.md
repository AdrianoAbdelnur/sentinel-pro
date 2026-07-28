# live-page-shell Specification

## Purpose

Define how the live operator screen is composed and delivered from internal view models, without provider knowledge in the delivery layer.

## Requirements

### Requirement: Page composition unifies the operator surfaces

The system MUST compose the live page from the existing sidebar and bottom-panel use cases behind a single page contract.

#### Scenario: Page view model exposes every surface

- GIVEN live state, a selection, a search term, and an active tab
- WHEN the page view model is composed
- THEN it returns the sidebar, the bottom panel, and a playback overlay section

#### Scenario: Composition delegates instead of duplicating rules

- GIVEN the same inputs are passed to the sidebar use case directly
- WHEN the page view model is composed
- THEN its sidebar section equals the sidebar use case output for those inputs

#### Scenario: Playback overlay starts closed

- GIVEN no playback has been requested
- WHEN the page view model is composed
- THEN the playback overlay is returned closed and without a notice

### Requirement: Live data is read through an explicit port

The system MUST read live operational data through a port that an in-memory source satisfies today and a provider adapter can satisfy later.

#### Scenario: In-memory source supplies operational state

- GIVEN the in-memory live data source
- WHEN live state is read
- THEN it returns fleets with their vehicle ids, and vehicles with device and telemetry data

#### Scenario: Source contains offline and GPS-less vehicles

- GIVEN the in-memory live data source
- WHEN live state is read
- THEN at least one vehicle is offline and at least one lacks valid GPS, so degraded states are visible during development

### Requirement: Delivery renders view models without deriving business state

The live screen MUST render only what the view models expose and MUST NOT recompute selection, filtering, or availability rules.

#### Scenario: Sidebar renders composed fleet nodes

- GIVEN a composed sidebar view model with two fleets
- WHEN the live screen renders
- THEN both fleet labels are visible and expanded fleets show their vehicles

#### Scenario: Collapsed fleets hide their vehicles

- GIVEN a fleet composed with `isExpanded = false`
- WHEN the live screen renders
- THEN that fleet's vehicle labels are not rendered

#### Scenario: Selecting a vehicle updates the bottom panel

- GIVEN the live screen rendered with no selection
- WHEN a vehicle checkbox is toggled on
- THEN the bottom panel replaces its empty state with a row for that vehicle

#### Scenario: Searching narrows the rendered fleets

- GIVEN the live screen rendered with in-memory data
- WHEN a search term matching a single vehicle plate is typed
- THEN only the fleet containing that vehicle is rendered, expanded

#### Scenario: Missing cell values render a fallback

- GIVEN a bottom-panel row whose cell value is `null`
- WHEN the live screen renders
- THEN the cell displays the fallback marker instead of an empty space

#### Scenario: Switching tabs keeps the selection

- GIVEN two vehicles are selected on the status tab
- WHEN the active tab changes to another tab
- THEN the same two vehicles are still rendered as rows
