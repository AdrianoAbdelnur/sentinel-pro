# live-map-rendering Specification

## Purpose

Define how the live map surface is delivered from `LiveMapViewModel`, without the map layer knowing about vehicles, providers, or selection.

## Requirements

### Requirement: The map panel renders empty states without loading the map

The system MUST render map empty states as plain content, so no map library is initialised when there is nothing to plot.

#### Scenario: No selection shows its message

- GIVEN a map view model with empty state `no-selection`
- WHEN the map panel renders
- THEN the empty-state message is displayed and no map container is rendered

#### Scenario: Selection without GPS shows its message

- GIVEN a map view model with empty state `no-mappable-selection`
- WHEN the map panel renders
- THEN the empty-state message is displayed and no map container is rendered

#### Scenario: Markers present render the map

- GIVEN a map view model with at least one marker and no empty state
- WHEN the map panel renders
- THEN the map container is rendered

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
