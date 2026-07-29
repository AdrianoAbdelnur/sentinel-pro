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

- [x] 1.1 RESOLVED (user decision, 2026-07-29): the status filter is a **scalar** (`"all" | VehicleStatus`), not a multi-select set. `design.md` D6 was corrected to match the spec (it now documents `status: LiveStatusFilter` and explicitly records the rejected multi-select alternative). `live-operator-panels/spec.md`'s ADDED requirement ("Status and provider filters narrow the visible sidebar") already used the scalar model and needed no further edit. `LiveStatusFilter` keeps `"all"` out of the `VehicleStatus` domain union, per D6. Implemented in `application/live/contracts.ts` (`LiveStatusFilter`) and consumed by `build-live-sidebar-view-model.ts`.

## Phase 2: Domain — Vehicle Status Rule

- [x] 2.1 Write failing tests in `domain/live/vehicle-status.test.ts`: every resolution-table row, exact-threshold, future-timestamp (clock skew), literal `nowMs`.
- [x] 2.2 Implement `domain/live/vehicle-status.ts`: `VehicleStatus`, `resolveVehicleStatus`, `DEFAULT_STALE_AFTER_MS`.
- [x] 2.3 Make `DeviceTelemetry.online` optional in `domain/live/entities.ts`.
- [x] 2.4 Export the new module from `domain/live/index.ts`.
- [x] 2.5 Update `docs/architecture/03-live-core-domain.md` to document `online?` and the status rule.

## Phase 3: Copy Relocation — Codes Replace Sentences

- [x] 3.1 In `application/live/contracts.ts`: extract `LiveMapEmptyStateCode`, `LiveBottomPanelEmptyStateCode`, `LivePlaybackNoticeCode`; drop `label` from `LiveBottomPanelTab`/`LiveTableColumn`.
- [x] 3.2 Update `build-live-map-view-model.ts`, `build-live-bottom-panel-view-model.ts`, `open-vehicle-live.ts` to drop `message`; update their existing tests.
- [x] 3.3 Create `components/live/live-copy.ts`: one `Record<Code, string>` per union (never `Partial`), plus `BOTTOM_PANEL_TAB_COPY`/`BOTTOM_PANEL_COLUMN_COPY`.
- [x] 3.4 Write failing `live-copy.test.ts` asserting no value is an empty string.
- [x] 3.5 Update `live-map-panel.tsx`, `live-bottom-panel.tsx` to render by code/key; render `Sí`/`No`.
- [x] 3.6 Update `in-memory-live-data-source.ts` tabs/columns to drop `label`.
- [x] 3.7 Update `live-screen.test.tsx`: replace English regexes with copy-constant assertions.

## Phase 4: Runtime Config — Clock and Threshold

- [x] 4.1 Write failing tests for `app/live/live-runtime-config.test.ts`: default, valid override, invalid value falls back.
- [x] 4.2 Implement `app/live/live-runtime-config.ts` (`readLiveRuntimeConfig`) — the only `process.env` read in the repo.
- [x] 4.3 Create `.env.example` documenting `SENTINEL_LIVE_STALE_AFTER_MS=300000`.

## Phase 5: Sidebar Builder Rewrite + Fleet-Selection Bug Fix

- [x] 5.1 Widened `application/live/contracts.ts`: `LiveVehicleNode` (`plate`, `label`, `status`, `speedKmH`, `lastReportAt`, `provider`; dropped `isOnline`/`secondaryLabel`), `LiveFleetNode.counts` required (`{ online, total }` — per user decision, not `byStatus`), `LiveSidebarViewModel.filters` (`status: LiveStatusFilter`, `provider?`, `availableProviders`, `isNarrowed`), `BuildLiveSidebarViewModelInput`/`BuildLivePageViewModelInput` (`nowMs`/`staleAfterMs` required), `search.placeholder` stays dropped (unit 2/3). Re-exported `VehicleStatus` from `@/domain/live`.
- [x] 5.2 Regression test added in `build-live-sidebar-view-model.test.ts`. RED confirmed against the *unmodified* implementation using the old `onlyActiveOrOnline` field (`npx vitest run` showed `expected true to be false`, i.e. a fully-visible-but-partially-selected fleet read as selected). After the rewrite the same scenario is re-expressed with the new `status` filter (`"REGRESSION (D7 fix): fleet selection state reflects the full roster, ignoring status narrowing"`) and passes.
- [x] 5.3 Failing tests written and now passing: status filter narrowing, provider filter narrowing (incl. vehicles without a device), default filters show everything, counts/`availableProviders`/`isSelected` computed pre-narrowing, `isNarrowed` toggling, forced expansion under status/provider narrowing, fleet dropping when narrowing empties it, offline-speed suppression (both stored-speed and no-stored-speed cases), online-zero-speed stays `0`, missing-telemetry renders absent fields.
- [x] 5.4 Implemented the rewrite in `build-live-sidebar-view-model.ts`: status resolved once per vehicle via `resolveVehicleStatus`; counts/`availableProviders`/`isSelected` computed over the full roster before narrowing; status → provider → search narrowing applied in that order; `onlyActiveOrOnline` removed end to end (contract, builder, `build-live-page-view-model.ts`, `live-screen.tsx`, `live-sidebar.tsx`).
- [x] 5.5 Test file uses `toMatchObject` for behavioral assertions; exactly one full-shape `toEqual` test, labelled `CONTRACT SHAPE`.
- [x] 5.6 Threaded `nowMs`/`staleAfterMs` through `build-live-page-view-model.ts` (both now required, forwarded unchanged to the sidebar builder) and its test (added a scenario asserting status/provider flow to the sidebar unchanged, per the `live-page-shell` delta).
- [x] 5.7 `app/live/page.tsx` already called `readLiveRuntimeConfig()` and captured `Date.now()` once as part of unit 3's scope (see that unit's apply-progress); confirmed still correct and now that `buildLivePageViewModel` actually requires `nowMs`/`staleAfterMs`, the wiring is exercised end to end (`npm run build`/`npm test` green).

## Phase 6: In-Memory Fixture Matrix

- [x] 6.1 Write failing tests in `in-memory-live-data-source.test.ts`: all 3 statuses present, flattened sub-fleet, one empty fleet, 3 distinct providers, one vehicle with neither telemetry nor device.
- [x] 6.2 Rewrite `in-memory-live-data-source.ts` to the 7-vehicle matrix; declare `gpsAgoMs`, materialize against `Date.now()` at read time.

## Phase 7: Sidebar Filter Components

- [x] 7.1 Wrote failing tests for `use-live-sidebar-filters.ts` in `components/live/use-live-sidebar-filters.test.ts`, confirmed RED (module did not resolve). Wording corrected against the original task text: per Phase 1's scalar decision, the status filter *replaces* the current value on every `setStatus` call rather than toggling membership in a set, and there is no "clears the set" case — "Todos" is expressed as `setStatus("all")`, one value among the union, not an empty-set sentinel. Tests cover: initial state (`searchTerm: ""`, `status: "all"`, `provider: undefined`), search term updates, status replacement (including returning to `"all"`), provider set/clear, and the three concerns varying independently.
- [x] 7.2 Implemented `components/live/use-live-sidebar-filters.ts`: one hook grouping `searchTerm`/`status`/`provider` behind three `useState` calls (per design D9, these are one "narrowing" concern, not one combined reducer), returning the three values plus `setSearchTerm`/`setStatus`/`setProvider`. All 6 tests green.
- [x] 7.3 Wrote failing tests for chip behavior (`components/live/sidebar/live-status-filter-chips.test.tsx`) and the provider `<select>` (`components/live/sidebar/live-provider-filter.test.tsx`), confirmed RED (modules did not resolve) before implementing. Chip assertions: one chip per status plus "Todos", `aria-pressed` true on exactly one chip at a time (never more), clicking a chip reports that single value (`toHaveBeenCalledWith`, `toHaveBeenCalledTimes(1)` — proving replacement, not accumulation), copy asserted via `VEHICLE_STATUS_COPY` per the language contract, "Todos" asserted via the component's own exported `ALL_STATUS_LABEL` constant (component-local word, design D5, not in the copy module). Provider `<select>` assertions: one `<option>` per `availableProviders` entry plus an all-providers option, correct option rendered as selected via `toHaveDisplayValue`, `onProviderChange` called with the raw (non-uppercased) provider string or `undefined` for the all-providers option, no option ever renders empty text.
- [x] 7.4 Implemented `components/live/sidebar/live-status-filter-chips.tsx`, `live-provider-filter.tsx`, `live-sidebar-filters.tsx`, `vehicle-status-tone.ts`. Added `VEHICLE_STATUS_COPY: Record<VehicleStatus, string>` to `components/live/live-copy.ts` (test-first in `live-copy.test.ts`) so the chips and the future row badge (unit 7/Phase 8) read the same Spanish words for a status. Wired `LiveSidebarFilters` into the existing `live-sidebar.tsx` shell (replacing its inline search input) and `useLiveSidebarFilters()` into `live-screen.tsx` (replacing the standalone `searchTerm` `useState` and threading `status`/`provider` into `buildLivePageViewModel`). Did not move `live-sidebar.tsx`/`live-fleet-node.tsx` into `components/live/sidebar/` and did not touch vehicle row/status badge/provider badge rendering — that move and those components are Phase 8 (unit 7).

## Phase 8: Sidebar List Components + Shell Wiring

- [x] 8.1 Wrote failing tests for `live-vehicle-row.tsx` (`components/live/sidebar/live-vehicle-row.test.tsx`, 13 cases: plate headline, label-only headline, status badge via `VEHICLE_STATUS_COPY`, speed rendering, offline-speed fallback, last-report `<time>` rendering and its missing-value fallback, provider badge present/absent, checkbox accessible name with/without plate, checked state, toggle callback) and the two badge components (`live-vehicle-status-badge.test.tsx`, `live-provider-badge.test.tsx`). Also wrote failing tests for a new supporting module, `format-last-report.test.ts` (timestamp formatting, see 8.2 note). Confirmed RED for all via unresolved-import errors (the correct reason) before implementing.
- [x] 8.2 Implemented `live-vehicle-row.tsx`, `live-vehicle-status-badge.tsx`, `live-provider-badge.tsx` under `components/live/sidebar/`. Also implemented `format-last-report.ts` (not originally listed in the file table, added because the timestamp format needed its own testable, hydration-safe unit — see the Timestamp note below). The row renders exactly what `LiveVehicleNode` gives it; it does not re-derive status or speed.
- [x] 8.3 Wrote failing tests for `live-fleet-node.tsx` (11 cases): fleet label, `online/total` counts text, Spanish `aria-label` on the counts cluster, sticky-header class, no visible-count text when not narrowed, visible-count text shown when narrowed, expand toggle state and callback, vehicles hidden while collapsed, vehicles rendered as rows while expanded, Spanish select-all checkbox name and callback, vehicle-toggle forwarding. Confirmed RED (unresolved import) before implementing.
- [x] 8.4 Implemented and moved `live-fleet-node.tsx` into `components/live/sidebar/`; deleted the old `components/live/live-fleet-node.tsx`. New prop `isNarrowed: boolean` added (fed from `sidebar.filters.isNarrowed`) so the header can show the visible count alongside the full-roster `online/total` counts (Known Problem #4's mitigation). The old inline per-vehicle markup (dot + raw label) is replaced by `<LiveVehicleRow>`.
- [x] 8.5 Implemented and moved `live-sidebar.tsx` into `components/live/sidebar/`; deleted the old `components/live/live-sidebar.tsx`. Fixed the flagged loose end: the empty-list state now reads `EMPTY_FLEETS_LABEL` ("Ningún resultado coincide con la búsqueda."), a component-local exported constant (design D5), replacing the English "No fleets match." Sidebar width widened `w-72` → `w-80` per the Visual Design section. Wrote a small dedicated test file (`live-sidebar.test.tsx`, 2 cases) for the empty-state fix, confirmed RED before implementing.
- [x] 8.6 Updated `live-screen.tsx`: only change needed was the import path for `LiveSidebar` (`./live-sidebar` → `./sidebar/live-sidebar`); the hook wiring, `onlyActiveOrOnline` removal and `nowMs`/`staleAfterMs` props were already done in units 4 and 6.
- [x] 8.7 Updated `live-screen.test.tsx` end to end: fixed the "Select all vehicles in North Fleet" assertion to the new Spanish copy, fixed the "live map" region-name regex to "mapa en vivo" (see English-literal sweep below), and added 3 new tests driving the actual status chips and provider `<select>` through the full `LiveScreen` composition (narrow by status, narrow by provider, reset to "Todos" restores the full roster) — previously this behavior was only covered at the application layer because the UI affordance did not exist yet.
- [x] 8.8 Updated `docs/architecture/05-live-application-responsibilities.md`: added a "Sidebar view model" section documenting the current `LiveVehicleNode`/`LiveFleetNode`/`LiveSidebarViewModel` shapes (status-based, no `isOnline`), two new behavioral rules (counts/provider-list/selection computed pre-narrowing; forced expansion and fleet-dropping under narrowing), and a "Sidebar composition" section listing all eight `components/live/sidebar/` files and their single responsibility, plus the two supporting non-component files.

### English-literal sweep (loose ends closed)

Grepped `components/live/` for English literals beyond the flagged "No fleets match.":

- `live-fleet-node.tsx`'s old `aria-label="Select all vehicles in ${fleet.label}"` → Spanish `"Seleccionar todos los vehículos de ${fleet.label}"` (this file was being rewritten anyway; fixed in place, `live-screen.test.tsx`'s matching assertion updated).
- `live-fleet-node.tsx`'s old `title={... ? "Online" : "Offline"}` tooltip on the status dot → removed entirely; the row's status badge (rendering `VEHICLE_STATUS_COPY`) replaces the dot-plus-English-tooltip pattern.
- `live-map-panel.tsx`'s `aria-label="Live map"` → `"Mapa en vivo"` (found during the sweep, not previously flagged; `live-map-panel.test.tsx` and `live-screen.test.tsx` updated to match).
- No further English literals found in `components/live/` after the sweep (grepped for `aria-label`, `title=`, `placeholder=`, and capitalized-word patterns across all `.tsx` files).

### Timestamp formatting (design decision made explicit here)

`lastReportAt` renders as an absolute `HH:mm` inside `<time dateTime={iso}>`,
with the full local date/time in `title`. Implemented in
`components/live/sidebar/format-last-report.ts` using a **fixed** locale
(`es-AR`) and time zone (`America/Argentina/Buenos_Aires`) via two module-level
`Intl.DateTimeFormat` instances — not the runtime default. This is
hydration-safe by construction: `Intl`'s implicit locale/time zone can
legitimately differ between the Node server render and the browser doing
hydration, which is a documented Next.js hydration-mismatch source for
anything derived from a clock; fixing both inputs makes the two passes
produce byte-identical output regardless of the machine's own locale/TZ
settings. `hourCycle: "h23"` is used explicitly (not `hour12: false` alone)
because the latter leaves the hour-cycle implementation-defined and can
render midnight as `"24:mm"` on some ICU builds — pinned down by a test case
crossing midnight (`00:05`, not `24:05`).

## Phase 9: Verification

- [x] 9.1 Full suite green: `npx vitest run` → 25 test files, 193 tests passed (was 156 after unit 6; +37 this unit: 3 format-last-report, 3 status badge, 2 provider badge, 13 vehicle row, 11 fleet node, 2 sidebar shell, 3 new live-screen filter-wiring tests, minus none removed).
- [x] 9.2 `npm run typecheck` clean (0 errors). `npm run lint` clean. `npm run build` succeeds; `/live` still reports `ƒ (Dynamic)`.
- [x] 9.3 Grepped `\.online\b` repo-wide: hits are `domain/live/vehicle-status.ts` (the sanctioned reader, 2 hits), `integrations/live/in-memory/in-memory-live-data-source.ts` (fixture data literals) and its test file (fixture assertions), and one code-comment in `live-screen.test.tsx` that only mentions `telemetry.online` in prose. The two hits in `components/live/sidebar/live-fleet-node.tsx` are `fleet.counts.online` — an unrelated field on the aggregated fleet counts, not `DeviceTelemetry.online` — confirmed by manual inspection, not a violation of Known Problem #1's invariant.
- [x] 9.4 Grepped `components/live/` for provider-value branching (`provider ===`, `provider ==`): no hits in any component. `live-provider-badge.tsx`'s `if (!provider)` is a presence check controlling whether to render at all, not a branch on the provider's identity/value — consistent with `02-provider-agnostic-live-principles.md`.

Status: all 7 chained work units complete (Phase 1 task 1.1 + Phases 2-9 all ticked). Implementation complete. No commit made.
