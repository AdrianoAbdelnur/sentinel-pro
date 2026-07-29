# Proposal: redesign-live-sidebar

## Intent

Rebuild the live sidebar to the supplied target design: each vehicle shows plate as primary identifier, a status badge, last report time, speed and a provider badge, grouped under fleet headers carrying a count, with search, a provider dropdown and status chips above the list. Today the sidebar renders only a label, a plate subtitle and a binary online dot behind one `onlyActiveOrOnline` checkbox, so an operator cannot distinguish a moving vehicle from a stopped one, nor tell which provider reports it.

## Scope

### In Scope
- Status model: `en-route` (online, speed > 0), `stopped` (online, speed 0 or unreported), `offline`
- Online resolution: trust the provider flag when sent; staleness fallback (default 5 min, env-configurable) only when absent
- `DeviceTelemetry.online` becomes optional, so "not reported" is distinguishable from "reported false"
- Vehicle node gains plate-first label, status, speed, last report, provider badge; fleet headers gain counts
- Status chips and provider dropdown replace the `onlyActiveOrOnline` boolean filter
- Flat fleet grouping; provider sub-fleets flattened into sibling fleets
- Copy ownership moves out of application: use cases return codes, delivery renders the Spanish words

### Out of Scope
- Street address and reverse geocoding
- The CONVOYS tab
- Provider adapters and remote fetching
- Company/Customer as a visible grouping level (it stays the tenant scoping axis)
- Real fleet/sub-fleet nesting

## Capabilities

### New Capabilities
- `live-vehicle-status`: domain resolution of vehicle status from telemetry — provider-flag precedence, staleness fallback with threshold and clock injected, threshold resolved at the composition root

### Modified Capabilities
- `live-operator-panels`: sidebar node and filter contracts change (status, speed, last report, provider, fleet counts; status + provider filters replace the boolean); bottom-panel empty state returns a code with no message
- `live-page-shell`: page composition input carries the new filters instead of `onlyActiveOrOnline`; delivery renders the new controls and owns all user-facing copy
- `live-map-rendering`: the map panel selects its empty-state text by code instead of displaying a message supplied by the view model

**Why the status filter is not a new capability.** It is a different axis of the behavior `live-operator-panels` already owns: composing the sidebar from operational state. `buildLiveSidebarViewModel` stays a single use case, so splitting filtering into its own spec would force every future sidebar change to touch two specs. What is genuinely new is the status *derivation* rule — a reusable domain predicate independent of the sidebar, hence `live-vehicle-status`.

## Approach

Add a pure domain function resolving status from telemetry, following the existing `hasValidGps` precedent, with `now` and the staleness threshold injected rather than read internally. Widen the sidebar node and filter contracts, populate the already-typed but unused `LiveFleetNode.counts`, and reduce use-case outputs to codes. Read the env var once at the composition root and thread it down as a number. Rebuild the sidebar from small components: filter bar, status chips, fleet header, vehicle row.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `domain/live/entities.ts` | Modified | `DeviceTelemetry.online` becomes optional |
| `domain/live/vehicle-status.ts` | New | Pure status resolution, threshold and clock injected |
| `application/live/contracts.ts` | Modified | Vehicle node fields, filter contracts, empty states as codes |
| `application/live/build-live-sidebar-view-model.ts` | Modified | Status/provider filtering, counts, new per-vehicle fields |
| `application/live/build-live-map-view-model.ts`, `build-live-bottom-panel-view-model.ts`, `open-vehicle-live.ts` | Modified | Drop literal messages, return codes only |
| `components/live/*` | Modified | New sidebar composition plus Spanish copy for every code |
| `integrations/live/in-memory/*` | Modified | Fixtures for absent flag, stale report and explicit false |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Re-cutting an archived capability's contract: `live-operator-panels` requirements shipped and were promoted, and this change replaces part of them rather than extending | High | Write delta specs that supersede the affected requirements explicitly; do not leave both filter contracts alive |
| Domain type change: making `online` optional weakens an invariant every current consumer assumes | Medium | Blast radius verified as 2 call sites plus 1 test assertion; the new domain function becomes the only sanctioned reader |
| Copy relocation reaches beyond the sidebar, into map and bottom-panel empty states and the playback notice | High | Land the copy move as its own work unit before the sidebar rework, so a regression is attributable |
| Provider badge value is unverified — PRAXSYS and SENTINELPRO are real but not integrated yet | Medium | Render `Device.provider` as-is; introduce no mapping table until an adapter exists |
| Test churn: sidebar tests assert whole objects with `toEqual`, so every new field touches every assertion | High | Mechanical, not risky; expect a large diff for a smaller logic change |

## Rollback Plan

Revert in reverse order of the work units: sidebar components, then the filter contract, then the copy relocation, then the domain function and the `online` optionality. The copy relocation is independently revertible because it only replaces literal strings with codes; the filter contract change is not, since `onlyActiveOrOnline` is removed end to end.

## Dependencies

- `openspec/specs/live-operator-panels/spec.md`, `live-page-shell/spec.md`, `live-map-rendering/spec.md`
- `domain/live/device-telemetry.ts` (the `hasValidGps` pattern to follow)
- An env-var read at the composition root; no config library is installed today

## Success Criteria

- [ ] Status is derived by one pure domain function, with the threshold and clock injected
- [ ] A vehicle whose provider sends no flag falls back to staleness; an explicit `false` never does
- [ ] The sidebar renders plate, status, last report, speed, provider badge, and fleet counts
- [ ] Status chips and the provider dropdown filter the list; `onlyActiveOrOnline` no longer exists
- [ ] No use case returns a user-facing sentence; every empty state and notice is a code
- [ ] Screen copy is Spanish, code and artifacts stay English
