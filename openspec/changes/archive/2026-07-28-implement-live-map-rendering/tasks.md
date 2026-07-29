# Tasks: implement-live-map-rendering

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250-350 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | n/a |

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Render the live map with Leaflet | PR 1 | Delivery only; no application change |

## Phase 1: Dependencies

- [x] 1.1 Install `leaflet`, `react-leaflet`, and `@types/leaflet`.
- [x] 1.2 Confirm the installed `react-leaflet` major supports React 19.

## Phase 2: Map Panel

- [x] 2.1 Write failing tests for `LiveMapPanel`: `no-selection` message, `no-mappable-selection` message, and map container present when markers exist.
- [x] 2.2 Implement `components/live/live-map-panel.tsx` with the lazy, SSR-disabled map import.

## Phase 3: Map

- [x] 3.1 Write failing tests for `LiveMap`: one marker per view-model entry at the right coordinates, label as accessible title, rotation from `headingDeg`, no rotation when absent, bounds fitted to markers, OpenStreetMap attribution present.
- [x] 3.2 Implement `components/live/live-map.tsx` with tile layer, `divIcon` markers, and bounds fitting.

## Phase 4: Integration

- [x] 4.1 Replace the map placeholder in `components/live/live-screen.tsx` with `LiveMapPanel`.
- [x] 4.2 Mock the map module in `components/live/live-screen.test.tsx` and keep existing screen tests green.

## Phase 5: Verification

- [x] 5.1 Run the full test suite.
- [x] 5.2 Run lint, typecheck, and build; the build must not fail with an SSR `window` error.
- [x] 5.3 Update `openspec/changes/implement-live-page-shell` notes if the placeholder behavior it documented has changed.
  - No update needed: that change scoped map rendering as out of scope and never specified the placeholder. This change declares `live-page-shell` as a modified capability instead.
