# Catalog Review Resolution Specification

## Requirement: dedicated review page
The system MUST provide `/admin/revisiones` for administrators to manage pending catalog reviews.

### Scenario: page access
- GIVEN an authenticated administrator
- WHEN they open `/admin/revisiones`
- THEN the page loads the pending reviews
- AND unauthenticated or non-admin users are denied

## Requirement: understandable pending review
Each review MUST show the external identifier, review type, evidence when available, candidate identifiers, and the allowed resolution actions.

### Scenario: vehicle match review
- GIVEN a pending vehicle-match review
- WHEN the review renders
- THEN the administrator can choose an existing vehicle or create a new vehicle

### Scenario: fleet binding review
- GIVEN a pending fleet-binding review
- WHEN the review renders
- THEN the administrator can choose an existing fleet
- AND the UI MUST NOT offer creation of a new fleet through this review action

## Requirement: resolution feedback
After a successful resolution, the item MUST disappear from the pending list and the page MUST show a success status. Failed resolutions MUST remain visible with an actionable error.

### Scenario: resolution fails
- GIVEN the resolution endpoint rejects the request
- WHEN the administrator submits it
- THEN the review remains visible
- AND an error is shown
