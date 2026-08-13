# Provider Import Progress

## Requirements

### Requirement: Stream real import progress

The provider import endpoint MUST stream typed progress events before the final result while the import is active.

#### Scenario: Snapshot progress
- GIVEN a provider snapshot is loaded successfully
- WHEN import processing begins
- THEN the endpoint emits the number of provider records found and detected fleets

#### Scenario: Persistence progress
- GIVEN catalog candidates are being processed
- WHEN a candidate is processed
- THEN the endpoint emits updated processed, created, linked, reviewed, rejected, and absent counts

### Requirement: Explain active imports in the UI

The import screen MUST show the current phase, elapsed time, and real counters while the request is active.

#### Scenario: Long-running import
- GIVEN an import is active
- WHEN progress events arrive
- THEN the screen updates the phase and counters without waiting for the final response

#### Scenario: Successful completion
- GIVEN the final result reports success
- WHEN the stream ends
- THEN the screen shows the final found and persisted counts

#### Scenario: Failure
- GIVEN the stream reports a failed result or transport failure
- WHEN the import ends
- THEN the screen shows a Spanish failure message and stops the loading state
