# Design: Separate Live Sidebar Filter and Expansion State

## Technical Approach

Make sidebar composition a one-way projection of two independent inputs: filters determine the visible fleet roster and vehicle rows; `expandedFleetIds`, owned by `LiveScreen`, determines whether each surviving fleet displays its rows. The application builder must not infer expansion from an active filter.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Expansion owner | Keep `expandedFleetIds` as explicit client state in `LiveScreen` and change it only through `toggleExpanded`. | Derive expansion in the sidebar builder; maintain per-filter expansion snapshots. | The screen owns operator interaction state; snapshots add behavior not requested. |
| Expansion projection | Set `LiveFleetNode.isExpanded` exclusively from `expandedFleetIds.has(fleet.fleetId)`. | Retain `shouldAutoExpandFleets` for status/search; special-case provider. | One source removes all filter-specific exceptions and makes collapse durable. |
| Filter boundary | Retain provider, status, and search as inputs to visible-roster composition only. | Pass filters into expansion state or reset expansion on a filter change. | Filters answer what is visible, not what the operator has opened. |
| Selection semantics | Leave full-roster counts and fleet checkbox selection unchanged. | Base them on filtered rows. | This bug concerns view expansion; changing selection would be unrelated and risky. |

## Data Flow

```text
LiveScreen
  expandedFleetIds ---------------+
  search/status/provider ---------+--> buildLivePageViewModel --> buildLiveSidebarViewModel
                                                         |               |
                                                         |               +--> filter full roster --> visible nodes
                                                         +--> expandedFleetIds --> node.isExpanded
                                                                            |
                                                                            v
                                                                    LiveSidebar --> LiveFleetNode
```

`LiveScreen` preserves `expandedFleetIds` while a filter setter changes search, status, or provider. It passes both sets of inputs to `buildLivePageViewModel`. The page builder forwards them unchanged. The sidebar builder first calculates full-roster counts/selection, then applies filters to determine visibility. For every remaining fleet it projects `isExpanded` from the explicit expanded-id set only. The sidebar renders vehicle rows only when that resulting flag is true.

Direct fleet disclosure clicks call `toggleExpanded`; fleet checkbox clicks remain selection-only. No filter event may call or modify the expansion setter.

## File Changes

| File | Action | Description |
|---|---|---|
| `application/live/build-live-sidebar-view-model.ts` | Modify | Remove `shouldAutoExpandFleets`; derive `isExpanded` only from `expandedFleetIds`. |
| `application/live/build-live-sidebar-view-model.test.ts` | Modify | Replace status-forced-expansion assertion with collapsed/opened regressions for status, provider, and search. |
| `application/live/build-live-page-view-model.test.ts` | Modify | Prove filter inputs and expanded IDs are forwarded independently without changing map/bottom-panel composition. |
| `components/live/live-screen.tsx` | Verify/no functional change expected | Retain `expandedFleetIds` and ensure only `toggleExpanded` mutates it. |
| `components/live/live-screen.test.tsx` | Modify | Exercise open, filter, close, and later filter change through the rendered sidebar for each filter type. |
| `docs/architecture/05-live-application-responsibilities.md` | Modify | Replace auto-expansion prose with the sole-owner rule. |

## Interfaces / Contracts

No public type changes are required. Existing inputs remain the contract:

```ts
type BuildLiveSidebarViewModelInput = {
  expandedFleetIds?: string[];
  searchTerm: string;
  status?: LiveStatusFilter;
  provider?: string;
};
```

Invariant:

```ts
node.isExpanded === new Set(expandedFleetIds).has(node.fleetId)
```

Filters may remove a fleet from `fleets`; they must not add or remove an ID from `expandedFleetIds`. If the fleet becomes visible again, its prior explicit state is reflected.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Each active status, provider, and search leaves an unlisted visible fleet collapsed; listed fleets remain expanded. | `build-live-sidebar-view-model.test.ts` table-driven cases. |
| Composition | Page builder passes filters and expansion state independently; map/bottom panel remain unchanged. | `build-live-page-view-model.test.ts`. |
| Interaction | Open a matching fleet, apply each filter, close it, then alter/reset the filter; rows stay hidden until a direct disclosure click. | React Testing Library in `live-screen.test.tsx`. |
| Regression guard | Full-roster counts and checkbox selection remain unchanged under filtering. | Preserve and run existing sidebar selection tests. |

## Migration / Rollout

No migration, feature flag, or persisted-state handling is required. This is an in-memory view-state correction. Rollback is a focused revert of the builder, tests, and responsibility documentation.

## Open Questions

None. Search-result auto-reveal is explicitly out of scope and requires a separate product decision if desired.

## Later Compatibility

Server-side pagination subsequently introduced default expansion for groups on
the active page. The page loader may therefore initialize expansion state;
filter setters remain independent and never mutate it. The view-model invariant
continues to hold: `isExpanded` is projected from the supplied
`expandedFleetIds`, never inferred from filter values.
