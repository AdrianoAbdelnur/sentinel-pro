## Exploration: Live map marker contrast and clustering

### Current State
`LiveMap` is again on the stable implementation: a client-only Leaflet surface loaded through `next/dynamic` with SSR disabled, rendering normal React Leaflet `Marker` components. The current 22 px translucent emerald icon has weak contrast and nearby vehicles overlap.

The first clustering implementation is not viable. `leaflet.markercluster` initially failed under Turbopack because its expected `markerClusterGroup` factory was not available. Switching to the module's constructor bypassed that error but then blocked the browser main thread and disabled all page interaction. The rollback removed the plugin and restored stability, while clustering remains required.

`supercluster` is materially different: it is a pure ESM point-indexing library with no Leaflet plugin lifecycle, DOM access, CSS, marker mutation, or global augmentation. Version 8.0.1 accepts immutable GeoJSON points, queries clusters with `[west, south, east, north]` bounds plus integer zoom, and exposes `getClusterExpansionZoom`, `getLeaves`, and cluster point counts. It needs the separate `@types/supercluster` 7.1.3 package.

### Affected Areas
- `components/live/live-map.tsx` — keep normal React Leaflet markers, add viewport observation, render cluster results, and preserve fit-bounds/resize behavior.
- `components/live/live-map-icons.ts` — provide provider-neutral deep-navy (`#172554`) vehicle and count icons with deep navy-blue (`#003b73` border and `#005a9c` glyph/count) accents and restrained `rgba(0,59,115,...)` glows without plugin CSS.
- `components/live/live-map-clustering.ts` — translate `LiveMapMarker` values to GeoJSON, build/query the immutable Supercluster index, and discriminate point/cluster results.
- `components/live/live-map-overlap-layout.ts` — derive deterministic max-zoom fan/spider positions without mutating Leaflet markers or source coordinates.
- `components/live/live-map*.test.tsx` and pure helper tests — cover index queries, expansion, overlap layout, normal marker rendering, titles, headings, and viewport regressions.
- A development-only cluster harness — prove responsiveness and browser interaction before the clustering component is connected to `/live`.
- `package.json` / `package-lock.json` — add pinned `supercluster@8.0.1` and `@types/supercluster@7.1.3`; do not add `leaflet.markercluster`.
- `docs/architecture/06-live-delivery-layer.md` and downstream SDD artifacts — replace the failed plugin design with a pure index plus declarative rendering.

### Approaches
1. **Pure Supercluster index with declarative React Leaflet markers** — rebuild the index only when logical marker coordinates change, query it on `moveend`/`zoomend`, and render returned clusters or points as ordinary `Marker` components.
   - Pros: No Leaflet patching or plugin constructor; standard ESM; viewport work is explicit and testable; only visible clusters/points render; `getClusterExpansionZoom` directly supports click-to-expand.
   - Cons: Requires local viewport orchestration and explicit max-zoom overlap handling; Supercluster index construction is synchronous.
   - Effort: Medium

2. **Supercluster through `use-supercluster`** — delegate index/query memoization to a React hook package.
   - Pros: Less local hook code.
   - Cons: Adds another older wrapper and compatibility surface after a wrapper/plugin failure; hides the exact refresh and performance lifecycle that now needs verification.
   - Effort: Medium

3. **Another Leaflet clustering plugin or wrapper** — replace the failed plugin with a similar imperative layer.
   - Pros: May include built-in animation and spiderfy.
   - Cons: Repeats the same Turbopack, duplicate-runtime, mutation, and main-thread lifecycle risks already observed.
   - Effort: High risk

### Recommendation
Use `supercluster@8.0.1` directly and keep React Leaflet as the only map renderer. Convert each `LiveMapMarker` into a GeoJSON point whose properties contain only a stable `vehicleId`; resolve current labels/headings from a separate `vehicleId` lookup so non-positional updates do not require a new spatial index. Memoize the immutable index by a stable coordinate signature, not by zoom.

Observe the map's current bounds and integer zoom only after `moveend` and `zoomend`. Query `getClusters([west, south, east, north], zoom)` and render each result as a normal React Leaflet `Marker`: individual results use the deep-navy (`#172554`) directional icon with deep navy-blue (`#003b73` border and `#005a9c` glyph) accents and restrained `rgba(0,59,115,...)` glows; cluster results use the same visual language with `point_count` and an accessible Spanish vehicle-count label. No provider data enters the clustering boundary.

On cluster activation below maximum map zoom:

1. Read `cluster_id`.
2. Use `getClusterExpansionZoom(cluster_id)`.
3. Use `getLeaves(cluster_id, Infinity)` to calculate member bounds.
4. Fit those bounds with the expansion zoom as the cap, so activation changes only the viewport and the cluster separates at the intended level.

Set Supercluster's `maxZoom` to the explicit Leaflet map maximum. A cluster that still exists at that zoom represents unresolved overlap. Activating it should call `getLeaves`, sort deterministically by `vehicleId`, and derive fan/spider display positions around the cluster centre in screen pixels. Convert those offsets back to coordinates with projection/unprojection and render ordinary React Leaflet `Marker` components plus optional `Polyline` legs. Keep source coordinates immutable, hide only the activated cluster while expanded, and clear the fan on zoom/move. Concentric rings or a deterministic spiral must handle more vehicles than a single circle without marker collisions.

Use a moderate initial radius such as 60 px, then tune it visually. For approximately 621 vehicles, the workload is far below Supercluster's intended scale, but that is not proof after the observed freeze. Before touching `/live`, build an isolated development-only browser harness containing:

- a deterministic 621-point distribution,
- near points that split across zoom levels,
- several exact-coordinate overlaps,
- visible controls that prove clicks and animation frames remain responsive,
- `performance.now()` measurements for index construction and viewport queries,
- cluster click, expansion, max-zoom fan, collapse, and resize checks.

Only integrate with `/live` after that harness stays interactive under Turbopack in a real browser. Then repeat the check with the real Howen cardinality. Keep the harness development-only or remove it before final delivery; it must never become a production operational route.

Remove or leave unused every `leaflet.markercluster` artifact from the failed branches: no runtime package, typings, CSS, side-effect import, constructor, layer group, or compatibility shim should enter this design.

### Risks
- Supercluster builds its immutable index synchronously. Memoization and the browser harness are mandatory even though 621 points should be a small workload.
- Bounds and zoom are map state; updating them on every animation frame would create render churn. Query only on settled map events.
- Exact coordinates never become visually distinguishable by zoom alone. The deterministic max-zoom fan/spider path is required to satisfy the existing spec.
- Spider display coordinates are intentionally derived positions. Fit bounds and application state must continue using original logical coordinates.
- `@types/supercluster` is versioned 7.1.3 while runtime Supercluster is 8.0.1; typecheck and small API contract tests must verify the unchanged public surface.
- A jsdom test cannot prove the page remains interactive. Real Turbopack browser validation must gate `/live` integration.

### Ready for Proposal
Yes. No user clarification is required. The proposal, spec, design, and tasks must be revised to remove `leaflet.markercluster`, introduce the isolated browser-harness gate, and define Supercluster expansion plus deterministic max-zoom overlap layout before implementation resumes.
