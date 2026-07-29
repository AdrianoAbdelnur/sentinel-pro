# live-map-rendering Specification

## Purpose

Define how the live map surface is delivered from `LiveMapViewModel`, without the map layer knowing about vehicles, providers, or selection.

## Requirements

### Requirement: The map is always present, and empty states are overlaid on it

The map MUST remain mounted regardless of the view model's empty state. It is the spatial frame the rest of the console is read against, so replacing it with a message would force a context switch every time the selection empties.

Empty states MUST therefore render as a notice overlaid on the live map, never as a substitute for it. The delivery layer chooses the wording from the empty-state code.

#### Scenario: No selection still shows the map

- GIVEN a map view model with empty state `no-selection`
- WHEN the map panel renders
- THEN the map is rendered and the notice for that code is overlaid on it

#### Scenario: Selection without GPS still shows the map

- GIVEN a map view model with empty state `no-mappable-selection`
- WHEN the map panel renders
- THEN the map is rendered and the notice for that code is overlaid on it

#### Scenario: Markers present render the map without a notice

- GIVEN a map view model with at least one marker and no empty state
- WHEN the map panel renders
- THEN the map is rendered and no empty-state notice is shown

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

Long content MUST scroll inside its own panel. The document itself MUST NOT scroll, so scrolling the vehicle list never moves the map out of view.

#### Scenario: The vehicle list scrolls on its own

- GIVEN a fleet list taller than the viewport
- WHEN the list is scrolled
- THEN only the sidebar's list region scrolls and the map stays in place

### Requirement: Markers are derived only from the view model

The map MUST render one marker per view-model marker and MUST NOT read vehicle, device, or provider data.

#### Scenario: One marker per view-model entry

- GIVEN a map view model with two markers
- WHEN the map renders
- THEN two markers are placed, at each marker's latitude and longitude

#### Scenario: Marker exposes its label

- GIVEN a marker with a label
- WHEN the map renders
- THEN that label is reachable as the marker's accessible title

#### Scenario: Heading orients the marker

- GIVEN a marker with `headingDeg` of 90
- WHEN the map renders
- THEN the marker icon is rotated by 90 degrees

#### Scenario: Missing heading renders an unrotated marker

- GIVEN a marker without `headingDeg`
- WHEN the map renders
- THEN the marker icon is rendered without rotation

### Requirement: The map viewport follows the rendered markers

The map MUST frame the markers it renders rather than a fixed location.

#### Scenario: Viewport fits all markers

- GIVEN a map view model with markers in different regions
- WHEN the map renders
- THEN the viewport is fitted to the bounds covering every marker

#### Scenario: Marker changes refit the viewport

- GIVEN the map has rendered a set of markers
- WHEN the marker set changes
- THEN the viewport is refitted to the new bounds

### Requirement: Tile usage is attributed

The system MUST display the tile provider's attribution.

#### Scenario: OpenStreetMap attribution is present

- GIVEN the map renders its tile layer
- WHEN the tile layer is configured
- THEN it carries the OpenStreetMap attribution text
