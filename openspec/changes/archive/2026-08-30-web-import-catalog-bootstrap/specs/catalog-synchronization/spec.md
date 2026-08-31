# Delta for Catalog Synchronization

## MODIFIED Requirements

### Requirement: Web import does not depend on manual catalog commands

The existing web import flow MUST continue to the current synchronization use case after automatic catalog bootstrap, without changing provider clients, mappers, matching, reviews, persistence model, or import UI.

#### Scenario: Existing import flow continues after bootstrap

- GIVEN valid current Cybermapa or Howen environment variables
- WHEN the web import starts
- THEN the existing source resolution and synchronization use case receive the bootstrapped canonical connection
