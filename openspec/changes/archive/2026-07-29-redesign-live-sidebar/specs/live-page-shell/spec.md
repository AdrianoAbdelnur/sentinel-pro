# Delta for live-page-shell

## MODIFIED Requirements

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
