# Delta for live-map-rendering

## MODIFIED Requirements

### Requirement: The map panel renders empty states without loading the map

The system MUST render map empty states as plain content, so no map library is initialised when there is nothing to plot. The panel MUST own the displayed text for each empty-state code; the view model MUST carry only the code.

(Previously: the view model's `emptyState` carried both `code` and `message`, and the panel displayed the supplied `message` directly.)

#### Replaces

`LiveMapViewModel.emptyState` drops `message`; only `code` (`no-selection` | `no-mappable-selection`) remains. The panel, not the view model, selects the text shown for each code.

#### Scenario: No selection renders the panel's own text for that code

- GIVEN a map view model with empty state code `no-selection`
- WHEN the map panel renders
- THEN it displays text the panel itself owns for that code, not a value read from the view model, and no map container is rendered

#### Scenario: Selection without GPS renders the panel's own text for that code

- GIVEN a map view model with empty state code `no-mappable-selection`
- WHEN the map panel renders
- THEN it displays text the panel itself owns for that code, and no map container is rendered

#### Scenario: Markers present render the map

- GIVEN a map view model with at least one marker and no empty state
- WHEN the map panel renders
- THEN the map container is rendered
