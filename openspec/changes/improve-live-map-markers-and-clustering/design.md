# Design: Improve Live Map Markers and Clustering

## Technical Approach

Keep `LiveMapPanel` as the client-owned `next/dynamic(..., { ssr: false })`
boundary and integrate official `leaflet.markercluster` 1.5.3 below it. A small
React Leaflet bridge will own one stable `MarkerClusterGroup`, translate each
`LiveMapMarker` into one Leaflet marker, and reconcile the group when the view
model changes. Custom `divIcon` factories will provide provider-neutral navy and
cyan individual markers and count clusters. Existing fit-bounds, resize,
heading, and title behavior remains outside the plugin lifecycle.

## Architecture Decisions

| Decision | Alternatives considered | Rationale |
|---|---|---|
| Use `leaflet.markercluster` 1.5.3 directly through a local bridge | React wrapper; custom clustering | The official plugin implements zoom splitting, bounds zoom, spiderfy, and bulk layer lifecycle without adding a wrapper compatibility layer across React 19 and React Leaflet 5. |
| Keep the current `ssr: false` boundary in `live-map-panel.tsx` | Static import from a Server Component; runtime `window` checks | Next.js 16 requires `ssr: false` to be declared from a Client Component. This prevents Leaflet and the plugin from entering the server module graph rather than detecting failure after evaluation. |
| Keep one stable group and reconcile marker layers | Recreate the group on every render; render React Leaflet `Marker` children | Stable ownership avoids duplicate map layers and preserves plugin interaction state across ordinary React renders. Bulk `clearLayers()` plus `addLayers()` is the plugin-recommended path when most markers change. Cleanup clears the group and removes it from the map. |
| Configure `maxClusterRadius: 60`, `zoomToBoundsOnClick: true`, `spiderfyOnMaxZoom: true`, and `showCoverageOnHover: false` | Default 80 px radius; coverage polygon | A smaller radius separates vehicles sooner while retaining progressive clustering. Explicit options encode the requirements; no application click handler means cluster activation changes only the viewport. |
| Import `MarkerCluster.css`, but not `MarkerCluster.Default.css` | Default plugin theme; entirely local animation CSS | The base stylesheet supplies split/merge and spider-leg mechanics. Custom `iconCreateFunction` makes the default visual theme unnecessary. |
| Catch failures around only the lazy map | Route-level error UI | A local error boundary keeps source data and the rest of the operational screen usable if the browser-only module fails. |

## Data Flow

```text
LiveMapViewModel.markers
        |
LiveMapPanel --client-only lazy boundary--> LiveMap
        |                                    |-- FitBounds
        |                                    |-- InvalidateOnResize
        |                                    `-- MarkerClusterLayer
        |                                         `-- Leaflet markers
        `-- local map error fallback
```

No domain, application, provider, or source identity crosses into clustering.

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json`, `package-lock.json` | Modify | Pin `leaflet.markercluster` 1.5.3 and add compatible TypeScript declarations. |
| `components/live/live-map-icons.ts` | Create | Build individual and cluster `divIcon` markup using complete Tailwind literals, a dynamic rotation custom property, and a Spanish vehicle-count accessible label. |
| `components/live/live-map-cluster-layer.tsx` | Create | Import the plugin/base CSS, create the stable group, apply explicit options, reconcile logical markers, and clean up. |
| `components/live/live-map-error-boundary.tsx` | Create | Confine lazy/plugin initialization failures to the map surface. |
| `components/live/live-map.tsx` | Modify | Replace direct `Marker` rendering with the bridge while preserving tiles, fit bounds, and resize correction. |
| `components/live/live-map-panel.tsx` | Modify | Wrap the dynamic map only with the local error boundary. |
| `components/live/live-map-icons.test.ts` | Create | Test navy/cyan markup, count label, and heading CSS property. |
| `components/live/live-map-cluster-layer.test.tsx` | Create | Test options, logical marker creation, updates, stable mount, and cleanup with mocked Leaflet. |
| `components/live/live-map.test.tsx` | Modify | Preserve viewport, attribution, coordinate, title, heading, and resize assertions through the bridge. |
| `components/live/live-map.integration.test.tsx` | Modify | Render real Leaflet/plugin with deterministic dimensions and prove nearby markers cluster without being lost. |
| `components/live/live-map-panel.test.tsx` | Modify | Prove map failures render locally without replacing the region. |
| `docs/architecture/06-live-delivery-layer.md` | Modify | Document the plugin boundary, lifecycle, CSS, options, and test split. |

## Interfaces / Contracts

`LiveMapMarker` and every upstream contract remain unchanged. The bridge accepts
only `markers: LiveMapMarker[]`; plugin objects never leave the delivery layer.
Cluster HTML exposes the child count visually and through an accessible label.

## Testing Strategy

Follow RED-GREEN-REFACTOR. Pure tests cover icon output. Mocked component tests
cover lifecycle and exact options. The real-plugin jsdom suite covers mounting,
logical marker preservation, clustering, titles, and heading. Run `npm test`,
typecheck, lint, coverage, and build. Browser verification on `/live` confirms
contrast, count, bounds zoom, progressive separation, max-zoom spiderfy, resize,
and no vehicle selection from cluster activation.

## Migration / Rollout

No data migration or feature flag is required. Rollback removes the bridge and
dependency and restores direct markers.

## Open Questions

None.
