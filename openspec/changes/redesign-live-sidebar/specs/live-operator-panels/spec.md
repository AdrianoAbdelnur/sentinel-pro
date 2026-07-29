# Delta for live-operator-panels

## MODIFIED Requirements

### Requirement: Sidebar composition stays operational and provider-agnostic

The system MUST compose the sidebar from fleet and vehicle operational state without leaking provider logic into delivery. Each vehicle node MUST lead with the vehicle's plate as its primary identifier and MUST carry its derived status, last report timestamp, speed, and device provider label. Each fleet node's `counts` MUST be populated with the fleet's full roster totals. When a vehicle's derived status is `offline`, its node MUST NOT expose a speed value, regardless of what the telemetry record stores; an online vehicle's speed MUST be exposed as reported, including a genuine `0`. The composed `search` value MUST carry only the search term; it MUST NOT carry a placeholder or any other display text.

(Previously: vehicle nodes exposed only `label`, `secondaryLabel`, `isOnline`, and `hasValidGps`; `LiveFleetNode.counts` was typed but never populated; `search` also carried a hardcoded English `placeholder`.)

#### Replaces

Drops `LiveSidebarViewModel.search.placeholder` — the placeholder is component-local display text, not application output. Also tightens the vehicle node contract: a node's speed is a derived value, not a copy of telemetry — it MUST be suppressed whenever status is `offline`, so an operator never reads a moving speed next to an "offline" badge.

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

#### Scenario: Vehicle node leads with plate and carries the new operational fields

- GIVEN a vehicle has a plate, a derived status, a last report timestamp, a speed, and a device provider
- WHEN the sidebar view model is composed
- THEN the vehicle node exposes the plate as its primary label, plus status, last report timestamp, speed, and a provider label

#### Scenario: Missing telemetry renders absent fields, not zeroes

- GIVEN a vehicle has no telemetry record at all
- WHEN the sidebar view model is composed
- THEN its node has no last report timestamp and no speed, and its status is `offline`

#### Scenario: Fleet counts reflect the full roster regardless of active filters

- GIVEN a fleet has vehicles with mixed statuses and a status filter narrows the visible list
- WHEN the sidebar view model is composed
- THEN the fleet's counts reflect every vehicle assigned to the fleet, not only the ones currently visible

#### Scenario: An empty fleet reports zero counts

- GIVEN a fleet has no vehicle ids assigned and no filter is active
- WHEN the sidebar view model is composed
- THEN it is still returned, with counts of zero and no vehicles

#### Scenario: An offline vehicle never exposes a speed, even with a non-zero stored value

- GIVEN a vehicle's derived status is `offline` and its stale telemetry stores `speedKmH` greater than 0
- WHEN the sidebar view model is composed
- THEN the vehicle node's speed is absent

#### Scenario: An offline vehicle with no stored speed still exposes no speed

- GIVEN a vehicle's derived status is `offline` and its telemetry has no `speedKmH` at all
- WHEN the sidebar view model is composed
- THEN the vehicle node's speed is absent

#### Scenario: An online vehicle at zero speed still renders as stopped with its zero

- GIVEN a vehicle's derived status is `stopped` because its telemetry reports `speedKmH` equal to 0
- WHEN the sidebar view model is composed
- THEN the vehicle node's speed is `0`, not absent

### Requirement: Bottom panel composition preserves selected-vehicle context

The system MUST compose bottom-panel tabs from selected vehicles even when some rows have partial data. The empty state MUST carry a code only; it MUST NOT carry a message string. Composed tabs and columns MUST retain only the keys supplied by the data source; composition MUST NOT introduce label text of its own.

(Previously: `emptyState` was `{ code: "no-selection", message: string }`; delivery consumed the message directly. Composed tabs also carried the `label` strings supplied by the data source unchanged.)

#### Replaces

Drops `LiveBottomPanelViewModel.emptyState.message`. Delivery selects the displayed text for `no-selection` from the code alone. Composed `LiveBottomPanelTab`/`LiveTableColumn` entries drop `label`, mirroring the same change at the port in `live-page-shell`.

#### Scenario: No selection returns a code-only empty state

- GIVEN no vehicles are selected
- WHEN the bottom panel view model is composed
- THEN it returns empty state code `no-selection` with no message field

#### Scenario: Selected vehicles produce rows with fallback cells

- GIVEN selected vehicles exist and some tab cells are missing
- WHEN the bottom panel view model is composed
- THEN each selected vehicle still appears and missing values are represented as `null` for delivery fallback rendering

#### Scenario: Active tab changes dataset, not selection scope

- GIVEN multiple vehicles are selected
- WHEN the active bottom-panel tab changes
- THEN the composed rows keep the same selected vehicle scope for that tab dataset

#### Scenario: Composed bottom panel tabs carry no label text

- GIVEN tabs supplied by the data source carry keys only
- WHEN the bottom panel view model is composed
- THEN the composed tabs and columns still carry only keys, and rows are scoped to selected vehicles as usual

## ADDED Requirements

### Requirement: Status and provider filters narrow the visible sidebar

The system MUST filter vehicles by a status filter (`all | en-route | stopped | offline`, matched against the vehicle's derived status) and independently by a provider filter (`all` or a specific device provider value), combined with the existing search term. A fleet MUST be dropped from the result when any filter is active and it has no visible vehicles left, consistent with existing search-driven fleet dropping.

#### Replaces

Retires the single `onlyActiveOrOnline` boolean: `BuildLiveSidebarViewModelInput.onlyActiveOrOnline` and `LiveSidebarViewModel.filters.onlyActiveOrOnline` are removed. `filters` becomes `{ status, provider }`. The boolean MUST NOT continue to exist alongside these two filters.

#### Scenario: Status filter narrows by derived status

- GIVEN vehicles with statuses `en-route`, `stopped`, and `offline`
- WHEN the status filter is set to `stopped`
- THEN only vehicles whose derived status is `stopped` remain visible

#### Scenario: Provider filter narrows by device provider

- GIVEN vehicles reporting different device providers
- WHEN the provider filter is set to one specific provider value
- THEN only vehicles whose device provider matches that value remain visible

#### Scenario: A vehicle without a device is excluded by any specific provider filter

- GIVEN a vehicle has no device record at all
- WHEN the provider filter is set to any value other than `all`
- THEN that vehicle is excluded from the visible list

#### Scenario: Default filters show every vehicle

- GIVEN the status filter is `all` and the provider filter is `all`
- WHEN the sidebar view model is composed
- THEN no vehicle is excluded by status or provider
