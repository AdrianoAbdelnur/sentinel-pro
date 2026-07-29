# Delta for live-vehicle-status

## ADDED Requirements

### Requirement: Status derives from online state and speed

The system MUST derive exactly `en-route`, `stopped`, or `offline`.

#### Scenario: Positive online speed is en route
- GIVEN online telemetry with positive speed
- WHEN status derives
- THEN status is `en-route`

#### Scenario: Online zero speed is stopped
- GIVEN online telemetry with zero speed
- WHEN status derives
- THEN status is `stopped`

#### Scenario: Online absent speed is stopped
- GIVEN online telemetry without speed
- WHEN status derives
- THEN status is `stopped`

#### Scenario: Not online is offline
- GIVEN telemetry resolves not online
- WHEN status derives
- THEN status is `offline` regardless of speed

#### Scenario: Missing telemetry is offline
- GIVEN no telemetry
- WHEN status derives
- THEN status is `offline`

### Requirement: Provider online flag takes precedence

The system MUST trust explicit `online` and MUST infer freshness only when that flag is absent.

#### Scenario: Explicit true beats stale GPS
- GIVEN `online: true` and a report older than the threshold
- WHEN online state resolves
- THEN it resolves online

#### Scenario: Explicit false beats fresh GPS
- GIVEN `online: false` and a fresh report
- WHEN online state resolves
- THEN it resolves offline

#### Scenario: Absent flag with fresh report is online
- GIVEN no online flag and a report within threshold
- WHEN online state resolves
- THEN it resolves online

#### Scenario: Absent flag with stale report is offline
- GIVEN no online flag and a report beyond threshold
- WHEN online state resolves
- THEN it resolves offline

#### Scenario: Absent flag without report is offline
- GIVEN no online flag or timestamp
- WHEN online state resolves
- THEN it resolves offline

### Requirement: Runtime configuration supplies the required threshold

Runtime configuration MUST resolve `SENTINEL_LIVE_STALE_AFTER_MS`, default absent or invalid values to `300000` milliseconds, and inject the result. The domain rule MUST require threshold and current time and MUST NOT read environment or clock.

#### Scenario: Invalid configuration defaults to five minutes
- GIVEN the environment value is absent or invalid
- WHEN runtime configuration resolves
- THEN the injected threshold is `300000`

#### Scenario: Valid configuration is injected
- GIVEN a valid positive environment duration
- WHEN runtime configuration composes status derivation
- THEN that duration is the required threshold

#### Scenario: Identical inputs are deterministic
- GIVEN identical telemetry, threshold, and time
- WHEN resolution runs twice
- THEN both results match

### Requirement: DeviceTelemetry.online represents omission

`DeviceTelemetry.online` MUST be optional so omission differs from explicit `false`.

(Previously: `online` was a required boolean.)

#### Scenario: Omission differs from false
- GIVEN one record omits `online` and another sets `false`
- WHEN inspected
- THEN only the omitted flag is eligible for freshness inference
