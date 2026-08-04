# Design: Improve Live Map Markers and Clustering

## Technical Approach

Keep React Leaflet as the only map renderer and add pinned `supercluster@8.0.1`
with `@types/supercluster@7.1.3` as a pure spatial index. `LiveMapPanel` retains
the client-owned `next/dynamic(..., { ssr: false })` boundary. The map memoizes
an immutable GeoJSON index from a stable coordinate signature, queries it only
after settled bounds/zoom events, and renders results as declarative React
Leaflet `Marker` components.

Integration into `/live` is blocked until the same components pass an isolated
Turbopack browser harness with 621 synthetic points.

## Architecture Decisions

| Decision | Alternatives | Rationale |
|---|---|---|
| Use direct Supercluster indexing | Wrapper hook; Leaflet plugin | Supercluster has no DOM lifecycle or Leaflet augmentation. Its immutable index, bounds query, leaves, and expansion zoom match the required behavior. Leaflet plugins, side-effect imports, runtime mutation, compatibility shims, and second Leaflet runtimes are prohibited. |
| Rebuild only for coordinate changes | Rebuild per render/zoom | GeoJSON properties contain only `vehicleId`; current labels/headings come from a separate lookup. Non-spatial updates therefore preserve the index. |
| Query on `moveend` and `zoomend` | Query during animation | Settled integer zoom and `[west, south, east, north]` bounds prevent render churn while preserving progressive separation. |
| Render ordinary `Marker` components | Imperative layer group | Declarative rendering keeps React Leaflet ownership, cleanup, titles, and heading icons predictable. |
| Fit member bounds capped by `getClusterExpansionZoom()` | Select a member; fixed zoom | Cluster activation changes only the viewport and expands at Supercluster’s intended zoom. |
| Fan unresolved maximum-zoom overlaps | Mutate source coordinates | Leaves are sorted by `vehicleId`; deterministic concentric pixel rings are projected back to display coordinates. Source coordinates remain immutable and continue driving fit bounds. Fan state clears on move/zoom. |

## Data Flow

```text
LiveMapMarker[] -> coordinate signature -> memoized Supercluster index
       |                                      |
       `-> vehicleId lookup      bounds + zoom query
                                              |
                         cluster/point render entries
                                              |
                           React Leaflet Marker/Polyline
```

No provider, device, or source identity enters this delivery boundary.

## Interfaces / Contracts

`LiveMapMarker` remains unchanged. Pure clustering helpers expose:

- index construction from `{ vehicleId, latitude, longitude }`;
- cluster queries returning discriminated cluster/point entries;
- leaf lookup plus expansion zoom;
- deterministic pixel offsets for sorted overlapping IDs.

Rendered fan entries hold both immutable source coordinates and derived display
coordinates. Provider-neutral icon helpers create deep-navy (`#172554`) markers with deep navy-blue (`#003b73` border and `#005a9c` glyph/count) accents and restrained `rgba(0,59,115,...)` glows
and accessible Spanish count icons.

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json`, `package-lock.json` | Modify | Pin Supercluster runtime and types; contain no Leaflet clustering plugin. |
| `components/live/live-map-clustering.ts` | Create | GeoJSON conversion, immutable index, query discrimination, leaves, and expansion helpers. |
| `components/live/live-map-overlap-layout.ts` | Create | Deterministic multi-ring pixel fan offsets. |
| `components/live/use-live-map-clusters.ts` | Create | Subscribe to settled Leaflet bounds/zoom, memoize/query the index, activate/collapse clusters. |
| `components/live/live-map-icons.ts` | Create | Provider-neutral vehicle and count `divIcon` factories. |
| `components/live/live-map-marker-layer.tsx` | Create | Declaratively render clusters, points, fan members, and optional legs. |
| `components/live/live-map.tsx` | Modify | Add the marker layer while preserving tiles, source-coordinate fit bounds, resize, titles, and headings. |
| `app/dev/live-map-clustering-harness/page.tsx` | Create | Development-only route; return `notFound()` outside development. |
| `components/live/live-map-clustering-harness.tsx` | Create | Render the real clustering surface, controls, heartbeat, measurements, expansion, fan, collapse, and resize. |
| `components/live/live-map-clustering-harness-data.ts` | Create | Deterministic 621 points, zoom-separated groups, and exact overlaps. |
| `components/live/live-map*.test.*` | Create/Modify | Pure index/layout/icon tests plus map, hook, declarative rendering, viewport, title, heading, and harness tests. |
| `docs/architecture/06-live-delivery-layer.md` | Modify | Document the pure index boundary, browser gate, and prohibition on runtime mutation. |
| `openspec/changes/improve-live-map-markers-and-clustering/harness-report.md` | Create during apply | Record browser evidence and timing results before `/live` wiring. |

## Testing Strategy

Use RED-GREEN-REFACTOR. Pure tests prove index immutability, stable rebuild keys,
queries, leaves, expansion zoom, and collision-free deterministic rings.
React tests prove settled-event querying, ordinary markers, click behavior,
fan collapse, original-coordinate fit bounds, resize, titles, and headings.

The real Turbopack harness is a mandatory gate. Record `performance.now()` index
build time and viewport-query p95, observe long tasks, and exercise an unrelated
click counter/heartbeat. Pass requires build under 50 ms, query p95 under 16 ms,
no clustering long task of 50 ms or more, and control feedback by the next
animation frame. Then repeat against real Howen cardinality and `/live` fleet,
checkbox, filter, expansion, fan, collapse, and resize interactions. Run tests,
typecheck, lint, coverage, and build.

## Migration / Rollout

No data migration. Stage helpers and harness first; wire `/live` only after the
recorded gate passes. On failure, keep direct markers in `/live` and remove the
index, harness, dependencies, tests, and documentation. Remove the harness
from production routing by retaining its mandatory `notFound()` guard.

## Open Questions

None.
