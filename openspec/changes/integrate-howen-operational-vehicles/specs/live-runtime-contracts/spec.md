# Delta for live-runtime-contracts

## MODIFIED Requirements

### Requirement: Application contracts stay provider-agnostic

The system MUST expose application-facing live contracts without importing provider adapters. These contracts MUST include an asynchronous operational-source result, source identity and generic warning contracts, and an aggregate result containing normalized `LiveState` plus warnings.

(Previously: Application contracts exposed view models and playback results but no reusable asynchronous source or partial-failure result.)

#### Scenario: Application defines live page composition contracts

- GIVEN a live page use case needs stable outputs
- WHEN developers import application live contracts
- THEN they find view models, playback notices, open-live results, async operational-source results, and aggregate warning contracts in `application/live`

#### Scenario: Operational source is asynchronous

- GIVEN any enabled provider implements the operational source
- WHEN the application loads it
- THEN it asynchronously returns either normalized state or a provider-agnostic failure

#### Scenario: Aggregate result supports partial availability

- GIVEN enabled sources have mixed outcomes
- WHEN their results are aggregated
- THEN the contract carries merged successful state and source-labeled generic warnings

#### Scenario: Playback resolution stays behind a port

- GIVEN provider-specific playback data is needed
- WHEN the application opens live playback
- THEN it depends on a resolver port/function instead of direct provider modules
