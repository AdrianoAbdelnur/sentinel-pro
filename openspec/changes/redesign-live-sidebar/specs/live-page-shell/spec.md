# Delta for live-page-shell

## MODIFIED Requirements

### Requirement: Page composition unifies the operator surfaces

The system MUST compose the live page from the existing sidebar and bottom-panel use cases behind a single page contract. Page composition MUST accept a status filter and a provider filter and thread them to the sidebar use case unchanged.

(Previously: page composition threaded a single `onlyActiveOrOnline` boolean instead of a status filter and a provider filter.)

#### Replaces

`BuildLivePageViewModelInput.onlyActiveOrOnline` is replaced by a status filter and a provider filter, mirroring the same fields on `BuildLiveSidebarViewModelInput` in `live-operator-panels`. The boolean MUST NOT continue to exist.

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

#### Scenario: Status and provider filters flow to the sidebar unchanged

- GIVEN a status filter and a provider filter are supplied to page composition
- WHEN the page view model is composed
- THEN the sidebar section reflects those same two filter values, not a boolean

### Requirement: Live data is read through an explicit port

The system MUST read live operational data through a port that an in-memory source satisfies today and a provider adapter can satisfy later. Bottom-panel tabs and their columns MUST be identified by a stable key only; the port MUST NOT supply label text for a tab or a column. Delivery MUST resolve the displayed label for every tab and column key.

(Previously: did not state who supplies displayed labels for bottom-panel tabs and columns; the in-memory source's `readBottomPanelTabs()` returned a `label` string on every tab and every column, rendered verbatim by delivery.)

#### Replaces

`LiveBottomPanelTab.label` and `LiveTableColumn.label` are dropped from the port's return type; only `key` (plus `columns`/`rows` for tabs) remains. This is the same code-only boundary already applied to empty states in `live-operator-panels` and `live-map-rendering`: an integration supplies keys and data, delivery supplies words.

#### Scenario: In-memory source supplies operational state

- GIVEN the in-memory live data source
- WHEN live state is read
- THEN it returns fleets with their vehicle ids, and vehicles with device and telemetry data

#### Scenario: Source contains offline and GPS-less vehicles

- GIVEN the in-memory live data source
- WHEN live state is read
- THEN at least one vehicle is offline and at least one lacks valid GPS, so degraded states are visible during development

#### Scenario: Bottom-panel tabs and columns carry keys, not labels

- GIVEN the in-memory live data source
- WHEN bottom-panel tabs are read
- THEN every tab and every column exposes a stable key, and tabs also expose their columns and rows, but none of them carries a label string

#### Scenario: Delivery resolves the displayed label for every tab and column key

- GIVEN a bottom-panel tab or column key produced by the port
- WHEN the live screen renders it
- THEN delivery, not the data source, supplies the Spanish label shown for that key

### Requirement: Delivery renders view models without deriving business state

The live screen MUST render only what the view models expose and MUST NOT recompute selection, filtering, or availability rules. Delivery, not application, MUST supply the displayed text for every empty state and notice code.

(Previously: did not state who supplies displayed copy for empty states and notices; some use cases returned a `message` string alongside the code.)

#### Replaces

Complements the code-only contracts in `live-operator-panels` (bottom panel) and `live-map-rendering` (map panel): no view model in this composition carries a message string; delivery owns the wording.

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

#### Scenario: Delivery supplies the copy for every empty state and notice code

- GIVEN a composed view model whose empty state or notice carries only a code
- WHEN the live screen renders that code
- THEN delivery selects the displayed text for it, and no application-layer output for this page carries a message string
