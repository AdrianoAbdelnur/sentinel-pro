## Exploration: Live map marker contrast and clustering

### Current State
`LiveMap` is a client-only Leaflet surface loaded through `next/dynamic` with SSR disabled. It renders one React Leaflet `Marker` per `LiveMapMarker`, uses a 22 px translucent emerald `divIcon`, fits the viewport whenever marker coordinates change, and has mocked unit tests plus an unmocked Leaflet integration suite.

There is no clustering dependency today. With many Howen vehicles, nearby markers overlap and the pale emerald marker has weak contrast against OpenStreetMap. The application contract already supplies every fact needed by delivery, so this change does not require provider, domain, or application-model changes.

Leaflet.markercluster supports the requested behavior directly: `zoomToBoundsOnClick` and `spiderfyOnMaxZoom` are enabled by default, clusters split while zooming, and `iconCreateFunction` supports a custom count bubble. Its base `MarkerCluster.css` supplies animation and spider-leg transitions; `MarkerCluster.Default.css` is unnecessary with custom icons.

### Affected Areas
- `components/live/live-map.tsx` — replace marker visuals and place logical markers inside a cluster layer while preserving fit-bounds and resize behavior.
- `components/live/live-map.test.tsx` — prove marker and cluster HTML, options, logical marker count, titles, coordinates, and lifecycle.
- `components/live/live-map.integration.test.tsx` — prove the real Leaflet/plugin stack mounts, clusters nearby markers, and retains marker titles/heading.
- `package.json` / `package-lock.json` — add `leaflet.markercluster` and its TypeScript definitions.
- `docs/architecture/06-live-delivery-layer.md` — document the client-only plugin boundary, custom icon CSS, and cluster behavior.
- `openspec/specs/live-map-rendering/spec.md` — clarify that one logical marker is created per view-model entry even when multiple markers render as one visible cluster.

### Approaches
1. **Official Leaflet.markercluster with a small local React Leaflet bridge** — create one plugin layer, let it own the existing markers, and render custom vehicle and count icons.
   - Pros: Implements count bubbles, zoom-to-bounds, animated separation, and maximum-zoom spiderfy with mature Leaflet behavior; avoids a React wrapper dependency; keeps provider details out of UI.
   - Cons: Requires explicit plugin lifecycle/cleanup and focused integration tests; plugin 1.5.3 is mature but infrequently released.
   - Effort: Medium

2. **Third-party React wrapper around Leaflet.markercluster** — wrap current JSX markers in a package-provided component.
   - Pros: Less local bridge code and declarative children.
   - Cons: Adds another compatibility surface between React 19, React Leaflet 5, and the underlying plugin; wrappers vary in maintenance and API behavior.
   - Effort: Medium

3. **Custom clustering and spiderfy implementation** — group projected points and implement zoom/spider layouts locally.
   - Pros: Full control and no clustering dependency.
   - Cons: Reimplements difficult geospatial, zoom, animation, overlap, and cleanup behavior; highest bug and maintenance risk.
   - Effort: High

### Recommendation
Use official `leaflet.markercluster` directly behind a small delivery-only React Leaflet bridge. Keep one logical Leaflet marker per `LiveMapMarker`, use the plugin defaults for `zoomToBoundsOnClick`, `spiderfyOnMaxZoom`, animation, and viewport pruning, disable the unrequested coverage polygon on hover, and use a moderate `maxClusterRadius` so clusters separate progressively.

Use a provider-neutral visual system for both icons: a near-black/navy core, bright cyan border/arrow, and restrained cyan glow. Cluster bubbles should use the same palette with a high-contrast numeric count and accessible vehicle-count label. Import only `MarkerCluster.css`; omit the default theme because `iconCreateFunction` owns the cluster visual.

Preserve the current SSR boundary, resize observer, viewport fit behavior, marker label/title, and heading rotation. Add pure helper tests, mocked lifecycle/options tests, a real-plugin integration test, and browser verification for cluster click, zoom separation, and maximum-zoom spiderfy. The delta spec should distinguish logical markers from currently visible map icons.

### Risks
- Importing the Leaflet plugin outside the existing client-only dynamic boundary can reintroduce the known SSR DOM crash.
- Recreating the cluster group on every render would reset zoom/spiderfy state; the bridge must keep a stable group and reconcile marker changes.
- Marker and cluster Tailwind classes must remain complete string literals so Tailwind v4 emits them.
- Maximum-zoom spiderfy and animation are geometric browser behaviors; jsdom coverage alone is insufficient.
- `leaflet.markercluster` 1.5.3 is older, so build and real-browser compatibility with Leaflet 1.9.4 must be verified before completion.

### Ready for Proposal
Yes. No clarification is required: the requested dark neon blue/cyan direction and cluster interaction are sufficiently specific, while exact color values and cluster radius can be selected and validated as delivery details.
