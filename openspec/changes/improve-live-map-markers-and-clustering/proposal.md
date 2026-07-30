# Proposal: Improve Live Map Markers and Clustering

## Intent

Make operational vehicles easy to locate on the live map. The current translucent green markers lose contrast against OpenStreetMap, while nearby vehicles overlap without communicating their count or becoming progressively distinguishable as the operator zooms.

## Scope

### In Scope
- Replace vehicle markers with a provider-neutral dark navy and neon cyan visual that preserves heading and accessible title.
- Group nearby logical markers into count-bearing clusters that zoom to their bounds on click, separate progressively, and spiderfy at maximum zoom.
- Preserve the client-only map boundary, marker-derived fit bounds, resize behavior, and view-model-only rendering contract.
- Add focused unit, integration, build, and browser validation for the Leaflet plugin boundary.

### Out of Scope
- Provider, domain, application contract, selection, or playback changes.
- Triggering vehicle selection from cluster clicks.
- Cluster hover coverage polygons or provider-specific marker colors.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `live-map-rendering`: Distinguish one logical marker per view-model entry from visible clustered icons and define cluster interaction and marker contrast behavior.

## Approach

Add official `leaflet.markercluster` behind a small local React Leaflet bridge inside the existing client-only map. Keep one Leaflet marker per view-model entry in a stable cluster group. Use custom `divIcon` factories for vehicle and cluster visuals, plugin defaults for zoom-to-bounds and maximum-zoom spiderfy, a moderate cluster radius, and disabled hover coverage.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/live/live-map*` | Modified | Marker visuals, clustering lifecycle, and tests |
| `package*.json` | Modified | Add plugin and TypeScript definitions |
| `docs/architecture/06-live-delivery-layer.md` | Modified | Document delivery-only plugin boundary |
| `openspec/specs/live-map-rendering/spec.md` | Modified | Clarify logical markers and clusters |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Plugin breaks SSR or React lifecycle | Medium | Import only within the client boundary and test cleanup |
| Clusters obscure expected marker behavior | Low | Preserve titles, headings, coordinates, and fit bounds |
| Spiderfy differs in jsdom | Medium | Add real-browser verification |

## Rollback Plan

Remove the plugin dependency and bridge, restore direct marker rendering, and revert the delta spec and delivery documentation.

## Dependencies

- `leaflet.markercluster` and compatible TypeScript definitions.

## Success Criteria

- [ ] Individual markers remain readable over the base map and preserve title and heading.
- [ ] Nearby vehicles show a count, zoom apart progressively, and spiderfy at maximum zoom.
- [ ] Cluster clicks only zoom to bounds; existing viewport and resize behavior remain intact.
- [ ] Tests, typecheck, lint, coverage, build, and browser verification pass.
