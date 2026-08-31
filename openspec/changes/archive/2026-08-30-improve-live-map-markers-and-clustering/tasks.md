# Tasks: Improve Live Map Markers and Clustering

> Rejected: `leaflet.markercluster`; all tasks restart unchecked. Leaflet clustering plugins, side-effect imports, runtime mutation, and compatibility shims are prohibited.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,100-1,450 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Boundary |
|---|---|---|---|
| 1 | Pure icons, Supercluster, and overlap helpers | PR 1 | Base = feature/tracker branch |
| 2 | Isolated 621-point Turbopack responsiveness gate | PR 2 | Base = PR 1 branch |
| 3 | Declarative integration after gate | PR 3 | Base = PR 2 branch |
| 4 | `/live` proof/checks | PR 4 | Base = PR 3 branch |

## Phase 1: Pure Foundation — PR 1

- [x] 1.1 RED: Test `live-map-icons.ts`, `live-map-clustering.ts`, and `live-map-overlap-layout.ts`: contrast, labels/headings, immutable coordinates, queries, leaves/expansion zoom, stable signatures, and deterministic rings.
- [x] 1.2 GREEN: Pin `supercluster@8.0.1` and `@types/supercluster@7.1.3`; implement the three pure helpers without `leaflet.markercluster` or another Leaflet clustering plugin.
- [x] 1.3 REFACTOR: Limit GeoJSON properties to `vehicleId`, preserve source coordinates, and run focused tests, typecheck, and lint.

## Phase 2: Mandatory Browser Gate — PR 2

- [x] 2.1 RED: Test deterministic 621-point data, development-only routing, expansion/fan/collapse, heartbeat, click feedback, resize, and timings.
- [x] 2.2 GREEN: Create `app/dev/live-map-clustering-harness/page.tsx` plus harness component/data files using the real Supercluster helpers and Turbopack.
- [x] 2.3 Verify in a real browser and write `harness-report.md`: build `<50 ms`, query p95 `<16 ms`, no clustering long task `>=50 ms`, and control feedback by the next animation frame.
- [x] 2.4 GATE: If the harness freezes or any threshold fails, STOP before modifying `/live`; record failure and leave direct markers connected.

## Phase 3: Declarative Map Integration — PR 3

- [x] 3.1 RED: Test settled `moveend`/`zoomend` queries, React Leaflet markers, count activation, expansion bounds, deterministic maximum-zoom fan, collapse, and no selection.
- [x] 3.2 GREEN: Create `use-live-map-clusters.ts` and `live-map-marker-layer.tsx`; render declarative `Marker`/optional `Polyline` entries without mutating Leaflet runtime.
- [x] 3.3 RED: Update map tests for source-coordinate fit/refit bounds, resize, titles, headings, attribution, and preserved logical-marker count.
- [x] 3.4 GREEN/REFACTOR: Wire the marker layer into `live-map.tsx` only after Phase 2 passes; memoize indexes by coordinate signature and clear fan state on move/zoom.

## Phase 4: Operational Proof — PR 4

- [ ] 4.1 Verify real `/live` cardinality and responsive fleet expansion, checkbox selection, filters, cluster expansion, fan/collapse, resize, contrast, and accessible counts; update `harness-report.md`.
- [x] 4.2 Document the pure index boundary, browser gate, source-coordinate invariants, and plugin prohibition in `docs/architecture/06-live-delivery-layer.md`.
- [ ] 4.3 Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:coverage`, `npm run build`, and `git diff --check`.
