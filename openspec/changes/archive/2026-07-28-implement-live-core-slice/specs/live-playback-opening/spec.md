# live-playback-opening Specification

## Purpose

Codify the first application behaviors around map composition and playback opening.

## Requirements

### Requirement: Map composition follows selected vehicles and valid GPS

The system MUST build map state from the current vehicle selection and only include markers with valid GPS coordinates.

#### Scenario: No vehicles selected

- GIVEN no vehicles are selected
- WHEN the map view model is composed
- THEN it returns the empty state `no-selection`

#### Scenario: Selection exists but no valid GPS

- GIVEN selected vehicles exist
- AND none of them has valid GPS coordinates
- WHEN the map view model is composed
- THEN it returns the empty state `no-mappable-selection`

#### Scenario: Valid GPS vehicles become markers

- GIVEN selected vehicles exist
- AND some selected vehicles have valid GPS coordinates
- WHEN the map view model is composed
- THEN it returns one marker per selected vehicle with valid GPS

### Requirement: Playback opening resolves application outcomes

The system MUST decide whether playback appends tiles, shows a notice, or does nothing when the vehicle is already open.

#### Scenario: Offline vehicle returns functional notice

- GIVEN a playback open request for an offline vehicle
- WHEN the application resolves the request
- THEN it returns `show-notice` with code `vehicle-offline`

#### Scenario: Vehicle without playable video returns functional notice

- GIVEN a playback open request for a vehicle with no playable video
- WHEN the application resolves the request
- THEN it returns `show-notice` with code `vehicle-no-video`

#### Scenario: Already-open vehicle does not duplicate tiles

- GIVEN a playback open request for a vehicle whose identifier is already tracked in the current playback session
- WHEN the application resolves the request
- THEN it returns `noop` with reason `already-open`

#### Scenario: Playable vehicle appends tiles

- GIVEN a playback open request for a vehicle with playable tiles
- WHEN the application resolves the request
- THEN it returns `append-tiles` with an updated monitor
