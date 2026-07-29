# Design: implement-live-core-slice

## Technical Approach

Implement the first live slice as small TypeScript modules with pure functions. The slice will not talk to frameworks or providers. It will encode the first business rules that later delivery and integration layers will orchestrate.

## Architecture Decisions

### Decision: Separate domain contracts from application contracts

**Choice**: Put entities and playback primitives in `domain/live`, then put view models, ports, and use cases in `application/live`.
**Alternatives considered**: Keep every live type in one folder.
**Rationale**: The domain should stay free of UI composition concerns, while the application layer owns page contracts and orchestration rules.

### Decision: Start with pure functions before services or classes

**Choice**: Implement `hasValidGps`, `buildLiveMapViewModel`, and `openVehicleLive` as pure functions.
**Alternatives considered**: Create stateful services immediately.
**Rationale**: The first slice should be boring to test and easy to adapt as integrations arrive.

### Decision: Keep provider behavior behind an application port

**Choice**: `openVehicleLive` receives a playback resolver function/port that returns provider-agnostic outcomes.
**Alternatives considered**: Import provider adapters directly from the use case.
**Rationale**: Application owns decisions; integrations only resolve playable tiles.

## Data Flow

```text
domain/live contracts
        |
        v
application/live contracts + ports
        |
        +--> buildLiveMapViewModel(selected vehicles -> markers / empty state)
        |
        +--> openVehicleLive(vehicleId + current monitor + resolver -> append / notice / noop)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `domain/live/entities.ts` | Create | Operational live entities |
| `domain/live/playback.ts` | Create | Playback contracts |
| `domain/live/device-telemetry.ts` | Create | Domain helper for GPS validity |
| `domain/live/index.ts` | Create | Domain live exports |
| `application/live/contracts.ts` | Create | View models, ports, and result contracts |
| `application/live/build-live-map-view-model.ts` | Create | Map composition use case |
| `application/live/open-vehicle-live.ts` | Create | Playback opening use case |
| `application/live/index.ts` | Create | Application live exports |
| `domain/live/device-telemetry.test.ts` | Create | Domain helper tests |
| `application/live/build-live-map-view-model.test.ts` | Create | Map use case tests |
| `application/live/open-vehicle-live.test.ts` | Create | Playback use case tests |

## Interfaces / Contracts

### Domain

- `Customer`
- `Fleet`
- `Vehicle`
- `Device`
- `DeviceTelemetry`
- `LiveSelectionState`
- `LiveMonitor`
- `LiveTile`
- `hasValidGps(telemetry)`

### Application

- `LiveVehicleState`
- `LiveMapViewModel`
- `LivePlaybackNotice`
- `LivePageViewModel`
- `openedVehicleIds` as session-level input for deduplication
- `ResolveVehiclePlayback`
- `OpenVehicleLiveResult`
- `buildLiveMapViewModel(input)`
- `openVehicleLive(input)`

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | GPS validity helper | RED/GREEN with happy path and invalid coordinate cases |
| Unit | Map composition rules | Selected vehicles, no selection, and no-mappable-selection scenarios |
| Unit | Playback opening rules | Append tiles, offline notice, no-video notice, and already-open noop |

## Migration / Rollout

No migration required. Later slices can add adapters that implement the exported application port.

## Open Questions

- [ ] Whether `LiveVehicleState` should later become a richer aggregate/value object once selection and sidebar use cases are implemented
