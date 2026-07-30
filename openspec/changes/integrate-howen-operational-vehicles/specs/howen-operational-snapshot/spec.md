# Howen Operational Snapshot Specification

## Purpose

Normalize the verified full Howen roster behind the operational-source contract.

## Requirements

### Requirement: Howen authentication preserves the complete session

The adapter MUST hash the configured raw password with MD5 before login, MUST retain `token`, `pid`, and `JSESSIONID`, MUST reuse valid in-memory sessions, and MUST coalesce concurrent logins. It MUST reauthenticate and retry a roster request at most once after recognized session expiry.

#### Scenario: Raw credentials establish a reusable session

- GIVEN raw server-side credentials and no valid session
- WHEN concurrent snapshots authenticate
- THEN one login sends the MD5-normalized password
- AND its token, pid, and cookie are preserved and shared

#### Scenario: Session retry is bounded

- GIVEN a roster request reports session expiry
- WHEN the adapter reloads the session
- THEN it retries the roster once
- AND repeated expiry becomes a translated failure

### Requirement: The complete roster is normalized

The adapter MUST request all available devices without silent pagination or truncation, validate the response, and preserve each valid device exactly once.

#### Scenario: Verified roster remains complete

- GIVEN the verified response contains 621 unique devices in 119 fleets
- WHEN the snapshot is normalized
- THEN it contains 621 vehicles grouped into 119 fleets

#### Scenario: Invalid identity is isolated

- GIVEN one record lacks a usable `deviceno`
- WHEN a roster is normalized
- THEN that record is rejected without discarding valid records

### Requirement: Verified Howen fields map to internal contracts

The adapter MUST map `fleetid` to fleet identity, `fleetname` to fleet label, `deviceno` to the technical device external ID, and `devicename` to the vehicle's sole visible plate/headline. It MUST NOT create a secondary Howen vehicle label.

#### Scenario: Identity and visible text are not confused

- GIVEN a device has distinct `deviceno` and `devicename`
- WHEN it is normalized and rendered
- THEN `deviceno` remains hidden as the technical external ID
- AND `devicename` is the sole visible headline with no duplicate secondary label

### Requirement: Telemetry is parsed safely

The adapter MUST map channel count, `accessmode >= 1` online state, and valid location and motion values. Zone-less Howen timestamps MUST be interpreted in `America/Argentina/Buenos_Aires` and converted to ISO; invalid optional values MUST be absent.

#### Scenario: Local provider time becomes an instant

- GIVEN `dtu` has no zone offset
- WHEN telemetry is normalized
- THEN Buenos Aires local time is converted to the corresponding ISO instant

#### Scenario: Malformed optional telemetry is absent

- GIVEN optional numeric or timestamp values are malformed
- WHEN telemetry is normalized
- THEN no `NaN` or invented timestamp is emitted

### Requirement: Failures are translated

Authentication, transport, invalid-response, and exhausted-session failures MUST become provider-agnostic source failures without exposing secrets, raw statuses, or payloads.

#### Scenario: Provider failure does not leak

- GIVEN Howen cannot return a valid roster
- WHEN snapshot loading fails
- THEN the source returns a stable failure contract labeled by its configured source identity
