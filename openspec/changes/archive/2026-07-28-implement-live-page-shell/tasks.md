# Tasks: implement-live-page-shell

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 450-600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 2 chained PRs |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Resolved
Chained PRs recommended: Yes, declined by user
Chain strategy: n/a - `size:exception` accepted for a single PR
400-line budget risk: High, accepted

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Page composition use case + in-memory data source | PR 1 | Pure logic, no UI, independently testable |
| 2 | Route and presentational components | PR 2 | Consumes PR 1 contracts |

## Phase 1: Application

- [x] 1.1 Add `LiveState`, `LiveDataSource`, and `BuildLivePageViewModelInput` to `application/live/contracts.ts`.
- [x] 1.2 Write failing tests for `buildLivePageViewModel`: delegation to sidebar, delegation to bottom panel, closed playback overlay by default.
- [x] 1.3 Implement `application/live/build-live-page-view-model.ts`.
- [x] 1.4 Export it from `application/live/index.ts`.

## Phase 2: Data Source

- [x] 2.1 Write failing tests asserting the in-memory source exposes at least one offline vehicle and one without valid GPS.
- [x] 2.2 Implement `integrations/live/in-memory/in-memory-live-data-source.ts` with two fleets and enough vehicles to exercise search and partial data.

## Phase 3: Delivery

- [x] 3.1 Write failing component tests for the live screen: renders fleets, hides collapsed vehicles, selection updates the bottom panel, search narrows fleets, `null` cells render the fallback, tab switch keeps the selection.
- [x] 3.2 Implement `components/live/live-bottom-panel.tsx` (tabs, columns, rows, fallback marker).
- [x] 3.3 Implement `components/live/live-fleet-node.tsx` (one fleet, its checkbox, its vehicles).
- [x] 3.4 Implement `components/live/live-sidebar.tsx` (search box, filter toggle, fleet list).
- [x] 3.5 Implement `components/live/live-screen.tsx` as the client island owning selection, expansion, search, and active tab.
- [x] 3.6 Implement `app/live/page.tsx` reading the data source and rendering the screen.

## Phase 4: Verification

- [x] 4.1 Run the full test suite.
- [x] 4.2 Run lint, typecheck, and build.
- [x] 4.3 Confirm no component contains provider conditionals or business derivation.
