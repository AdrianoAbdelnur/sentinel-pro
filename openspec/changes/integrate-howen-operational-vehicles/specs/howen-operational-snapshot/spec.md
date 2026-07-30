# Howen Operational Snapshot Specification

## Purpose

Normalize the verified full Howen roster behind the operational-source contract.

## Requirements

### Requirement: Howen authentication preserves the complete session

The adapter MUST hash the configured raw password with MD5 before login, MUST retain `token`, `pid`, and `JSESSIONID`, MUST reuse one process-local session, and MUST coalesce concurrent logins. Because Howen expires tokens after 30 minutes without interface interaction, each successful authenticated call MUST update local session activity. The next request after a conservative inactivity threshold MUST obtain a new session. Provider codes `10004` and `10023` MUST invalidate the session and permit exactly one reauthentication and roster retry. The adapter MUST NOT create a permanent refresh timer or persist sessions to disk.

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

#### Scenario: Active use keeps the session reusable

- GIVEN successful authenticated requests occur before the inactivity threshold
- WHEN another roster snapshot is requested
- THEN the current process-local session is reused
- AND no background refresh loop is started

#### Scenario: Inactivity renews on demand

- GIVEN no authenticated interface call succeeds before the conservative inactivity threshold
- WHEN the next roster snapshot is requested
- THEN the adapter obtains a new session before requesting the roster
- AND no expired session is read from or written to disk

### Requirement: The complete roster is normalized

The adapter MUST request all available devices without silent pagination or truncation, validate the response, and preserve each valid device exactly once.

#### Scenario: Current roster remains complete

- GIVEN the provider's fleet grouping may change independently of vehicle count
- WHEN the snapshot is normalized
- THEN every valid unique vehicle and every referenced fleet is preserved
- AND no fixed fleet count truncates the roster

#### Scenario: Invalid identity is isolated

- GIVEN one record lacks a usable `deviceno`
- WHEN a roster is normalized
- THEN that record is rejected without discarding valid records

### Requirement: Verified Howen fields map to internal contracts

The adapter MUST map `fleetid` to fleet identity, `fleetname` to fleet label, `deviceno` to the technical device external ID, and `devicename` to the vehicle's sole visible plate/headline. It MUST NOT create a secondary Howen vehicle label. Every normalized Howen device and the source's operator-facing label MUST use the canonical value `HOWEN`.

#### Scenario: Identity and visible text are not confused

- GIVEN a device has distinct `deviceno` and `devicename`
- WHEN it is normalized and rendered
- THEN `deviceno` remains hidden as the technical external ID
- AND `devicename` is the sole visible headline with no duplicate secondary label

#### Scenario: Provider filters have one Howen value

- GIVEN real and development records both represent Howen devices
- WHEN their provider values are normalized
- THEN every such device uses exactly `HOWEN`
- AND delivery does not create duplicate Howen filter options

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
