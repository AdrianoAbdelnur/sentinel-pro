# Operational Source Aggregation Specification

## Purpose

Preserve operational visibility when any enabled provider source fails.

## Requirements

### Requirement: Enabled sources load independently

The application MUST load every enabled operational source independently and merge all successful normalized states.

#### Scenario: Multiple sources succeed

- GIVEN multiple enabled sources return normalized states
- WHEN aggregation completes
- THEN all successful fleets and vehicles are present in the merged state

#### Scenario: One source fails

- GIVEN one enabled source fails and another succeeds
- WHEN aggregation completes
- THEN successful state remains available
- AND a generic warning identifies the failed source label

### Requirement: Identity collisions reject one source atomically

The application MUST process successful sources in configured order. If a candidate state duplicates a fleet, vehicle, or device ID internally or collides with an already accepted ID, the entire candidate source MUST be rejected with one generic warning. Earlier accepted state MUST remain unchanged.

#### Scenario: Later source collides

- GIVEN an earlier source was accepted and a later source contains colliding and unique records
- WHEN aggregation completes
- THEN the earlier source remains
- AND none of the later source records leak into the state
- AND one provider-neutral warning identifies the later source

### Requirement: Aggregate failure retains warnings

The application MUST return an empty roster only when every enabled source fails and MUST retain one generic warning for each failed source.

#### Scenario: Every source fails

- GIVEN all enabled sources fail
- WHEN aggregation completes
- THEN no roster is returned
- AND warnings identify every failed source without raw provider errors

### Requirement: Production never falls back to fixtures

The system MUST NOT substitute in-memory or demo data after a production source failure. Fixture sources MAY run only when explicitly selected for development or tests.

#### Scenario: Production source fails

- GIVEN a production source fails
- WHEN aggregation completes
- THEN no fixture roster is injected
