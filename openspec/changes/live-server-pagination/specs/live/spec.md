# Live Specification

## ADDED Requirements

### Requirement: Paginated group loading

The Live vehicle loader MUST return a page of organization-visible vehicles with a target maximum of 50. Complete groups SHOULD remain together; a group larger than 50 MAY be split into 50-vehicle chunks. Group and plate filters MUST be applied before pagination, and provider snapshot loading MUST receive only those vehicles.

#### Scenario: Page loads only its vehicles

- GIVEN a group contains more than 50 authorized vehicles
- WHEN page 2 is requested
- THEN MongoDB returns only the second page and its total metadata
- AND provider snapshot loading receives only that page's contributions and plates

#### Scenario: Complete groups are preferred

- GIVEN the next complete group would exceed the 50-vehicle target
- WHEN the page is built
- THEN the next group starts on the following page
- AND the current page contains no vehicles from that next group

#### Scenario: Plate filtering precedes pagination

- GIVEN a group contains vehicles whose plates do and do not match a search term
- WHEN the search term and page 1 are requested
- THEN only matching vehicles are counted and returned before page slicing

### Requirement: Fresh GPS page reads

Live MUST request Cybermapa DATOSACTUALES for only the returned page plates and MUST NOT add a page or GPS cache.

#### Scenario: Current data is scoped to the page

- GIVEN the requested page contains three Cybermapa vehicles
- WHEN Live loads the page
- THEN DATOSACTUALES receives exactly those three plates with `no-store` behavior

#### Scenario: Empty page avoids provider calls

- GIVEN filters produce no vehicles on the requested page
- WHEN Live loads the page
- THEN no provider snapshot request is made

### Requirement: Persistent pagination controls

The Live sidebar MUST render its pagination controller in a fixed footer below the scrollable vehicle list. The controller MUST remain visible while the list scrolls, expose five selectable page numbers when available, support jumps of ten pages, and expose disabled previous/next actions at the first and last page.

#### Scenario: Pagination remains visible while the list scrolls

- GIVEN the Live sidebar has a paginated result
- WHEN the vehicle list is vertically scrolled
- THEN the pagination controller remains outside the scrolling region at the bottom of the sidebar

#### Scenario: Boundary actions are disabled

- GIVEN the first or last page is active
- WHEN the pagination controller is rendered
- THEN the corresponding previous or next action is disabled

#### Scenario: Page window and decade jumps

- GIVEN page 3 of a result with 90 pages is active
- WHEN the pagination controller is rendered
- THEN pages 1 through 5 are selectable
- AND advancing ten pages requests page 13

### Requirement: Expanded current-page groups

The Live sidebar MUST expand every group returned on the active page by default so that a page with few groups does not render only collapsed one-line summaries. Users MUST still be able to collapse an individual group after it is displayed.

#### Scenario: Current page groups are visible

- GIVEN the active page returns one or more groups with vehicles
- WHEN the page is rendered or changed
- THEN every returned group is expanded and its vehicles are visible

#### Scenario: Individual group can be collapsed

- GIVEN a group is expanded by default
- WHEN the user clicks its group header
- THEN only that group collapses
