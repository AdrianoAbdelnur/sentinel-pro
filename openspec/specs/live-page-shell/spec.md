# live-page-shell Specification

## Purpose

Define how the live operator screen is composed and delivered from internal view models, without provider knowledge in the delivery layer.

## Requirements

### Requirement: Page composition unifies the operator surfaces

The system MUST compose sidebar, bottom panel, and playback contract, passing scalar status and provider filters unchanged.

(Previously: composition passed one `onlyActiveOrOnline` boolean.)

#### Scenario: Page exposes every surface
- GIVEN live state and operator inputs
- WHEN composition runs
- THEN sidebar, bottom panel, and playback sections are returned

#### Scenario: Composition delegates rules
- GIVEN identical sidebar inputs
- WHEN page and sidebar composition run
- THEN their sidebar outputs match

#### Scenario: Playback starts closed
- GIVEN no playback request
- WHEN composition runs
- THEN playback is closed without a notice

#### Scenario: Filters flow unchanged
- GIVEN scalar status and provider values
- WHEN composition runs
- THEN the sidebar receives both values
### Requirement: Live data is read through an explicit port

The system MUST read normalized operational data through a replaceable port. Tabs MUST expose their stable application keys, columns MUST allow arbitrary stable string keys, and neither contract MUST carry labels. Delivery MUST use Spanish copy for known keys and raw-key fallback for unknown columns.

(Previously: the port supplied labels, then the delta overclaimed exhaustive Spanish copy.)

#### Scenario: In-memory source supplies state
- GIVEN the in-memory source
- WHEN state is read
- THEN fleets, vehicles, devices, and telemetry are returned

#### Scenario: Source includes degraded states
- GIVEN the in-memory source
- WHEN state is read
- THEN offline and GPS-less vehicles exist

#### Scenario: Port output is key-only
- GIVEN bottom-panel data
- WHEN tabs are read
- THEN tabs expose stable application keys and columns expose arbitrary stable string keys
- AND neither tabs nor columns expose labels

#### Scenario: Delivery has raw-key fallback
- GIVEN a bottom-panel key
- WHEN it renders
- THEN known keys use Spanish copy and an unknown column uses its raw key
### Requirement: Delivery renders view models without deriving business state

The live screen MUST NOT recompute selection, filtering, or availability. It MUST own copy for rendered map and bottom-panel codes. Playback codes MAY exist in application contracts, but playback-notice UI is deferred until a playback monitor exists. The sidebar MUST retain `w-72`.

(Previously: the delta claimed every notice, including playback, was rendered.)

#### Scenario: Sidebar renders fleet nodes
- GIVEN two composed fleets
- WHEN delivery renders
- THEN both labels appear and expanded fleets show vehicles

#### Scenario: Fleet labels remain compact
- GIVEN a long mixed-case fleet label
- WHEN the `w-72` sidebar renders
- THEN it stays on one truncated line without forced uppercase or wide tracking

#### Scenario: Collapsed fleets hide vehicles
- GIVEN a collapsed fleet
- WHEN delivery renders
- THEN its vehicles are hidden

#### Scenario: Selection updates the bottom panel
- GIVEN no initial selection
- WHEN a vehicle is selected
- THEN its bottom-panel row appears

#### Scenario: Search narrows rendered fleets
- GIVEN a unique matching plate
- WHEN it is searched
- THEN only its expanded fleet appears

#### Scenario: Missing cells show fallback
- GIVEN a `null` cell
- WHEN delivery renders
- THEN a fallback marker appears

#### Scenario: Tab switch preserves selection
- GIVEN two selected vehicles
- WHEN tabs switch
- THEN both remain selected

#### Scenario: Rendered codes use delivery copy
- GIVEN a map or bottom-panel code
- WHEN delivery renders it
- THEN delivery selects the text and application supplies no message

#### Scenario: Playback notices remain deferred
- GIVEN an application playback notice code
- WHEN the screen has no playback monitor
- THEN no playback-notice UI renders

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
