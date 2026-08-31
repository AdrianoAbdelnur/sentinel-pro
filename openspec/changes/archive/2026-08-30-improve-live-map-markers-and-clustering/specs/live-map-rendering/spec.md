# Delta for live-map-rendering

## ADDED Requirements

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

## MODIFIED Requirements

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
