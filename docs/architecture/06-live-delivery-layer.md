# Live Delivery Layer

## Goal

Record the delivery-side decisions and the framework constraints the live screen
depends on, so `app/live` and `components/live` can be changed without
rediscovering them by breaking something.

`05-live-application-responsibilities.md` defines what delivery is allowed to
do. This document explains how the current implementation does it, and which
parts are load-bearing.

## Composition root

`app/live/page.tsx` is a Server Component and the only place the live slice
reads ambient state.

- `readLiveRuntimeConfig()` (`app/live/live-runtime-config.ts`) is the
  delivery-side environment reader. Howen's server adapter reads credentials
  through `integrations/howen/config.ts`; domain and application never read
  the environment.
- `createOperationalSources()` always contributes the lazily shared Howen
  source and adds memory only when `NODE_ENV` is `development`.
- The page calls `aggregateOperationalSources()` exactly once and passes only
  normalized state plus generic warnings across the client boundary.
- `Date.now()` is read exactly once, there, and threaded down as a plain
  `nowMs` prop.
- Both values are **required** inputs the whole way down. No layer defaults
  them; an optional threshold would let a caller silently get a different
  status rule than the rest of the screen.

### Why the clock is captured on the server

`components/live/live-screen.tsx` is a `"use client"` island that also renders
during SSR. If the server render and hydration each read their own clock, the
same vehicle can resolve to a different `VehicleStatus` in the two passes and
React reports a hydration mismatch. Passing the timestamp down as a prop makes
both passes read the same number by construction.

It is also honest about the data. Telemetry is a frozen snapshot in this slice,
so a ticking client clock would decay vehicles to `offline` against telemetry
that never changed — inventing a state transition that did not happen. When
polling lands, `nowMs` becomes the fetch time of each refresh.

### Why the route is dynamic

`export const dynamic = "force-dynamic"` in `app/live/page.tsx` is not
decoration. The page uses no request-time API, so Next.js would otherwise
prerender `/live` at build time and bake one `nowMs` and one resolved
`staleAfterMs` into the output. Every request would then see the same "now"
until the next deploy, which defeats the staleness rule entirely.

### Configuration failure mode

An absent `SENTINEL_LIVE_STALE_AFTER_MS` is the documented default and is
silent. A variable explicitly set to something unusable (non-numeric, negative,
zero, empty) falls back to `DEFAULT_STALE_AFTER_MS` **and** warns: falling back
keeps the live screen up, the warning keeps an operator mistake from going
unnoticed. Neither case throws.

Howen credentials use non-`NEXT_PUBLIC_` variables. Missing or invalid Howen
configuration becomes the same generic unavailable-source result as a
transport failure. No credential, session, payload, or raw provider error
crosses into `LiveScreen`.

The Howen session, client, and operational source are created lazily and reused
by the process. A page request does not create a new session manager.

### Development-only fixtures

Local development intentionally composes both real Howen and the in-memory
operational source through the generic aggregator. Production excludes the
in-memory source and receives no fixture bottom-panel tabs or rows. This is
source selection, not failure fallback: a Howen failure remains visible.

Every Howen device carries the canonical provider value `HOWEN`. The warning
label, provider filter, badge, real mapped vehicles, and demo vehicles that
represent Howen therefore agree without provider branching.

## Language and copy

Application returns codes. Delivery renders Spanish.

`components/live/live-copy.ts` holds one `Record<Code, string>` per code union —
never `Partial<Record<...>>`. That is the whole mechanism: adding a code to a
union in `application/live` is a `tsc` error until someone writes the Spanish
for it.

Bottom-panel columns are not a closed code union. Their contract accepts
arbitrary stable string keys, so known keys use `BOTTOM_PANEL_COLUMN_COPY` and
unknown keys render their raw value. Playback notice copy is defined for the
application codes, but `LiveScreen` intentionally does not render those notices
until the playback monitor exists.

| String | Home |
|--------|------|
| Keyed by an application code | `live-copy.ts` |
| A component's own words (search placeholder, "Todos", table headers, `Sí`/`No`) | The component that renders them |

A central bag holding every string is a dictionary nobody can trace back to a
screen. Unkeyed labels stay next to their markup because there is no
exhaustiveness guarantee to lose — a missing inline label is a missing element,
immediately visible.

"Offline" is deliberately untranslated: an established operator term.

Source warning sentences also live in `live-copy.ts`, keyed exhaustively by
the application warning code. `live-source-warnings.tsx` interpolates only the
configured source label.

## Client island and state

All live interactivity lives in one island rooted at `live-screen.tsx`.
`live-map-panel.tsx` and `live-map.tsx` carry their own `"use client"`
directives for the lazy-loading reason below, not because they are separate
islands.

State is split by responsibility, not by primitive:

| Concern | Where |
|---------|-------|
| Selection, fleet expansion, active bottom-panel tab | `live-screen.tsx` |
| Narrowing: search + status + provider | `components/live/use-live-sidebar-filters.ts` |

Search, status and provider share one hook because they are one concern: they
narrow the same roster, they are always passed into `buildLivePageViewModel`
together, and they clear together. Five flat `useState` calls in one component
is where the old project's page-as-a-system problem started.

The status filter is a scalar — setting it replaces the value, it never
accumulates a set. The consequence is worth knowing before someone treats it as
a bug: there is no single filter action for "everything currently reporting"
(`en-route` plus `stopped`).

## Sidebar visual language

The sidebar is a column an operator scans for minutes at a time, so it is built
to be read before it is parsed.

- Each vehicle row is two dense lines, not a stack of labelled fields: the
  plate is the headline, everything else is subordinate metadata beneath it.
- A 2px status rail runs down the left edge of every row, so the whole column
  reads as a stripe pattern without a single word being parsed. The fleet
  header's online count is the fleet-level equivalent, turning rose when a
  fleet has nothing reporting at all.
- Offline is **rose, not grey**. Vehicles that stopped reporting are the
  failure state the screen exists to surface, so they must survive peripheral
  vision. Grey reads as "deprioritised", which is the opposite of the intent.
- Colour is never the sole carrier. The dot, the hue and the Spanish word
  always agree, so a status badge survives greyscale and colour-blind vision.
- The "Todos" chip uses sky, deliberately outside the status palette, so it
  cannot read as a fourth status.

The provider badge is the one exception to colour carrying meaning: every
provider renders in the same monochrome pill. Per-provider colours would put
provider identity into the visual language, which
`02-provider-agnostic-live-principles.md` forbids.

The expanded shell remains `w-72`. Fleet labels preserve source casing on one
truncated line with compact `text-xs` typography and normal tracking; widening
the sidebar or forcing uppercase would spend map width without improving the
underlying contract.

## Rendering constraints

These are the ones that bite. Each is enforced by exactly one place in the code.

| Constraint | Why it exists |
|------------|---------------|
| Leaflet must never be imported during SSR | Leaflet's module body touches the DOM at evaluation time (`document.documentElement.style`, `'ActiveXObject' in window`), so importing it on the server throws. `live-map-panel.tsx` loads it through `next/dynamic` with `ssr: false`. |
| `live-map-panel.tsx` is a Client Component | Next.js rejects `ssr: false` on `next/dynamic` inside a Server Component. The directive is what keeps the line above legal. |
| The map needs an explicit resize signal | Leaflet measures its container once at mount and never observes later size changes, so collapsing a side panel leaves the map drawn at its old size with dead space around it. `InvalidateOnResize` attaches a `ResizeObserver` and calls `map.invalidateSize()`. |
| Marker markup is a hand-built HTML string | Leaflet's `divIcon` takes an HTML string, not a React element. `buildMarkerHtml` is the one place in the project that builds markup by hand. Styling still goes through Tailwind classes; only the rotation angle, which is genuinely dynamic, is passed as a CSS custom property. |
| `FitBounds` keys its effect on serialised coordinates | The marker array is rebuilt on every render, so depending on its identity would refit the map continuously. |
| Tailwind class names must be complete literals | Tailwind v4 extracts classes by scanning source text, so `bg-${hue}-500/15` produces no CSS at all. `sidebar/vehicle-status-tone.ts` holds full literal class strings per status, which doubles as an exhaustiveness guarantee: a new `VehicleStatus` is a type error until it has a tone. |
| Timestamps are formatted with a pinned locale and time zone | `Intl`'s implicit locale and time zone can differ between the Node server render and the browser, making anything clock-derived a hydration-mismatch source. `sidebar/format-last-report.ts` pins both, and sets `hourCycle: "h23"` because `hour12: false` alone leaves the hour cycle implementation-defined and can render midnight as `24:mm`. |

## Live map clustering boundary

React Leaflet remains the only map renderer. `supercluster@8.0.1` is used only
as an immutable spatial index: it receives provider-neutral logical marker
coordinates and returns point or cluster entries for settled map bounds and
zoom. The integration does not install a Leaflet clustering plugin, import
plugin CSS, patch the Leaflet runtime, or own imperative marker layers.

The index stores only `vehicleId` in GeoJSON properties and is rebuilt from a
stable coordinate signature. Labels and headings are resolved from a separate
lookup, so telemetry presentation changes do not rebuild spatial data. Map
queries run after `moveend` and `zoomend`, and their results render through
ordinary declarative React Leaflet `Marker` and `Polyline` components.

Cluster activation below maximum zoom fits immutable member bounds and caps
the viewport at Supercluster's expansion zoom. Exact overlaps at maximum zoom
fan into deterministic display positions sorted by vehicle ID. Those derived
positions never replace source coordinates, which remain the inputs for map
fit and application state. Any active fan is cleared after a settled move or
zoom.

The client-only `LiveMapPanel` dynamic-import boundary continues to prevent
server evaluation of Leaflet and clustering code. Before clustering was wired
into `/live`, the development-only 621-point Turbopack harness proved index
construction, viewport queries, expansion, fan, collapse, resize, heartbeat,
and next-frame click feedback in a real browser. The recorded gate remains in
the archived change evidence; the harness route returns `notFound()` outside
development.

### The map is never replaced by a sentence

`LiveMapPanel` renders the map even when `LiveMapViewModel` carries an
`emptyState`. The map is the spatial frame the rest of the screen is read
against; swapping it for a paragraph forces the operator into a context switch
every time the selection empties. The empty state is therefore an overlay
notice floating over a live map — same code, same copy — not a replacement.

### Leaflet stacking order

Leaflet's panes are absolutely positioned with explicit z-indices, and its
container is `position: relative` with `z-index: auto` — so the container
creates no stacking context and the panes compete directly in the nearest
positioned ancestor, *outside* the map. Anything overlaid on the map is ordered
against these values from `leaflet.css`, not against the map as a single layer:

| Pane | z-index |
|------|---------|
| tile | 200 |
| overlay | 400 |
| shadow | 500 |
| marker | 600 |
| tooltip | 650 |
| popup | 700 |
| control | 800 |
| control corners (`.leaflet-top` / `.leaflet-bottom`) | 1000 |

The empty-state notice in `live-map-panel.tsx` uses `z-400`. That clears the
tile pane and ties with the overlay pane, where DOM order breaks the tie in the
notice's favour. It does **not** clear the marker, tooltip, popup or control
panes. This is currently harmless because the notice only renders when there is
nothing to plot, so there are no markers to collide with — but the zoom control
does out-rank it. Anything that must sit over a *populated* map needs a value
above 1000.

## Development fixtures and map tests

`integrations/live/in-memory/in-memory-live-data-source.ts` declares telemetry
ages relatively (`gpsAgoMs`) and materialises `gpsAt` against `Date.now()` on
every read. Hardcoded ISO timestamps rot: a fixture written today as "reported
30 seconds ago" reads as permanently stale a few months later, every demo
vehicle shows `offline`, and the staleness branch of `resolveVehicleStatus`
stops being exercised by anyone opening `/live` in development. Omitting
`gpsAgoMs` entirely means "no position report ever received".

The cost is that `readLiveState()` is not referentially transparent. That is
acceptable for a development-scoped fixture and it does not reach the client:
the server calls it once per request and serialises the result, so SSR and
hydration still see identical data. Its test asserts structural equality and
object-identity freshness, not literal strings.

The map has two suites on purpose:

- `live-map.test.tsx` mocks `react-leaflet`. It can only prove that props
  reached a stub the test configured itself. It must also install a
  `ResizeObserver` stand-in, because jsdom has none and the resize effect
  guards on its absence — without the stand-in the behaviour is silently
  skipped exactly where it broke.
- `live-map.integration.test.tsx` renders the real Leaflet stack. That is the
  only way to prove a requirement like tile attribution actually reaches the
  user.
