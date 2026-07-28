# Tasks: implement-live-operator-panels

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250-400 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Compose live sidebar and bottom panel with tests | PR 1 | Pure application slice only |

## Phase 1: Contracts

- [x] 1.1 Extend `application/live/contracts.ts` with explicit input types for fleet state, sidebar composition, and bottom-panel composition.

## Phase 2: Use Cases

- [x] 2.1 Create `application/live/build-live-sidebar-view-model.ts` for collapsed fleets, selection state, and search expansion.
- [x] 2.2 Create `application/live/build-live-bottom-panel-view-model.ts` for active-tab and selected-vehicle row composition.
- [x] 2.3 Export the new use cases from `application/live/index.ts`.

## Phase 3: Verification

- [x] 3.1 Add unit tests for sidebar scenarios: collapsed default, fleet selection state, and search filtering.
- [x] 3.2 Add unit tests for bottom-panel scenarios: no selection, partial-data rows, and tab scope preservation.
- [x] 3.3 Run targeted tests plus typecheck for the new slice.
