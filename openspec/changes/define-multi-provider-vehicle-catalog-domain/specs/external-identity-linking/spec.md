# Delta for External Identity Linking

## MODIFIED Requirements

### Requirement: Plate matching is global and exact
For a new device identity, the system MUST normalize plate evidence by trimming, removing accepted separators, and uppercasing before format validation, and MUST auto-link only when exactly one trustworthy global normalized-plate match exists. With no usable plate match, it MUST create a normal separate vehicle when `deviceId` is valid, including when plate is absent. Multiple matches, contradictory links, or a later plate indicating another existing vehicle MUST retain separate identities and create SUPER ADMIN merge review without silently merging.
(Previously: Missing or malformed plate evidence always created review and prevented normal vehicle creation.)

#### Scenario: One exact global plate matches
- GIVEN one trustworthy normalized plate match and no identity conflict
- WHEN evaluated
- THEN the device links that vehicle

#### Scenario: Equivalent plate formatting matches
- GIVEN `PJW-755` and `pjw 755` pass supported-format validation
- WHEN normalized and evaluated
- THEN both provide the same exact plate evidence

#### Scenario: Plate-less device is new
- GIVEN a valid new device identity and no usable plate
- WHEN evaluated
- THEN a normal separate vehicle is created without review

#### Scenario: Two plate-less devices arrive
- GIVEN unknown devices from different connections without plates
- WHEN evaluated
- THEN separate vehicles are created without automatic linking

#### Scenario: Evidence conflicts
- GIVEN multiple plate matches or a linked device later points to another vehicle's plate
- WHEN evaluated
- THEN identities remain unchanged and merge review retains the evidence

## ADDED Requirements

### Requirement: Eligible legacy plate reviews reconcile by exact identity
The first successfully processed post-rollout candidate MUST reconcile a pending legacy `missing-plate` or `malformed-plate` review only when its `(connectionId, externalId)` maps exactly to the candidate's `(connectionId, deviceId)`. The system MUST reuse any vehicle already linked through that device or contribution before considering plate evidence; otherwise it MUST apply normal unique-plate-or-create behavior. Vehicle, device, contribution, observation, and review resolution MUST commit atomically. An eligible pending review MUST NOT block candidate processing.

#### Scenario: Existing identity wins over plate evidence
- GIVEN an eligible review and an existing device or contribution link
- WHEN the candidate is processed
- THEN that vehicle is reused and the review is resolved without plate relinking

#### Scenario: Review-only identity self-heals
- GIVEN an eligible review without an existing device or contribution
- WHEN the matching candidate is successfully processed
- THEN normal unique-plate-or-create behavior runs and all identity records and review resolution commit together

#### Scenario: Retry is idempotent
- GIVEN a reconciliation committed before a retry
- WHEN the same candidate is processed again
- THEN existing identity records are reused and no duplicate vehicle, device, contribution, observation, or resolution is created

#### Scenario: Review remains manual
- GIVEN ambiguous, conflicting, multiple-link, identity-less, transformed, unsupported, or non-plate review evidence
- WHEN a candidate is evaluated
- THEN the review remains pending and no automatic resolution or silent merge occurs
