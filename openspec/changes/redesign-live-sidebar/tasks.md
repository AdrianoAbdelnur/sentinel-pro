# Tasks: redesign-live-sidebar

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2000-2900 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 7 chained PRs (see below) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain status rule (`vehicle-status.ts`, tests, doc) | PR 1 | Additive, ~150-220 lines, no consumer yet |
| 2 | Copy relocation: codes replace sentences everywhere, incl. tab/column keys | PR 2 | ~350-500 lines; touches 4 use cases + 2 panels + fixture + tests; likely still over budget alone |
| 3 | Runtime config module (env + clock) | PR 3 | ~120-180 lines, additive, depends on PR 1 in spirit only |
| 4 | Sidebar builder rewrite: status/provider narrowing, counts, D7 bug fix | PR 4 | Largest slice, ~500-750 lines; depends on PR 1 + PR 3; heavy test churn is expected, not a red flag |
| 5 | In-memory fixture matrix (7 vehicles) | PR 5 | ~250-350 lines; depends on PR 1 only, independent of PR 4's builder tests (separate fixtures) |
| 6 | Sidebar filter components + hook | PR 6 | ~250-350 lines; depends on PR 4's filter contract |
| 7 | Sidebar list components + shell wiring + docs | PR 7 | ~400-550 lines; depends on PR 4, PR 5, PR 6 |

Two units (2 and 4, possibly 7) may still exceed 400 lines even after this split; flag to the user before apply rather than silently accepting.

## Phase 1: Contract Reconciliation (blocks Phase 6)

- [ ] 1.1 Resolve a real conflict found in required reading: `live-operator-panels/spec.md`'s ADDED requirement types the status filter as a scalar (`all | en-route | stopped | offline`), while `design.md` D6 specifies a multi-select set (`statuses: VehicleStatus[]`, empty = all, chip toggles, explicit "Todos"). The two are incompatible. Confirm the set model ships (it matches the named chip components and D8); then edit the spec's requirement text and its "Default filters" scenario to the array model.

## Phase 2: Domain — Vehicle Status Rule

- [ ] 2.1 Write failing tests in `domain/live/vehicle-status.test.ts`: every resolution-table row, exact-threshold, future-timestamp (clock skew), literal `nowMs`.
- [ ] 2.2 Implement `domain/live/vehicle-status.ts`: `VehicleStatus`, `resolveVehicleStatus`, `DEFAULT_STALE_AFTER_MS`.
- [ ] 2.3 Make `DeviceTelemetry.online` optional in `domain/live/entities.ts`.
- [ ] 2.4 Export the new module from `domain/live/index.ts`.
- [ ] 2.5 Update `docs/architecture/03-live-core-domain.md` to document `online?` and the status rule.

## Phase 3: Copy Relocation — Codes Replace Sentences

- [ ] 3.1 In `application/live/contracts.ts`: extract `LiveMapEmptyStateCode`, `LiveBottomPanelEmptyStateCode`, `LivePlaybackNoticeCode`; drop `label` from `LiveBottomPanelTab`/`LiveTableColumn`.
- [ ] 3.2 Update `build-live-map-view-model.ts`, `build-live-bottom-panel-view-model.ts`, `open-vehicle-live.ts` to drop `message`; update their existing tests.
- [ ] 3.3 Create `components/live/live-copy.ts`: one `Record<Code, string>` per union (never `Partial`), plus `BOTTOM_PANEL_TAB_COPY`/`BOTTOM_PANEL_COLUMN_COPY`.
- [ ] 3.4 Write failing `live-copy.test.ts` asserting no value is an empty string.
- [ ] 3.5 Update `live-map-panel.tsx`, `live-bottom-panel.tsx` to render by code/key; render `Sí`/`No`.
- [ ] 3.6 Update `in-memory-live-data-source.ts` tabs/columns to drop `label`.
- [ ] 3.7 Update `live-screen.test.tsx`: replace English regexes with copy-constant assertions.

## Phase 4: Runtime Config — Clock and Threshold

- [ ] 4.1 Write failing tests for `app/live/live-runtime-config.test.ts`: default, valid override, invalid value falls back.
- [ ] 4.2 Implement `app/live/live-runtime-config.ts` (`readLiveRuntimeConfig`) — the only `process.env` read in the repo.
- [ ] 4.3 Create `.env.example` documenting `SENTINEL_LIVE_STALE_AFTER_MS=300000`.

## Phase 5: Sidebar Builder Rewrite + Fleet-Selection Bug Fix

- [ ] 5.1 Widen `application/live/contracts.ts`: `LiveVehicleNode` (status, speedKmH, lastReportAt, provider; drop `isOnline`/`secondaryLabel`), `LiveFleetNode.counts` required, `LiveSidebarViewModel.filters` (statuses/provider/availableProviders/isNarrowed), `BuildLiveSidebarViewModelInput` (`nowMs`/`staleAfterMs` required), drop `search.placeholder`.
- [ ] 5.2 Write a dedicated regression test in `build-live-sidebar-view-model.test.ts` pinning the D7 bug: today `isSelected` is computed after `onlyActiveOrOnline` but before search — assert it now ignores search AND status/provider narrowing alike, against the fleet's full roster.
- [ ] 5.3 Write failing tests: status/provider narrowing, counts over full roster, `availableProviders`, `isNarrowed`, offline-speed suppression (both stored-speed cases), online-zero-speed stays `0`.
- [ ] 5.4 Implement the rewrite: resolve status via `resolveVehicleStatus`, compute counts/providers/isSelected pre-narrowing, apply status→provider→search narrowing, remove `onlyActiveOrOnline` end to end.
- [ ] 5.5 Convert whole-object assertions to `toMatchObject`; keep exactly one full-shape `toEqual` contract test.
- [ ] 5.6 Thread `nowMs`/`staleAfterMs` through `build-live-page-view-model.ts` and its test.
- [ ] 5.7 Update `app/live/page.tsx`: call `readLiveRuntimeConfig()`, capture `Date.now()` once, pass both down.

## Phase 6: In-Memory Fixture Matrix

- [ ] 6.1 Write failing tests in `in-memory-live-data-source.test.ts`: all 3 statuses present, flattened sub-fleet, one empty fleet, 3 distinct providers, one vehicle with neither telemetry nor device.
- [ ] 6.2 Rewrite `in-memory-live-data-source.ts` to the 7-vehicle matrix; declare `gpsAgoMs`, materialize against `Date.now()` at read time.

## Phase 7: Sidebar Filter Components

- [ ] 7.1 Write failing tests for `use-live-sidebar-filters.ts`: toggle adds/removes a status, "Todos" clears the set, provider set/cleared.
- [ ] 7.2 Implement the hook.
- [ ] 7.3 Write failing tests for chip toggling (`aria-pressed`, "Todos" active when empty) and the provider `<select>`.
- [ ] 7.4 Implement `live-status-filter-chips.tsx`, `live-provider-filter.tsx`, `live-sidebar-filters.tsx`, `vehicle-status-tone.ts`.

## Phase 8: Sidebar List Components + Shell Wiring

- [ ] 8.1 Write failing tests for `live-vehicle-row.tsx` (plate headline, status badge, speed, last report, provider badge, offline row has no speed) and the two badge components.
- [ ] 8.2 Implement `live-vehicle-row.tsx`, `live-vehicle-status-badge.tsx`, `live-provider-badge.tsx` under `components/live/sidebar/`.
- [ ] 8.3 Write failing tests for `live-fleet-node.tsx`: header counts, sticky header, visible-of-total when narrowed.
- [ ] 8.4 Implement and move `live-fleet-node.tsx` into `components/live/sidebar/`.
- [ ] 8.5 Implement and move `live-sidebar.tsx` shell composing filters + fleet list + empty state.
- [ ] 8.6 Update `live-screen.tsx`: wire the hook, drop `onlyActiveOrOnline` state, pass `nowMs`/`staleAfterMs` props.
- [ ] 8.7 Update `live-screen.test.tsx` end to end for the new filters.
- [ ] 8.8 Update the affected architecture doc(s) for the new sidebar composition.

## Phase 9: Verification

- [ ] 9.1 Run the full test suite.
- [ ] 9.2 Run lint, typecheck, and build.
- [ ] 9.3 Grep `\.online` — confirm exactly one hit outside fixtures and `domain/live/vehicle-status.ts`.
- [ ] 9.4 Confirm no sidebar component branches on `Device.provider`.
