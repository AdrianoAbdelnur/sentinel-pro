# Proposal: implement-live-map-rendering

## Intent

Render the live map surface with Leaflet, so selected vehicles appear as markers on the operator screen instead of the current placeholder, completing the third panel of the live page.

## Scope

### In Scope
- A client-only map component rendering `LiveMapViewModel` markers over OpenStreetMap tiles
- Empty-state rendering for `no-selection` and `no-mappable-selection`
- Marker orientation from `headingDeg` and a label from the view model
- Automatic viewport fit to the rendered markers
- Adding `leaflet` and `react-leaflet` as dependencies

### Out of Scope
- Marker clustering
- Vehicle trails, geofences, or historical routes
- Map interactions that change selection
- Playback tiles and the video grid
- Provider-specific map behavior of any kind

## Capabilities

### New Capabilities
- `live-map-rendering`: Delivery of the live map surface over the existing map view model

### Modified Capabilities
- `live-page-shell`: The map placeholder is replaced by the real map panel

## Approach

Add a presentational map panel that decides between empty state and map, and a client-only Leaflet component loaded through `next/dynamic` with `ssr: false` from the existing client island. The map consumes `LiveMapViewModel` only; it never sees vehicles, providers, or selection state.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/live/*` | Modified | New map panel and map component; screen renders them |
| `package.json` | Modified | Adds `leaflet` and `react-leaflet` |
| `app/globals.css` | Modified | Leaflet stylesheet import if a global import proves necessary |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Leaflet touching `window` during SSR breaks the build | High | Load it via `next/dynamic` with `ssr: false` from a Client Component, as the Next docs require |
| Default marker icons break under the bundler | High | Use a `divIcon` built from markup instead of Leaflet's bundled PNGs |
| Leaflet cannot run under jsdom in tests | High | Test the panel's empty states directly; mock the map module in screen tests |
| Missing OpenStreetMap attribution | Medium | Attribution is part of the tile layer configuration and covered by a test |

## Rollback Plan

Remove the map panel and map component, restore the placeholder in the screen, and drop both dependencies. The map view model and its tests are untouched.

## Dependencies

- `application/live/build-live-map-view-model.ts` (already implemented and tested)
- `components/live/live-screen.tsx`
- `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`

## Success Criteria

- [ ] Selected vehicles with valid GPS appear as markers on `/live`
- [ ] Both map empty states render their message
- [ ] Production build succeeds with no SSR `window` error
- [ ] No provider conditional or business derivation exists in any map component
