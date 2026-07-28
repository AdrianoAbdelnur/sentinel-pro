# Design: implement-live-page-shell

## Technical Approach

Add one page-level composition use case in `application/live`, feed it from an in-memory source behind a read port, and render the result through small presentational components. Exactly one client component owns interaction state; everything below it is a pure function of its props.

## Architecture Decisions

### Decision: One client island, presentational children

**Choice**: `app/live/page.tsx` stays a server component that reads the data source and hands it to a single `"use client"` screen component. That screen owns selection, expansion, search, and active tab, and recomposes the page view model on every render. All child components are presentational.

**Alternatives considered**: Making every interactive component a client component with its own state.

**Rationale**: Keeps a single, inspectable source of interaction state and prevents selection rules from spreading across the tree. Recomposition is a pure synchronous call over in-memory data, so no memoization is warranted yet.

### Decision: Read live state through a narrow port

**Choice**: Define `LiveDataSource` in `application/live` with a single `readLiveState()` returning fleets and vehicles. The in-memory module implements it.

**Alternatives considered**: Importing the fixture module directly from the route.

**Rationale**: The route depends on an application contract, not on a concrete source. A provider adapter can replace the implementation without touching delivery. This is the dependency rule the repo requires.

### Decision: Delivery owns the missing-value fallback

**Choice**: Application keeps `null` for missing cells; the table component renders `—`.

**Alternatives considered**: Formatting the fallback inside the application layer.

**Rationale**: Already established by the operator-panels slice. Presentation strings belong to delivery.

### Decision: Fleet checkbox toggles all of its vehicles

**Choice**: Toggling a fleet selects every vehicle in it, or clears them all when it was fully selected.

**Alternatives considered**: A separate fleet-level selection concept.

**Rationale**: `LiveFleetNode.isSelected` is already derived from its children, so a fleet-level selection would introduce a second, conflicting source of truth.

## Data Flow

```text
app/live/page.tsx  (server)
   └─ inMemoryLiveDataSource.readLiveState()
        └─ <LiveScreen liveState />        (client, owns interaction state)
             └─ buildLivePageViewModel(...)
                  ├─ <LiveSidebar sidebar />        (presentational)
                  └─ <LiveBottomPanel bottomPanel />(presentational)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `application/live/contracts.ts` | Modify | Add `LiveState`, `LiveDataSource`, `BuildLivePageViewModelInput` |
| `application/live/build-live-page-view-model.ts` | Create | Page composition use case |
| `application/live/build-live-page-view-model.test.ts` | Create | Delegation and overlay defaults |
| `application/live/index.ts` | Modify | Export the page use case |
| `integrations/live/in-memory/in-memory-live-data-source.ts` | Create | Development data source |
| `integrations/live/in-memory/in-memory-live-data-source.test.ts` | Create | Guarantees degraded states exist |
| `app/live/page.tsx` | Create | Route entry, server component |
| `components/live/live-screen.tsx` | Create | Client island owning interaction state |
| `components/live/live-screen.test.tsx` | Create | Interaction coverage |
| `components/live/live-sidebar.tsx` | Create | Search box, filter, fleet list |
| `components/live/live-fleet-node.tsx` | Create | One fleet with its vehicles |
| `components/live/live-bottom-panel.tsx` | Create | Tabs and table |

## Interfaces / Contracts

```ts
type LiveState = {
  fleets: LiveFleetState[];
  liveVehicles: LiveVehicleState[];
};

type LiveDataSource = {
  readLiveState: () => LiveState;
  readBottomPanelTabs: () => LiveBottomPanelTab[];
};

type BuildLivePageViewModelInput = {
  liveState: LiveState;
  selectedVehicleIds: string[];
  searchTerm: string;
  activeTab: LiveBottomPanelTab["key"];
  tabs: LiveBottomPanelTab[];
  expandedFleetIds?: string[];
  onlyActiveOrOnline?: boolean;
  playback?: LivePlaybackOverlayViewModel;
};
```

`readBottomPanelTabs` was added during implementation: the bottom panel needs tabular datasets, and letting the route invent them would have made delivery the owner of a data contract. It belongs to the same source as the operational state.

Both reads are synchronous because the in-memory source is synchronous. When a provider adapter arrives it will need an async port; that change is deliberately deferred rather than guessed at now.

The screen renders the vehicle label column from a `vehicleId -> label` lookup built in the client island, because `LiveTableRow` carries only ids. This is a presentation lookup, not a business rule.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Page composition delegates to the existing use cases | Compare against direct use-case output |
| Unit | In-memory source exposes offline and GPS-less vehicles | Assert on the fixture shape |
| Component | Render, select, search, tab switch, null fallback | Testing Library over the client screen |

## Migration / Rollout

No migration. The route is additive and the home page is untouched.

## Open Questions

- None. The map and playback surfaces are explicitly deferred to a later change.
