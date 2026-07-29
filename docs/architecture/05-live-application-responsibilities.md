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
- Fleet counts (`online`/`total`) and the sidebar's provider list are computed
  against each fleet's full roster, before any status/provider/search
  narrowing is applied. Fleet selection state is computed the same way.
  Narrowing would otherwise make counts and the provider dropdown carry no
  information exactly when a filter is active.
- Any active narrowing input (status, provider, or search) forces every
  fleet open; a fleet is dropped from the list only once narrowing empties
  its visible roster.

## Sidebar view model

```ts
type LiveVehicleNode = {
  vehicleId: string;
  plate?: string;         // primary identifier when present
  label: string;          // secondary identifier
  status: VehicleStatus;  // "en-route" | "stopped" | "offline"
  speedKmH?: number;      // absent whenever status is "offline"
  lastReportAt?: string;  // ISO-8601, from telemetry.gpsAt
  provider?: string;      // Device.provider, verbatim
  isSelected: boolean;
  hasValidGps: boolean;
  canOpenLive: boolean;   // status !== "offline" && device.isActive
};

type LiveFleetNode = {
  fleetId: string;
  label: string;
  isExpanded: boolean;
  isSelected: boolean;
  counts: { online: number; total: number };
  vehicles: LiveVehicleNode[];
};

type LiveSidebarViewModel = {
  search: { term: string };
  filters: {
    status: "all" | VehicleStatus;
    provider?: string;
    availableProviders: string[];
    isNarrowed: boolean;
  };
  fleets: LiveFleetNode[];
};
```

`isOnline` does not exist on this contract; `status` is the single source of
truth for a vehicle's liveness, resolved once by
`domain/live/vehicle-status.ts` and never re-derived by delivery. Suppressing
the speed of an offline vehicle is a composition decision, not a rendering one:
the builder omits it, and the row renders exactly what it is given.

`LiveStatusFilter` is `"all" | VehicleStatus`. The `"all"` sentinel lives on the
filter type only — `VehicleStatus` stays at exactly the three real statuses, so
the domain union never grows a value that means "no narrowing".

## Codes, not sentences

View models carry codes, enums and numbers. They never carry a sentence.

Every empty state and notice is a named code union
(`LiveMapEmptyStateCode`, `LiveBottomPanelEmptyStateCode`,
`LivePlaybackNoticeCode`) so delivery can key an exhaustive record off it. The
Spanish lives in `components/live/live-copy.ts`; see
`06-live-delivery-layer.md` for the copy rules.

## Injected clock and threshold

`nowMs` and `staleAfterMs` are **required** on both
`BuildLiveSidebarViewModelInput` and `BuildLivePageViewModelInput`. They are
resolved once at the composition root and threaded down. Making them optional
would let a caller silently forget them and resolve status by a different rule
than the rest of the screen.

Delivery reaches `VehicleStatus` through `application/live`, which re-exports
it, rather than importing `@/domain/live` directly — one import surface for the
whole delivery layer.

## Sidebar composition

Delivery splits the sidebar into small, single-responsibility components
under `components/live/sidebar/`, each depending on `application/live` for
types and never on `domain/live` directly:

| Component | Responsibility |
|-----------|-----------------|
| `live-sidebar.tsx` | The shell: filter region, scroll region, empty-list state. |
| `live-sidebar-filters.tsx` | Lays out the search input, provider dropdown and status chip row. |
| `live-status-filter-chips.tsx` | One chip per status plus "Todos"; exactly one active at a time. |
| `live-provider-filter.tsx` | The provider `<select>`, driven entirely by `filters.availableProviders`. |
| `live-fleet-node.tsx` | One fleet: header (checkbox, expand toggle, label, counts) plus its vehicle list. |
| `live-vehicle-row.tsx` | One vehicle: checkbox, plate headline, label, status badge, speed, last report, provider badge. |
| `live-vehicle-status-badge.tsx` | `VehicleStatus` → coloured pill with its Spanish word. |
| `live-provider-badge.tsx` | `Device.provider` → neutral, monochrome pill, rendered only when present. |

`vehicle-status-tone.ts` holds static, literal Tailwind class records per
status (never a template-generated class name); `format-last-report.ts`
formats a vehicle's last report as an absolute `HH:mm` using a fixed
locale/time zone so the server render and hydration agree byte-for-byte.
`components/live/live-copy.ts` (one level up, shared with the map and bottom
panels) supplies the Spanish word for each `VehicleStatus`.

No sidebar component branches on `Device.provider`'s value; the provider
badge only checks for its presence before rendering.

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

How the current delivery layer is wired — composition root, copy module, client
island, and the Leaflet/Tailwind/`Intl` constraints it works around — is in
`06-live-delivery-layer.md`.
