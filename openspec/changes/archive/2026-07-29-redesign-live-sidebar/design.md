# Design: Redesign and Reconcile the Live Sidebar

## Technical Approach

Keep the implemented provider-agnostic flow and correct only the documentation mismatch plus one delivery-layer typography issue. Runtime configuration resolves the staleness threshold, the domain derives status from explicit inputs, application composition filters normalized models, and React renders view models. TDD adds focused regression evidence before changing the fleet label classes.

## Architecture Decisions

| Decision | Alternatives considered | Rationale |
|---|---|---|
| Require `nowMs` and `staleAfterMs` in status resolution; read `SENTINEL_LIVE_STALE_AFTER_MS` at the composition root with a `300000` ms fallback. | Domain reads environment/clock; domain owns a default argument. | Keeps the domain deterministic and configurable without infrastructure dependencies. |
| Explicit `telemetry.online` takes precedence; GPS freshness is inferred only when the flag is absent. | Always derive from GPS age. | Preserves normalized provider truth while retaining a provider-agnostic fallback. |
| Keep one scalar status filter and one optional provider filter. | A set of simultaneous statuses. | Matches the existing controls and application contract without unnecessary state complexity. |
| Keep fleet counts as `online/total`, calculated from the full roster. | Counts for each of the three statuses. | The compact header communicates availability while filtering only changes visible rows. |
| Keep the expanded sidebar at `w-72`; render fleet labels on one truncated line with compact typography, original casing, and normal tracking. | Widen the sidebar; allow two lines. | Improves readability without reducing map space or changing sidebar geometry. |
| Keep arbitrary column keys and render known Spanish copy with raw-key fallback. | Exhaustive compile-time column localization. | Preserves the data-source contract and defers non-priority localization enforcement. |
| Keep playback notice codes in application contracts but do not render them yet. | Add notice UI now. | There is no playback monitor; delivery should add that surface with the future playback slice. |
| Keep sidebar controls outside the independently scrolling fleet-list region. | Scroll the complete sidebar or page. | Search and filters remain available while long lists do not move the map. |
| Preserve the existing small sidebar components, single `LiveScreen` client island, filter hook, static status-class records, and relative-age fixtures. | Recombine logic or redesign established structure. | These boundaries already isolate delivery state, keep Tailwind extraction reliable, and keep fixtures deterministic. |

## Data Flow

```text
process.env -> readLiveRuntimeConfig -> LivePage(nowMs, staleAfterMs)
normalized LiveState + UI inputs -> buildLivePageViewModel
  -> resolveVehicleStatus -> scalar filters/search -> LiveSidebarViewModel
  -> LiveScreen -> LiveSidebar -> fixed controls + scrolling fleet list
```

Provider identities remain data, never UI branching conditions.

## File Changes

| File | Action | Description |
|---|---|---|
| `openspec/changes/redesign-live-sidebar/design.md` | Modify | Reconcile design with accepted runtime behavior. |
| `components/live/sidebar/live-fleet-node.tsx` | Modify | Remove forced uppercase and wide tracking while retaining a single truncated line. |
| `components/live/sidebar/live-fleet-node.test.tsx` | Modify | Assert required compact label classes and forbidden wide-label classes. |
| `components/live/sidebar/live-sidebar.test.tsx` | Modify | Prove only the fleet-list region owns vertical overflow. |
| `domain/live/vehicle-status.test.ts` | Modify | Prove explicit `online: true` wins over stale GPS. |
| `application/live/build-live-sidebar-view-model.test.ts` | Modify | Prove search ignores `vehicle.internalCode`. |

No production domain, application, integration, or playback code changes are required.

## Interfaces / Contracts

Existing contracts remain authoritative:

```ts
type ResolveVehicleStatusInput = {
  telemetry?: DeviceTelemetry;
  nowMs: number;
  staleAfterMs: number;
};

type LiveStatusFilter = "all" | "en-route" | "stopped" | "offline";
type LiveFleetCounts = { online: number; total: number };
type LiveTableColumn = { key: string };
```

Search is case-insensitive and limited to fleet label, vehicle label, and plate. It does not inspect internal codes, provider metadata, device identifiers, or unrelated fields.

## Testing Strategy

| Layer | Evidence | Approach |
|---|---|---|
| Domain unit | Explicit provider precedence | Use a report older than the injected threshold with `online: true`; expect a non-offline status. |
| Application unit | Search boundary | Give a vehicle a unique `internalCode`; searching it returns no fleet. Existing tests retain fleet-label, vehicle-label, and plate matches. |
| Component | Scroll isolation | Inspect sidebar structure: controls are siblings of the `overflow-y-auto` list region, and the outer sidebar remains non-scrolling. |
| Component | Fleet typography | RED on current `uppercase`/wide tracking, then GREEN with compact single-line classes and unchanged `truncate`. |
| Project | Regression | Run tests, typecheck, lint, and build before verification and re-archive. |

## Migration / Rollout

No migration, feature flag, dependency, or API rollout is required. The visible change is limited to fleet-label typography.

## Open Questions

None.
