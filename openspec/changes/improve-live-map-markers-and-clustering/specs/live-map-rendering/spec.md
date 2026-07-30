# Delta for live-map-rendering

## ADDED Requirements

### Requirement: Nearby markers are grouped without changing their meaning

Nearby logical markers MUST form a provider-neutral cluster with a readable count. Clusters MUST separate as zoom increases, MUST zoom to member bounds when activated, and MUST spiderfy overlaps at maximum zoom. Activation MUST NOT select a vehicle.

#### Scenario: Nearby markers show their count

- GIVEN logical markers overlap at the current zoom
- WHEN the map renders
- THEN one cluster icon shows their numeric count
- AND its accessible label identifies a vehicle count

#### Scenario: Cluster activation changes only the viewport

- GIVEN a cluster with multiple members
- WHEN the operator activates the cluster
- THEN the map zooms to the bounds of its members
- AND no vehicle becomes selected

#### Scenario: Clusters separate while zooming

- GIVEN members become distinguishable at a closer zoom
- WHEN the operator zooms in
- THEN it separates into smaller clusters or individual markers

#### Scenario: Overlap is resolved at maximum zoom

- GIVEN multiple markers remain overlapping at maximum zoom
- WHEN the operator activates their cluster
- THEN the individual markers spiderfy around their shared area

### Requirement: Browser-only map behavior remains isolated

Clustering MUST execute only within the client map boundary. Server rendering MUST NOT evaluate browser-only map dependencies, and initialization failures MUST remain confined to the map surface.

#### Scenario: Server delivery does not require browser globals

- GIVEN server rendering has no browser globals
- WHEN the server produces the page shell
- THEN browser-only marker and clustering code is not evaluated

#### Scenario: Client map initialization fails

- GIVEN the operational view model was composed successfully
- WHEN the client map layer cannot initialize
- THEN the failure does not alter operational source data or invoke provider-specific behavior

## MODIFIED Requirements

### Requirement: Markers are derived only from the view model

The map MUST create one logical marker per view-model marker and MUST NOT read vehicle, device, or provider data. An unclustered marker MUST use a high-contrast, provider-neutral navy and neon cyan visual. Clustering MUST preserve every logical marker.

(Previously: every view-model marker appeared directly, without contrast or clustering requirements.)

#### Scenario: One logical marker per view-model entry

- GIVEN a map view model with two markers
- WHEN the map renders
- THEN two logical markers are placed at their supplied latitude and longitude
- AND they MAY appear within one visible cluster

#### Scenario: Marker exposes its label

- GIVEN a marker with a label
- WHEN its individual marker is rendered
- THEN that label is reachable as the marker's accessible title

#### Scenario: Heading orients the marker

- GIVEN a marker with `headingDeg` of 90
- WHEN its individual marker is rendered
- THEN the marker icon is rotated by 90 degrees

#### Scenario: Missing heading renders an unrotated marker

- GIVEN a marker without `headingDeg`
- WHEN its individual marker is rendered
- THEN the marker icon is rendered without rotation

### Requirement: The map viewport follows the rendered markers

The map MUST frame all logical-marker coordinates rather than a fixed location. Clustering MUST NOT change fit bounds, marker-change refitting, or resize correction.

(Previously: the viewport followed directly rendered markers without defining clustering or resize preservation.)

#### Scenario: Viewport fits all markers

- GIVEN a map view model with markers in different regions
- WHEN the map renders
- THEN the viewport is fitted to bounds covering every logical marker

#### Scenario: Marker changes refit the viewport

- GIVEN the map has rendered a set of logical markers
- WHEN the marker set changes
- THEN the viewport is refitted to the new logical-marker bounds

#### Scenario: Container resize preserves map correctness

- GIVEN the map container changes size
- WHEN the resize is observed
- THEN the map recalculates its rendered size without changing logical markers
