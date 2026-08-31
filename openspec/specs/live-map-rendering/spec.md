# live-map-rendering Specification

## Purpose

Define how the live map surface is delivered from `LiveMapViewModel`, without the map layer knowing about vehicles, providers, or selection.

## Requirements

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
### Requirement: The sidebar and the bottom panel collapse independently

Each side panel MUST be collapsible on its own, so an operator can give the map the whole viewport without losing the other panel's state.

#### Scenario: Collapsing the sidebar leaves the other surfaces intact

- GIVEN the live screen is rendered
- WHEN the sidebar is collapsed
- THEN its filters and fleet list are no longer rendered, while the map and the bottom panel remain

#### Scenario: Collapsing the bottom panel keeps its tabs reachable

- GIVEN the live screen is rendered
- WHEN the bottom panel is collapsed
- THEN its table is no longer rendered, its tab row remains, and the sidebar is unaffected

#### Scenario: A collapsed panel can be restored

- GIVEN a collapsed panel
- WHEN its expand control is activated
- THEN the panel's content is rendered again

### Requirement: Scrolling is contained within each panel

Long content MUST scroll inside its own panel. The document itself MUST NOT scroll, and the sidebar's search and filters MUST remain outside the scrolling fleet-list region so scrolling vehicles never moves the map or controls out of view.

(Previously: required panel-contained scrolling without explicitly preserving the sidebar controls outside the independently scrolling list region.)

#### Scenario: The vehicle list scrolls on its own

- GIVEN a fleet list taller than the viewport
- WHEN the list is scrolled
- THEN only the sidebar's list region scrolls
- AND the search, filters, and map remain fixed
### Requirement: Markers are derived only from the view model

The map MUST create one logical marker per view-model marker and MUST NOT read vehicle, device, or provider data. An unclustered marker MUST use a high-contrast, provider-neutral deep-navy (`#172554`) visual with deep navy-blue (`#003b73` border and `#005a9c` glyph/count) accents and restrained `rgba(0,59,115,...)` glows. Clustering MUST preserve every logical marker.

(Previously: every view-model marker appeared directly, without contrast or clustering requirements.)

#### Scenario: One logical marker per view-model entry

- GIVEN a view model with two markers
- WHEN the map renders
- THEN two logical markers use their supplied coordinates
- AND they MAY share one visible cluster

#### Scenario: Marker exposes its label

- GIVEN a marker with a label
- WHEN its individual marker renders
- THEN that label is its accessible title

#### Scenario: Heading orients the marker

- GIVEN a marker with `headingDeg` of 90
- WHEN its individual marker renders
- THEN its icon is rotated by 90 degrees

#### Scenario: Missing heading renders an unrotated marker

- GIVEN a marker without `headingDeg`
- WHEN its individual marker renders
- THEN its icon is unrotated

### Requirement: The map viewport follows the rendered markers

The map MUST frame all logical-marker coordinates rather than a fixed location. Clustering MUST NOT change fit bounds, marker-change refitting, or resize correction.

(Previously: the viewport followed directly rendered markers without clustering or resize guarantees.)

#### Scenario: Viewport fits all markers

- GIVEN markers in different regions
- WHEN the map renders
- THEN the viewport fits every logical marker

#### Scenario: Marker changes refit the viewport

- GIVEN the map has logical markers
- WHEN their set changes
- THEN the viewport refits their source-coordinate bounds

#### Scenario: Container resize preserves map correctness

- GIVEN the map container changes size
- WHEN resize is observed
- THEN the map recalculates size without changing logical markers

### Requirement: Tile usage is attributed

The system MUST display the tile provider's attribution.

#### Scenario: OpenStreetMap attribution is present

- GIVEN the map renders its tile layer
- WHEN the tile layer is configured
- THEN it carries the OpenStreetMap attribution text

### Requirement: Nearby markers cluster without changing state

Nearby markers MUST form provider-neutral clusters with counts and separate as zoom increases. Activation below maximum zoom MUST expand to member bounds and MUST NOT select vehicles.

#### Scenario: Nearby markers show their count

- GIVEN logical markers overlap at the current zoom
- WHEN the map renders
- THEN an accessible cluster shows their count

#### Scenario: Cluster activation changes the viewport

- GIVEN a cluster below maximum zoom
- WHEN the operator activates it
- THEN the viewport expands to its member bounds
- AND vehicle selection remains unchanged

#### Scenario: Clusters separate while zooming

- GIVEN members become distinguishable at a closer zoom
- WHEN the operator zooms in
- THEN the cluster separates into smaller clusters or markers

#### Scenario: Maximum-zoom overlap fans

- GIVEN markers remain overlapping at maximum zoom
- WHEN the operator activates their cluster
- THEN every member fans to a deterministic position
- AND every logical marker retains its source coordinates

### Requirement: Clustering preserves isolation and responsiveness

Clustering MUST stay inside the client map boundary and MUST NOT mutate the map runtime. Server rendering MUST NOT evaluate browser-only dependencies. `/live` MUST wait until an isolated browser harness proves the initial 621-point workload responsive.

#### Scenario: Server avoids browser dependencies

- GIVEN server rendering has no browser globals
- WHEN the page shell renders
- THEN browser-only clustering code is not evaluated

#### Scenario: Isolated workload is interactive

- GIVEN the harness displays its initial 621-point workload
- WHEN clustering, expansion, fan, collapse, and resize are exercised
- THEN animation and controls remain responsive in a real browser

#### Scenario: Operational interactions stay responsive

- GIVEN the isolated 621-point harness has passed
- WHEN clustering is integrated into `/live`
- THEN fleet expansion, checkbox selection, and filters remain responsive

#### Scenario: Failed harness blocks integration

- GIVEN the isolated harness blocks page interaction
- WHEN `/live` integration is considered
- THEN clustering MUST remain disconnected from `/live`
