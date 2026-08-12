# External Import Authorization Specification

## Requirements

### Requirement: Explicit scope authorization gates import
A provider connection MUST name a Company and explicit authorized external identifiers. Before staging, matching, identity creation, review, or canonical association, the synchronization MUST retain only records authorized for that connection's Company. No Company context, label, or missing identifier MAY authorize a record.

#### Scenario: Shared master account returns two fleets
- GIVEN Company A and B use the same master credential reference
- AND A authorizes fleet X while B authorizes fleet Y
- WHEN the provider returns vehicles from X and Y
- THEN A imports only X and B imports only Y

#### Scenario: Unknown scope
- GIVEN a returned record has an external scope absent from the connection allowlist
- WHEN synchronization runs
- THEN it creates no catalog identity, review, vehicle, or fleet association

### Requirement: Provider scopes are stable and explicit
Howen records MUST be authorized by their `fleetid`. The observed Cybermapa GETVEHICULOS contract has no fleet identifier; Cybermapa records MUST therefore be authorized by their stable connection-scoped `gps_id`. Empty allowlists MUST authorize nothing.

#### Scenario: Repeated snapshot
- GIVEN an authorized record was previously imported
- WHEN the same snapshot repeats
- THEN canonical cardinality remains unchanged.
