# Delta for live-map-rendering

## MODIFIED Requirements

### Requirement: The map is always present, and empty states are overlaid on it

The map MUST remain mounted regardless of the view model's empty state. Empty states MUST render as notices overlaid on the live map, never as substitutes for it. The panel MUST own the displayed text for each empty-state code; the view model MUST carry only the code.

(Previously: the view model's `emptyState` carried both `code` and `message`, and the panel displayed the supplied `message` directly.)

#### Replaces

`LiveMapViewModel.emptyState` drops `message`; only `code` (`no-selection` | `no-mappable-selection`) remains. The panel, not the view model, selects the text shown for each code.

#### Scenario: No selection still shows the map

- GIVEN a map view model with empty state code `no-selection`
- WHEN the map panel renders
- THEN the map is rendered
- AND text the panel itself owns for that code is overlaid on it

#### Scenario: Selection without GPS still shows the map

- GIVEN a map view model with empty state code `no-mappable-selection`
- WHEN the map panel renders
- THEN the map is rendered
- AND text the panel itself owns for that code is overlaid on it

#### Scenario: Markers present render the map without a notice

- GIVEN a map view model with at least one marker and no empty state
- WHEN the map panel renders
- THEN the map is rendered
- AND no empty-state notice is shown

### Requirement: Scrolling is contained within each panel

Long content MUST scroll inside its own panel. The document itself MUST NOT scroll, and the sidebar's search and filters MUST remain outside the scrolling fleet-list region so scrolling vehicles never moves the map or controls out of view.

(Previously: required panel-contained scrolling without explicitly preserving the sidebar controls outside the independently scrolling list region.)

#### Scenario: The vehicle list scrolls on its own

- GIVEN a fleet list taller than the viewport
- WHEN the list is scrolled
- THEN only the sidebar's list region scrolls
- AND the search, filters, and map remain fixed
