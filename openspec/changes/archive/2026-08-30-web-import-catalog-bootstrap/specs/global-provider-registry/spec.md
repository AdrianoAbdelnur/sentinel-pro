# Delta for Global Provider Registry

## MODIFIED Requirements

### Requirement: Web imports ensure existing provider registrations

The platform provider import runtime MUST initialize the existing catalog persistence and idempotently register the existing Cybermapa and Howen provider definitions and enabled connections before resolving an import.

#### Scenario: Empty catalog is imported from the web

- GIVEN MongoDB has no catalog collections or provider registrations
- WHEN a SUPER ADMIN starts a Cybermapa or Howen import from the web
- THEN the catalog collections/indexes exist and the requested provider has one enabled connection

#### Scenario: Repeated or concurrent runtime setup

- GIVEN the web runtime is requested repeatedly
- WHEN bootstrap runs more than once in the application process
- THEN provider definitions and enabled connections are reused and no duplicate bootstrap sequence is started
