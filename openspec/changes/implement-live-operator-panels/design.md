# Design: implement-live-operator-panels

## Technical Approach

Implement the next live slice as pure `application/live` composition functions that turn normalized fleet/vehicle state into `LiveSidebarViewModel` and `LiveBottomPanelViewModel`. This extends the current map/playback use-case style and keeps delivery passive.

## Architecture Decisions

### Decision: Keep sidebar and bottom panel as separate use cases

**Choice**: Create one pure composer per surface.
**Alternatives considered**: A single `buildLivePageViewModel` function now.
**Rationale**: Smaller functions fit the repo rule of small maintainable units and keep tests focused.

### Decision: Add minimal application input types instead of framework state

**Choice**: Define explicit inputs for fleets, selection, search, and bottom-panel datasets.
**Alternatives considered**: Passing React/UI state objects directly.
**Rationale**: Application must stay framework-agnostic and reusable by routes or UI.

### Decision: Use null-preserving rows for partial data

**Choice**: Keep missing tab cell values as `null` in application output.
**Alternatives considered**: Replacing them with display strings in application.
**Rationale**: Delivery owns the final `-` rendering while application preserves semantic missing data.

## Data Flow

```text
normalized live state
   ├── selection + search + fleets ──> buildLiveSidebarViewModel
   └── selection + tab datasets ─────> buildLiveBottomPanelViewModel
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `application/live/contracts.ts` | Modify | Add explicit input contracts for sidebar and bottom-panel composition |
| `application/live/build-live-sidebar-view-model.ts` | Create | Sidebar composition use case |
| `application/live/build-live-bottom-panel-view-model.ts` | Create | Bottom-panel composition use case |
| `application/live/index.ts` | Modify | Export the new use cases |
| `application/live/build-live-sidebar-view-model.test.ts` | Create | Sidebar behavior tests |
| `application/live/build-live-bottom-panel-view-model.test.ts` | Create | Bottom-panel behavior tests |

## Interfaces / Contracts

```ts
type LiveFleetState = {
  fleetId: string;
  label: string;
  vehicleIds: string[];
};

type BuildLiveSidebarViewModelInput = {
  fleets: LiveFleetState[];
  liveVehicles: LiveVehicleState[];
  selectedVehicleIds: string[];
  searchTerm: string;
  expandedFleetIds?: string[];
  onlyActiveOrOnline?: boolean;
};

type BuildLiveBottomPanelViewModelInput = {
  selectedVehicleIds: string[];
  liveVehicles: LiveVehicleState[];
  activeTab: LiveBottomPanelTab["key"];
  tabs: LiveBottomPanelTab[];
};
```

`onlyActiveOrOnline` is part of the input because `LiveSidebarViewModel.filters` requires it in the output. The sidebar search placeholder is an application-owned constant, consistent with the empty-state messages already returned by `buildLiveMapViewModel`.

`LiveVehicleNode` operational flags are derived rather than passed in:

| Flag | Derivation |
|------|------------|
| `isOnline` | `telemetry.online === true` |
| `hasValidGps` | `hasValidGps(telemetry)` from `domain/live` |
| `canOpenLive` | `isOnline && device.isActive === true` |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Sidebar defaults, fleet selection, and search expansion | Test pure composer against fixed inputs |
| Unit | Bottom-panel empty state and partial-data rows | Test row composition with missing cells |
| Integration | None in this slice | Delivery remains out of scope |

## Migration / Rollout

No migration required.

## Open Questions

- [x] Whether search should match `plate` and `internalCode` in the first implementation or only `label`
  - **Resolved**: search matches vehicle `label`, vehicle `plate`, and fleet `label`. `internalCode` is deliberately excluded for now.
  - A fleet-label match keeps all of that fleet's vehicles visible; a vehicle-only match narrows the fleet to the matching vehicles.
  - Matching is case-insensitive and ignores surrounding whitespace.
