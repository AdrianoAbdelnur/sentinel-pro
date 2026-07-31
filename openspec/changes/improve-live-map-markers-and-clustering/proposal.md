# Proposal: Improve Live Map Markers and Clustering

## Intent

Make vehicles easy to locate. Markers lose contrast against OpenStreetMap, while vehicles overlap without showing counts or separating during zoom.

## Scope

### In Scope
- Add provider-neutral deep-navy (`#172554`) vehicle markers with deep navy-blue (`#003b73` border and `#005a9c` glyph/count) accents and restrained `rgba(0,59,115,...)` glows preserving heading and accessible title.
- Cluster nearby logical markers with counts, click-to-expand, progressive separation, and maximum-zoom fan behavior.
- Preserve the client-only boundary, fit bounds, resize behavior, and view-model-only contract.
- Gate `/live` integration behind a real-browser responsiveness harness with 621 points.

### Out of Scope
- Provider, domain, application, selection, or playback changes.
- Triggering vehicle selection from cluster clicks.
- Cluster hover coverage polygons or provider-specific marker colors.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `live-map-rendering`: Distinguish one logical marker per view-model entry from visible clustered icons and define cluster interaction and marker contrast behavior.

## Approach

Use pinned `supercluster@8.0.1` as an immutable spatial index. React Leaflet remains the only renderer, using `Marker` components. Rebuild when logical coordinates change; query settled bounds/zoom. Cluster activation fits member bounds at expansion zoom without selection.

At maximum zoom, unresolved overlaps use deterministic fan positions sorted by vehicle ID without changing source coordinates. Before `/live` integration, an isolated 621-point browser harness MUST prove responsiveness, page interaction, expansion, fan collapse, and resize under Turbopack.

`leaflet.markercluster`, other Leaflet clustering plugins, runtime mutation, side-effect imports, and compatibility shims are prohibited.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/live/live-map*` | Modified | Declarative markers, index queries, overlap layout, harness, and tests |
| `package*.json` | Modified | Add pinned index runtime and types |
| `docs/architecture/06-live-delivery-layer.md` | Modified | Document pure indexing and rendering boundary |
| `openspec/specs/live-map-rendering/spec.md` | Modified | Clarify logical markers and clusters |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Synchronous index work blocks interaction | Medium | Mandatory isolated 621-point browser gate before integration |
| Clusters obscure expected marker behavior | Low | Preserve titles, headings, coordinates, and fit bounds |
| Exact overlaps remain unresolved | Medium | Deterministic max-zoom fan verified in a real browser |

## Rollback Plan

Remove Supercluster, its index/query and overlap helpers, and the harness; restore direct marker rendering and revert the delta spec and delivery documentation.

## Dependencies

- `supercluster@8.0.1` and `@types/supercluster@7.1.3`, both pinned.

## Success Criteria

- [ ] Individual markers remain readable over the base map and preserve title and heading.
- [ ] Nearby vehicles show a count, zoom apart progressively, and spiderfy at maximum zoom.
- [ ] Cluster clicks only zoom to bounds; existing viewport and resize behavior remain intact.
- [ ] Tests, typecheck, lint, coverage, build, and browser verification pass.
