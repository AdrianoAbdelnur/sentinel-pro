# Live Application Responsibilities

## Goal

Define which responsibilities belong to the live use-case layer before UI implementation starts.

## Target page model

```ts
type LivePageViewModel = {
  sidebar: LiveSidebarViewModel;
  map: LiveMapViewModel;
  bottomPanel: LiveBottomPanelViewModel;
  playback: LivePlaybackOverlayViewModel;
};
```

## Behavioral rules

- Fleets start collapsed.
- Fleet checkbox selects or deselects child vehicles.
- Map depends on selected vehicles with valid GPS.
- Bottom panel depends on selected vehicles, even when some data is partial.
- Double click to open playback is an explicit action, not a side effect of selection.
- Offline vehicles do not open playback; they show a functional notice.
- Vehicles with no playable video do not create empty tiles.

## Application responsibilities

Application MUST:

- compose the final page view model
- determine mappable vehicles
- determine whether a vehicle can attempt live playback
- resolve playback open actions by `vehicleId`
- deduplicate already-open tiles
- keep provider details out of UI contracts

## Integration responsibilities

Integrations MUST:

- normalize customer, fleet, vehicle, device, and telemetry inputs
- expose playback capability per device or vehicle
- resolve tile renderer, source, and status
- translate provider failures into application-usable results

## Delivery responsibilities

`app/*` and route handlers may:

- parse request input
- call application use cases
- translate results to UI or HTTP

They MUST NOT become the live business layer.
