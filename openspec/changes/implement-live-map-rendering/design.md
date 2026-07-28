# Design: implement-live-map-rendering

## Technical Approach

Split the map surface into two components: a presentational panel that owns the empty-state decision, and a client-only Leaflet component that owns rendering. The panel is testable under jsdom; the Leaflet component is loaded lazily and mocked in tests.

## Architecture Decisions

### Decision: Two components, one of them never loaded on the server

**Choice**: `LiveMapPanel` renders empty states directly and lazily loads `LiveMap` only when markers exist. `LiveMap` is imported through `next/dynamic` with `ssr: false`.

**Alternatives considered**: A single component guarded by a `typeof window` check.

**Rationale**: Leaflet reads `window` at module scope, so it must never be evaluated during SSR. The Next docs are explicit that `ssr: false` is only valid inside a Client Component — `LiveScreen` already is one, and `LiveMapPanel` will carry the `"use client"` directive too. Splitting also keeps the empty-state path free of the map bundle entirely.

### Decision: `divIcon` instead of Leaflet's default marker images

**Choice**: Build markers with `L.divIcon` and inline markup.

**Alternatives considered**: Patching `L.Icon.Default` to point at the bundled PNG paths.

**Rationale**: Leaflet's default icon resolves image URLs in a way bundlers break, and the usual fix is a fragile path patch. Markup-based icons sidestep the problem, and they let `headingDeg` drive a CSS rotation, which the default image cannot do.

### Decision: Fit bounds on every marker change

**Choice**: A small `useEffect`-based child component calls `map.fitBounds` whenever the marker coordinates change.

**Alternatives considered**: Setting a static center and zoom.

**Rationale**: The marker set changes with selection, so a fixed viewport would frequently show an empty area. Bounds are derived from the same marker list that is rendered, so the two cannot drift.

### Decision: Mock the map module in screen tests

**Choice**: `live-screen.test.tsx` mocks `./live-map` with a stub. `live-map-panel.test.tsx` covers empty states for real.

**Alternatives considered**: Running Leaflet under jsdom.

**Rationale**: Leaflet requires layout APIs jsdom does not implement. Mocking keeps the screen tests about screen behavior, and the panel's real logic — which state to show — stays genuinely covered.

## Data Flow

```text
LiveScreen (client)
  └─ page.map : LiveMapViewModel
       └─ <LiveMapPanel map />          (client, decides)
            ├─ empty state  → message, no map bundle
            └─ markers      → <LiveMap markers />   (dynamic, ssr:false)
                                 └─ TileLayer + Marker[] + FitBounds
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `leaflet`, `react-leaflet`, `@types/leaflet` |
| `components/live/live-map-panel.tsx` | Create | Empty-state decision and lazy map loading |
| `components/live/live-map-panel.test.tsx` | Create | Empty states and map-container presence |
| `components/live/live-map.tsx` | Create | Leaflet map, tile layer, markers, bounds |
| `components/live/live-map.test.tsx` | Create | Marker count, label, rotation, attribution |
| `components/live/live-screen.tsx` | Modify | Replace the placeholder with the map panel |
| `components/live/live-screen.test.tsx` | Modify | Mock the map module |

## Interfaces / Contracts

```ts
type LiveMapPanelProps = {
  map: LiveMapViewModel;
};

type LiveMapProps = {
  markers: LiveMapMarker[];
};
```

No application contract changes. `LiveMapViewModel` and `LiveMapMarker` already exist and are already composed by `buildLivePageViewModel`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Component | Panel picks empty state vs map | Testing Library, no Leaflet involved |
| Component | Marker count, label, rotation, attribution | Mock `react-leaflet` primitives and assert on the props they receive |
| Build | No SSR `window` error | `npm run build` in verification |

Leaflet itself is not exercised in tests. The map component is verified through the props it hands to `react-leaflet`, which keeps the tests about our logic rather than the library's.

## Migration / Rollout

Additive. The placeholder text in `LiveScreen` is replaced; nothing else changes.

## Open Questions

- None.
