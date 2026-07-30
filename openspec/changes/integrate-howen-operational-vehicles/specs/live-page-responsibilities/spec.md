# Delta for live-page-responsibilities

## MODIFIED Requirements

### Requirement: Application owns live behavior

The system MUST keep provider-specific behavior outside UI and delivery. Application logic MUST load enabled sources independently, merge successful states, and retain generic source-labeled warnings; the composition root MUST only select and wire sources.

(Previously: Application behavior excluded provider details but did not own multi-source aggregation or partial-failure rules.)

#### Scenario: Offline vehicle blocks playback through application logic

- GIVEN a vehicle is offline
- WHEN a playback open action is requested
- THEN the application returns a functional notice instead of delegating the decision to the UI

#### Scenario: Provider details stay below UI contracts

- GIVEN integrations resolve playback or operational capability
- WHEN the live page consumes the result
- THEN it receives provider-agnostic view models and warnings rather than raw provider payloads

#### Scenario: Initial sources are composed once

- GIVEN `/live` is server-rendered
- WHEN its composition root runs
- THEN all configured sources are wired into one application aggregation
- AND no polling, timer, or background refresh starts

#### Scenario: Partial failure preserves the roster

- GIVEN one source fails while another succeeds
- WHEN `/live` renders
- THEN successful operational state is rendered with a warning for the failed source

#### Scenario: Total failure renders no roster

- GIVEN every enabled source fails
- WHEN `/live` renders
- THEN no roster is rendered and all source warnings remain available
