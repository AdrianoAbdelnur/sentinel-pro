# live-page-responsibilities Specification

## Purpose

Define the behavior boundaries between application, integrations, and delivery/UI for live pages.

## Requirements

### Requirement: Operational selection precedes playback

The system MUST treat operational selection as the primary live flow and playback as a secondary explicit action.

#### Scenario: Map and selection do not depend on playback

- GIVEN selected vehicles exist
- WHEN no playback session is open
- THEN sidebar, selection, and map behavior still operate from live operational data

#### Scenario: Playback requires explicit action

- GIVEN a vehicle is visible in the live sidebar
- WHEN the operator explicitly requests live playback
- THEN the application resolves whether tiles or a notice should be returned

### Requirement: Application owns live behavior

The system MUST keep provider-specific behavior outside the UI and delivery layers.

#### Scenario: Offline vehicle blocks playback through application logic

- GIVEN a vehicle is offline
- WHEN a playback open action is requested
- THEN the application returns a functional notice instead of delegating the decision to the UI

#### Scenario: Provider details stay below UI contracts

- GIVEN integrations resolve playback capability
- WHEN the live page consumes the result
- THEN it receives provider-agnostic view models rather than raw provider payloads
