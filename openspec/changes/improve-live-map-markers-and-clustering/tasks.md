# Tasks: Improve Live Map Markers and Clustering

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 850-1,050 |
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

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Dependencies and provider-neutral icon factories | PR 1 | Base = feature/tracker branch; pure tests included |
| 2 | Stable cluster-group bridge and lifecycle | PR 2 | Base = PR 1 branch; mocked lifecycle tests included |
| 3 | Map wiring and viewport regressions | PR 3 | Base = PR 2 branch; real-plugin integration included |
| 4 | Local failure boundary, browser proof, and docs | PR 4 | Base = PR 3 branch; final verification included |

## Phase 1: Visual Foundation — PR 1

- [x] 1.1 RED: Add `components/live/live-map-icons.test.ts` cases for navy/cyan marker markup, accessible count labels, and present/missing heading rotation.
- [x] 1.2 GREEN: Pin `leaflet.markercluster@1.5.3` and compatible typings in `package.json`/`package-lock.json`; create `components/live/live-map-icons.ts` using complete Tailwind literals and only a rotation CSS custom property.
- [x] 1.3 REFACTOR: Keep icon factories provider-neutral and Leaflet-only; run their focused tests, typecheck, and lint.

## Phase 2: Cluster Lifecycle — PR 2

- [ ] 2.1 RED: Create `components/live/live-map-cluster-layer.test.tsx` proving exact options, one Leaflet marker per view-model marker, stable group reuse, update reconciliation, titles/headings, and unmount cleanup.
- [ ] 2.2 GREEN: Create `components/live/live-map-cluster-layer.tsx`; client-import the plugin/base CSS, own one cluster group, use bulk clear/add reconciliation, and remove all layers on cleanup.
- [ ] 2.3 REFACTOR: Isolate plugin objects inside the bridge and verify `maxClusterRadius: 60`, bounds zoom, max-zoom spiderfy, and disabled hover coverage.

## Phase 3: Map Integration — PR 3

- [ ] 3.1 RED: Update `components/live/live-map.test.tsx` and `live-map.integration.test.tsx` to preserve coordinates, titles, headings, fit/refit bounds, resize correction, attribution, and logical-marker count through real clustering.
- [ ] 3.2 GREEN: Replace direct markers in `components/live/live-map.tsx` with the cluster bridge without changing `LiveMapMarker` or upstream contracts.
- [ ] 3.3 REFACTOR: Make deterministic jsdom dimensions explicit; run focused unit/integration tests, typecheck, and lint.

## Phase 4: Failure Containment and Verification — PR 4

- [ ] 4.1 RED: Extend `components/live/live-map-panel.test.tsx` so lazy/plugin failure replaces only the map surface and leaves the surrounding operational region intact.
- [ ] 4.2 GREEN: Create `components/live/live-map-error-boundary.tsx` and wrap only the dynamic map in `components/live/live-map-panel.tsx`.
- [ ] 4.3 REFACTOR: Document the client/plugin boundary, CSS, lifecycle, options, and test split in `docs/architecture/06-live-delivery-layer.md`.
- [ ] 4.4 Verify `/live` in a real browser: neon contrast, count label, bounds zoom without selection, progressive separation, max-zoom spiderfy, resize, and local failure fallback.
- [ ] 4.5 Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:coverage`, `npm run build`, and `git diff --check`.
