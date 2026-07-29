# live-vehicle-status Specification

## Purpose

Define the pure domain rule that derives a vehicle's live status (`en-route`, `stopped`, `offline`) from its telemetry, resolving online state by trusting the provider's own flag first and falling back to a staleness check only when the provider sends no flag at all.

## Requirements

### Requirement: Vehicle status is one of three values derived from online state and speed

The system MUST derive vehicle status as exactly one of `en-route`, `stopped`, or `offline`, for every vehicle including those with no telemetry record.

#### Scenario: Online with positive speed is en route

- GIVEN telemetry resolves to online and reports `speedKmH` greater than 0
- WHEN vehicle status is derived
- THEN the status is `en-route`

#### Scenario: Online with zero speed is stopped

- GIVEN telemetry resolves to online and reports `speedKmH` equal to 0
- WHEN vehicle status is derived
- THEN the status is `stopped`

#### Scenario: Online with no reported speed is stopped

- GIVEN telemetry resolves to online and `speedKmH` is absent
- WHEN vehicle status is derived
- THEN the status is `stopped`

#### Scenario: Not online is always offline regardless of speed

- GIVEN telemetry resolves to not online, even if `speedKmH` is present and greater than 0
- WHEN vehicle status is derived
- THEN the status is `offline`

#### Scenario: No telemetry at all is offline

- GIVEN a vehicle has no telemetry record
- WHEN vehicle status is derived
- THEN the status is `offline`

### Requirement: Online resolution favors the provider's own flag over staleness

The system MUST resolve online state from `DeviceTelemetry.online` whenever the provider sends it (`true` or `false`), and MUST apply the staleness fallback only when `online` is absent.

#### Scenario: Explicit true wins even over a stale timestamp

- GIVEN `online` is explicitly `true` and the last report is older than the staleness threshold
- WHEN online state is resolved
- THEN the vehicle resolves online

#### Scenario: Explicit false is never overridden by a fresh timestamp

- GIVEN `online` is explicitly `false` and the last report is within the staleness threshold
- WHEN online state is resolved
- THEN the vehicle resolves not online

#### Scenario: Absent flag within threshold resolves online

- GIVEN `online` is absent and the last report is within the staleness threshold of the current time
- WHEN online state is resolved
- THEN the vehicle resolves online

#### Scenario: Absent flag beyond threshold resolves offline

- GIVEN `online` is absent and the last report is older than the staleness threshold
- WHEN online state is resolved
- THEN the vehicle resolves not online

#### Scenario: Absent flag and no timestamp resolves offline

- GIVEN `online` is absent and no report timestamp exists at all
- WHEN online state is resolved
- THEN the vehicle resolves not online

### Requirement: The staleness threshold and current time are injected, never read internally

The rule MUST accept the staleness threshold and the current time as parameters and MUST NOT read environment variables or the system clock itself. The threshold MUST default to 5 minutes when the caller supplies none; resolving that default from an environment variable is a delivery/composition-root responsibility, not this rule's.

#### Scenario: No threshold supplied defaults to 5 minutes

- GIVEN a caller resolves online state without supplying a threshold
- WHEN the fallback path is evaluated
- THEN a report older than 5 minutes resolves not online, and one within 5 minutes resolves online

#### Scenario: Same inputs produce the same result

- GIVEN identical telemetry, threshold, and current time are passed twice
- WHEN online state is resolved both times
- THEN both calls return the identical result

### Requirement: DeviceTelemetry.online becomes optional to represent "not reported"

`DeviceTelemetry.online` MUST be optional so a provider sending no flag is distinguishable from a provider explicitly reporting `false`.

(Previously: `DeviceTelemetry.online` was a required `boolean`, making "not reported" and "reported false" indistinguishable.)

#### Replaces

Tightens `domain/live/entities.ts`: `DeviceTelemetry.online: boolean` (required) becomes `online?: boolean` (optional). Neither `live-runtime-contracts` nor `live-core-contracts` asserts `online` as required in any promoted scenario, so this does not contradict either spec; it is recorded here because this capability is its only consumer today. No `live-runtime-contracts` delta is opened for it.

#### Scenario: Absent flag and explicit false are distinct telemetry states

- GIVEN one telemetry record omits `online` and another sets `online: false`
- WHEN each is inspected
- THEN they are distinguishable, and only the omitted one is eligible for the staleness fallback
