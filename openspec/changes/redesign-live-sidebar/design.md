# Design: redesign-live-sidebar

## Technical Approach

Three moves, in dependency order.

1. **A new pure domain function** resolves `en-route | stopped | offline` from telemetry. It takes the clock and the staleness threshold as arguments and reads no globals, exactly like the existing `hasValidGps`. It becomes the only sanctioned reader of `DeviceTelemetry.online`.
2. **The application layer stops speaking Spanish, English, or any language.** Every view model that carried a sentence now carries a code. Delivery maps codes to Spanish through one code-keyed module, so the compiler fails when a code has no copy.
3. **The sidebar is rebuilt as eight small components** under `components/live/sidebar/`, fed by a widened `LiveSidebarViewModel`. The single boolean filter becomes a status set plus an optional provider, both owned by one hook inside the existing client island.

The env var is read exactly once, in a delivery-side config module, and threaded down as a plain number. `now` is captured once during the server render and threaded the same way. Neither `domain/` nor `application/` ever touches `process.env` or `Date.now()`.

---

## Architecture Decisions

### D1: Status resolution is a pure domain function, with the clock and threshold as arguments

**Choice**: Create `domain/live/vehicle-status.ts` exporting `VehicleStatus` and `resolveVehicleStatus({ telemetry, nowMs, staleAfterMs })`. It imports only `DeviceTelemetry`. It never calls `Date.now()` and never defaults `staleAfterMs`.

**Alternatives considered**:
- Compute status inside `buildLiveSidebarViewModel`.
- Compute status inside the integration layer and put `status` on `DeviceTelemetry`.

**Rationale**: `docs/architecture/01-target-structure.md` states `domain` depends on nothing framework-specific, and `03-live-core-domain.md` puts telemetry interpretation in the core domain. "A vehicle that has not reported for N minutes is offline" is a business rule about a domain entity, not a composition concern of one screen — the map panel, the bottom panel and playback eligibility will all want it. Keeping it in the sidebar builder would make the second consumer copy it.

Computing it in integrations was rejected for the opposite reason: each provider adapter would re-implement the rule, and `02-provider-agnostic-live-principles.md` requires providers to *normalize* inputs, not to decide business meaning. Adapters supply `online` and `gpsAt`; the domain decides what they mean.

The threshold is not defaulted inside the function because a default there silently re-introduces configuration into the layer that must not own it. `DEFAULT_STALE_AFTER_MS` is exported as a separate constant, and only the delivery config module consumes it.

### D2: The env var is read once at the composition root; `now` is the server render time

**Choice**: Add `app/live/live-runtime-config.ts` with `readLiveRuntimeConfig(): { staleAfterMs: number }`. It is the only `process.env` read in the repo. `app/live/page.tsx` calls it, captures `Date.now()` once, and passes both to `<LiveScreen>` as serializable number props.

```text
process.env.SENTINEL_LIVE_STALE_AFTER_MS
  -> readLiveRuntimeConfig()        (app/live, delivery)
    -> <LiveScreen staleAfterMs nowMs />   (props, plain numbers)
      -> buildLivePageViewModel({ nowMs, staleAfterMs, ... })
        -> buildLiveSidebarViewModel({ nowMs, staleAfterMs, ... })
          -> resolveVehicleStatus({ telemetry, nowMs, staleAfterMs })
```

`nowMs` and `staleAfterMs` are **required** on `BuildLiveSidebarViewModelInput` and `BuildLivePageViewModelInput`. No optional-with-default. An optional threshold would let a caller forget it and get a silently different rule.

**Alternatives considered**:
- Read `Date.now()` in the client island (`useState(() => Date.now())` or a `setInterval` ticker).
- Install a config library (`zod` + `dotenv`) to validate the env.

**Rationale for the server-supplied clock**: the client island is a `"use client"` component that also renders during SSR. If the server renders "en ruta" from its clock and hydration re-evaluates a different clock, React reports a hydration mismatch — a documented Next.js failure mode for anything derived from `Date`. Passing the timestamp as a prop makes SSR and hydration read the same number by construction.

It also happens to be honest: in this slice telemetry is a frozen snapshot. A ticking client clock would decay vehicles to "offline" against telemetry that never changes — inventing a state transition that did not happen. When polling lands, `nowMs` becomes the fetch time of each refresh, which is the correct source anyway.

**Rationale for no config library**: one variable, one `Number()` parse, one range guard. `AGENTS.md` forbids adding dependencies without a clear architectural reason and a single scalar is not one.

**Unit**: milliseconds end to end, so no layer performs a conversion. `.env.example` documents `SENTINEL_LIVE_STALE_AFTER_MS=300000 # 5 minutes`. Invalid values (`NaN`, `<= 0`) fall back to the default rather than throwing; a malformed ops variable should not take the live screen down.

**Not adding `server-only`**: the config module has exactly one importer. If a second config value appears, add the guard then.

### D3: `resolveVehicleStatus` is the only reader of `telemetry.online`

**Choice**: No view model exposes `isOnline` any more. `LiveVehicleNode.isOnline` is replaced by `status`. `canOpenLive` becomes `status !== "offline" && device?.isActive === true`.

**Rationale**: making `online` optional is the point of this change, but it also weakens the type for every consumer — see [Known Problems](#known-problems-created-by-fixed-decisions). The structural mitigation is to leave no reason to read the field. After this change, `.online` should appear in `domain/live/vehicle-status.ts`, in fixtures, and nowhere else in `application/` or `components/`.

### D4: Use cases return codes; delivery holds Spanish in one code-keyed module

**Choice**:

| Producer | Today | After |
|----------|-------|-------|
| `buildLiveMapViewModel` | `{ code, message }` | `{ code }` |
| `buildLiveBottomPanelViewModel` | `{ code, message }` | `{ code }` |
| `openVehicleLive` | `notice: { code, message }` | `notice: { code }` |
| `buildLiveSidebarViewModel` | `search: { term, placeholder }` | `search: { term }` |

Each inline code union is extracted into a named type (`LiveMapEmptyStateCode`, `LiveBottomPanelEmptyStateCode`, `LivePlaybackNoticeCode`) so it can key a record. `components/live/live-copy.ts` exports one `Record<Code, string>` per union.

```ts
export const MAP_EMPTY_STATE_COPY: Record<LiveMapEmptyStateCode, string> = { /* ... */ };
export const VEHICLE_STATUS_COPY: Record<VehicleStatus, string> = { /* ... */ };
```

`Record<Code, string>` — never `Partial<Record<...>>`. That is the whole mechanism: adding a code to a union is a type error until someone writes the Spanish.

**Alternatives considered**:
- Per-component literals for everything.
- An i18n runtime (`next-intl`, `react-intl`).

**Why not per-component literals**: they are fine for a label that exists once. They fail for code-keyed text, and this change has three cases of exactly that. `no-selection` is produced by two different view models and needs two different sentences; `VehicleStatus` is rendered in at least three places (row badge, filter chips, fleet counts label) and must read identically in all of them. With scattered literals nothing tells you a new code has no copy — the screen just renders `undefined`, or worse, a component invents a fourth wording for "detenido".

**Why not i18n**: there is one locale. The decision is "screens in Spanish", not "the product is localized". `next-intl` buys message extraction, ICU plurals and locale negotiation, none of which is needed, in exchange for a dependency, a provider component and a build step. That fails the `AGENTS.md` bar for adding a library. The copy module is the seam an i18n migration would target later.

### D5: Only code-keyed text goes in the copy module; component-local words stay inline

**Choice**: The boundary is *keyed by an application code → copy module; this component's own words → this component*.

| String | Home |
|--------|------|
| Empty-state and notice sentences | `live-copy.ts` (keyed by code) |
| Status labels ("En ruta", "Detenido", "Offline") | `live-copy.ts` (keyed by `VehicleStatus`) |
| Search placeholder, "Todos" chip, "Vel:", table header, `Sí`/`No` | The component that renders them |

**Rationale**: a central bag holding every string in the app is a dictionary nobody can trace back to a screen — you cannot tell what `LIVE_SIDEBAR_LABEL_3` renders without grepping. Keeping unkeyed labels next to their markup preserves readability and costs nothing, because there is no exhaustiveness guarantee to lose: a missing inline label is a missing element, immediately visible.

"Offline" stays as-is, per the recorded language decision: an established technical term the operators already use.

### D6: The status filter is a single value; the provider filter is a single optional value

**Choice**:

```ts
type LiveSidebarFilters = {
  status: LiveStatusFilter;  // "all" | VehicleStatus
  provider?: string;         // undefined = no provider narrowing
};
```

The chip row renders one chip per status plus a "Todos" chip. Exactly one chip is active at a time; clicking a chip replaces the current value.

**Alternatives considered**:
- Multi-select set: `statuses: VehicleStatus[]`, empty meaning "all".
- Multi-select provider (checkbox list instead of a dropdown).

**Rationale**: user decision, 2026-07-29. An earlier version of this document specified the multi-select set and argued that an operator's most common question is "what is reporting right now" (`en-route + stopped`), which single-select cannot express. That argument was put to the user and rejected in favour of the simpler model, which is also what the delta spec already specified.

The consequence is real and should be recorded rather than hidden: there is no way to ask for "everything currently reporting" in one filter action. If that need materialises, the options are a fourth filter value with no domain meaning, or widening this field to a set — the latter being the change this document originally proposed.

`LiveStatusFilter` deliberately keeps `"all"` OUT of `VehicleStatus`: the domain union stays at exactly the three real statuses, and only the filter type carries the extra sentinel.

The provider stays single-select because it is a dropdown in the target design and because provider is a *source* axis, not a *condition* axis: operators check one integration at a time when something looks wrong. If that proves false, widening `provider?: string` to `providers: string[]` is an additive change to the same filter object.

### D7: Counts, the provider list and fleet selection are computed against the full roster

**Choice**: The builder runs in this order.

1. Resolve `status` for every vehicle in `liveVehicles` (needs `nowMs`, `staleAfterMs`).
2. Compute `counts` per fleet over its **entire** roster, before any narrowing.
3. Compute `filters.availableProviders` over the **entire** vehicle set, before any narrowing.
4. Compute `isSelected` per fleet over its **entire** roster.
5. Apply status → provider → search narrowing to produce `vehicles`.
6. Drop a fleet only when a narrowing input is active and its visible list is empty.
7. Force `isExpanded = true` when any narrowing input is active.

**Rationale, per item**:
- **Counts**: if counts tracked the filtered list, filtering by "en ruta" would make every header read `n · n · 0 · 0` and the numbers would carry no information. Counts answer "how big and how healthy is this fleet", which is a property of the fleet, not of the current filter.
- **Provider list**: if the dropdown were derived from the filtered set, selecting a provider would remove every other option from the dropdown and the operator could not switch back without clearing.
- **Fleet selection**: `live-operator-panels` already specifies *"Fleet selection state ignores search filtering"*. The current implementation only half-honours it — `isSelected` is computed after the `onlyActiveOrOnline` filter but before the search filter. That inconsistency is fixed here: all narrowing inputs are treated the same.
- **Forced expansion**: filtering by "en ruta" against collapsed fleets shows the operator a list of headers and no vehicles. Search already forces expansion; status and provider must too.

`filters.isNarrowed: boolean` is added to the view model so delivery does not re-derive a three-clause condition. Two consumers need it: the fleet header (whether to show a "visible of total" number) and the empty list (whether to say "this fleet has no vehicles" or "nothing matches").

### D8: The sidebar splits into eight components under `components/live/sidebar/`

**Choice**:

| Component | Single responsibility |
|-----------|----------------------|
| `live-sidebar.tsx` | The `<aside>` shell: filter region, scroll region, empty-list state. Owns no per-vehicle knowledge. |
| `live-sidebar-filters.tsx` | Lays out the search input, provider dropdown and chip row. No filtering logic. |
| `live-status-filter-chips.tsx` | Renders the chip row and reports the selected value. Exactly one chip is active. |
| `live-provider-filter.tsx` | The provider `<select>`, including its "todos" option. |
| `live-fleet-node.tsx` | One fleet: header (checkbox, expand toggle, label, counts) plus its vehicle list. |
| `live-vehicle-row.tsx` | One vehicle: checkbox, plate, label, status badge, speed, last report, provider badge. |
| `live-vehicle-status-badge.tsx` | `VehicleStatus` → coloured pill with its Spanish word. |
| `live-provider-badge.tsx` | `Device.provider` → neutral pill, verbatim, uppercased for display. |

Two supporting non-component files: `vehicle-status-tone.ts` (static Tailwind class records, see D10) and `components/live/live-copy.ts` (shared with the map and bottom panels, so it stays one level up).

**Deliberately NOT split**: the fleet count cluster stays inline in `live-fleet-node.tsx`. It is three spans with no logic and no second consumer. `AGENTS.md` asks for small files, not one file per element; a `live-fleet-counts.tsx` would add an import and a prop type to save four lines of JSX.

**Why `live-provider-badge.tsx` IS split despite being small**: it is the single point where provider identity touches the UI. `02-provider-agnostic-live-principles.md` forbids the UI branching on provider, and the old project violated exactly this rule inside a page component. Isolating provider rendering in one file makes the rule auditable by opening one file, and gives a future provider→display-name mapping an obvious home.

**Why a subfolder**: the sidebar alone would otherwise be 8 of ~16 files in a flat `components/live/`. `live-sidebar.tsx` and `live-fleet-node.tsx` move into it; the `live-` prefix is kept for import-site readability and test-file symmetry with the rest of the repo.

**All eight are presentational.** None holds state, none imports from `domain/` — status typing reaches them through `application/live`, which re-exports `VehicleStatus` so delivery keeps a single import surface.

### D9: One client island; the narrowing state moves into a hook

**Choice**: `live-screen.tsx` stays the only `"use client"` island. Its state splits by responsibility, per the `AGENTS.md` state-management rule:

| Concern | Where | Shape |
|---------|-------|-------|
| Selection | `live-screen.tsx` | `useState<string[]>` — unchanged |
| View state (expansion) | `live-screen.tsx` | `useState<string[]>` — unchanged |
| Panel state (active tab) | `live-screen.tsx` | `useState<LiveBottomPanelTab["key"]>` — unchanged |
| Narrowing (search + status + provider) | `use-live-sidebar-filters.ts` | `setSearchTerm` / `setStatus` / `setProvider`, with `setStatus` replacing the scalar value |

`onlyActiveOrOnline: boolean` disappears; `searchTerm` moves out of the island into the hook and joins the filters, because search and filters are one concern — they narrow the roster, they are always passed into the same use case together, and they are cleared together.

**Alternatives considered**: keeping five flat `useState` calls; splitting the sidebar into its own island.

**Rationale**: five independent `useState` calls in one component is where the old project's page-as-a-system problem started. Grouping by responsibility, not by primitive, is the rule the repo already wrote down. The hook also gives the narrowing state a unit-testable home outside the render tree.

A second island was rejected for the reason the archived shell design already gave: the whole page view model comes from one synchronous call, so a sidebar island would either have to lift the same state back up or duplicate the call.

### D10: Status colours are static class records, never generated class names

**Choice**: `vehicle-status-tone.ts` exports `VEHICLE_STATUS_TONE: Record<VehicleStatus, { dot: string; badge: string; chipActive: string; count: string }>` where every value is a complete, literal Tailwind class string.

**Rationale**: Tailwind v4 extracts classes by scanning source text. `bg-${hue}-500/15` produces no CSS. A record of literal strings is both the correct Tailwind pattern and the exhaustiveness guarantee — a new status is a type error until it has a tone.

No `@theme` tokens are added. One screen does not justify a semantic-token layer, and the record is the seam that would later be swapped for tokens without touching any component.

### D11: In-memory fixtures declare relative ages, materialized at read time

**Choice**: Fixture rows declare `gpsAgoMs` (e.g. `30_000`, `9 * 60_000`); `readLiveState()` converts them to ISO strings against `Date.now()` at read time.

**Alternatives considered**: hardcoded ISO timestamps.

**Rationale**: hardcoded timestamps rot. A fixture written today as "reported 30 seconds ago" is nine months stale next quarter, every demo vehicle reads "offline", and the staleness branch stops being exercised by anyone opening the dev screen. Making the source time-relative keeps the fixture demonstrating all three statuses forever.

The cost is that `readLiveState()` is no longer referentially transparent. That is acceptable for a fixture module explicitly scoped to development, and it does not reach the client: the server calls it once per request and serializes the result, so SSR and hydration still see identical data. The fixture's own test asserts relative properties, not literal strings.

---

## Data Flow

```text
app/live/page.tsx  (server)
   ├─ readLiveRuntimeConfig()          -> { staleAfterMs }        [only process.env read]
   ├─ Date.now()                       -> nowMs                   [only clock read]
   ├─ inMemoryLiveDataSource.readLiveState()
   └─ <LiveScreen liveState tabs nowMs staleAfterMs />            (client island)
        ├─ useLiveSidebarFilters()     -> { searchTerm, status, provider }
        ├─ useState                    -> selection, expansion, activeTab
        └─ buildLivePageViewModel({ ..., nowMs, staleAfterMs })
             ├─ buildLiveSidebarViewModel
             │     └─ resolveVehicleStatus({ telemetry, nowMs, staleAfterMs })   [domain, pure]
             ├─ buildLiveMapViewModel            -> emptyState: { code }
             └─ buildLiveBottomPanelViewModel    -> emptyState: { code }

        view model carries codes, enums and numbers — never a sentence
             ↓
        components/live/**  +  live-copy.ts      -> Spanish strings
```

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `domain/live/vehicle-status.ts` | Create | `VehicleStatus`, `resolveVehicleStatus`, `DEFAULT_STALE_AFTER_MS` |
| `domain/live/vehicle-status.test.ts` | Create | Table-driven, injected clock |
| `domain/live/entities.ts` | Modify | `DeviceTelemetry.online?: boolean` |
| `domain/live/index.ts` | Modify | Export the new module |
| `docs/architecture/03-live-core-domain.md` | Modify | Documented contract must match `online?` |
| `application/live/contracts.ts` | Modify | Node fields, filter shape, named code unions, `nowMs`/`staleAfterMs`, `message` removed, `VehicleStatus` re-export |
| `application/live/build-live-sidebar-view-model.ts` | Modify | Status resolution, status/provider narrowing, counts, provider list, placeholder removed |
| `application/live/build-live-page-view-model.ts` | Modify | Thread `nowMs`, `staleAfterMs`, new filters |
| `application/live/build-live-map-view-model.ts` | Modify | Drop `message` |
| `application/live/build-live-bottom-panel-view-model.ts` | Modify | Drop `message` |
| `application/live/open-vehicle-live.ts` | Modify | Notice carries `code` only |
| `application/live/*.test.ts` (4 files) | Modify | New inputs; `toEqual` → `toMatchObject` (see Testing Strategy) |
| `app/live/live-runtime-config.ts` | Create | The only `process.env` read |
| `app/live/live-runtime-config.test.ts` | Create | Default, override, invalid value |
| `app/live/page.tsx` | Modify | Resolve config and clock, pass down |
| `.env.example` | Create | Document `SENTINEL_LIVE_STALE_AFTER_MS` |
| `components/live/live-copy.ts` | Create | Code-keyed Spanish records |
| `components/live/live-copy.test.ts` | Create | No empty strings |
| `components/live/use-live-sidebar-filters.ts` | Create | Narrowing state and toggles |
| `components/live/use-live-sidebar-filters.test.ts` | Create | Set-toggle semantics |
| `components/live/live-screen.tsx` | Modify | New props, hook wiring, filter handlers |
| `components/live/live-screen.test.tsx` | Modify | Copy constants instead of English regexes; filter test rewritten |
| `components/live/live-map-panel.tsx` | Modify | Render copy by code |
| `components/live/live-bottom-panel.tsx` | Modify | Render copy by code; `Sí`/`No`; Spanish header |
| `components/live/sidebar/live-sidebar.tsx` | Move + Modify | Shell only |
| `components/live/sidebar/live-fleet-node.tsx` | Move + Modify | Header, counts, delegates rows |
| `components/live/sidebar/live-sidebar-filters.tsx` | Create | Filter region layout |
| `components/live/sidebar/live-status-filter-chips.tsx` | Create | Chip row |
| `components/live/sidebar/live-provider-filter.tsx` | Create | Provider dropdown |
| `components/live/sidebar/live-vehicle-row.tsx` | Create | One vehicle row |
| `components/live/sidebar/live-vehicle-status-badge.tsx` | Create | Status pill |
| `components/live/sidebar/live-provider-badge.tsx` | Create | Provider pill |
| `components/live/sidebar/vehicle-status-tone.ts` | Create | Static Tailwind class records |
| `components/live/sidebar/*.test.tsx` | Create | Row, chips, fleet node |
| `integrations/live/in-memory/in-memory-live-data-source.ts` | Modify | Fixture matrix (see below) |
| `integrations/live/in-memory/in-memory-live-data-source.test.ts` | Modify | Assert all three statuses and the degraded cases exist |

---

## Interfaces / Contracts

### Domain

```ts
// domain/live/vehicle-status.ts
export type VehicleStatus = "en-route" | "stopped" | "offline";

export const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;

export type ResolveVehicleStatusInput = {
  telemetry?: DeviceTelemetry;
  nowMs: number;
  staleAfterMs: number;
};

export function resolveVehicleStatus(input: ResolveVehicleStatusInput): VehicleStatus;
```

Resolution order, and the edge cases it must pin down:

| Condition | Result |
|-----------|--------|
| No telemetry at all | `offline` |
| `online === false` | `offline` — regardless of how fresh `gpsAt` is or what speed says |
| `online === true` | online; go to the speed rule |
| `online` absent, `gpsAt` absent or unparsable | `offline` — absence of evidence is not liveness |
| `online` absent, `nowMs - gpsAt > staleAfterMs` | `offline` |
| `online` absent, `nowMs - gpsAt <= staleAfterMs` | online; go to the speed rule |
| `online` absent, `gpsAt` in the future (negative elapsed) | online — clock skew must not invert the rule |
| Online and `speedKmH > 0` | `en-route` |
| Online and speed is `0`, absent, negative or `NaN` | `stopped` |

Exactly at the threshold is **online**; the rule is strictly greater-than.

### Application

```ts
export type { VehicleStatus } from "@/domain/live"; // delivery never imports domain directly

export type LiveVehicleNode = {
  vehicleId: string;
  plate?: string;        // primary identifier when present
  label: string;         // secondary identifier
  status: VehicleStatus;
  speedKmH?: number;
  lastReportAt?: string; // ISO-8601, from telemetry.gpsAt
  provider?: string;     // Device.provider, verbatim
  isSelected: boolean;
  hasValidGps: boolean;
  canOpenLive: boolean;
};

export type LiveFleetNode = {
  fleetId: string;
  label: string;
  isExpanded: boolean;
  isSelected: boolean;
  counts: { online: number; total: number }; // per user decision, not byStatus
  vehicles: LiveVehicleNode[];
};

// "all" means no status narrowing; the domain union itself stays at exactly
// the three real statuses (D6).
export type LiveStatusFilter = "all" | VehicleStatus;

export type LiveSidebarViewModel = {
  search: { term: string };
  filters: {
    status: LiveStatusFilter;
    provider?: string;
    availableProviders: string[];
    isNarrowed: boolean;
  };
  fleets: LiveFleetNode[];
};

export type BuildLiveSidebarViewModelInput = {
  fleets: LiveFleetState[];
  liveVehicles: LiveVehicleState[];
  selectedVehicleIds: string[];
  searchTerm: string;
  nowMs: number;         // required
  staleAfterMs: number;  // required
  expandedFleetIds?: string[];
  status?: LiveStatusFilter;
  provider?: string;
};

export type LiveMapEmptyStateCode = "no-selection" | "no-mappable-selection";
export type LiveBottomPanelEmptyStateCode = "no-selection";
export type LivePlaybackNoticeCode = "vehicle-offline" | "vehicle-no-video";
```

Notes on the shape changes:

- `isOnline` is **removed**, not kept alongside `status`. Two representations of the same fact drift.
- `secondaryLabel` is **replaced** by explicit `plate` and `label`. The application supplies both raw; delivery renders `plate ?? label` as the headline and `label` beneath only when a plate exists. Which one is the headline is presentation, not business.
- `counts` becomes required (it was optional and never populated) and carries `online`/`total`, per the user decision recorded on 2026-07-29. An earlier version of this document proposed a `byStatus` record instead; that was not adopted.
- The empty-state and notice wrappers keep their object shape (`{ code }`, not a bare string) so the call sites are unchanged and there is a slot for interpolation parameters later.
- `speedKmH` is optional and MUST be absent whenever `status` is `offline`, even if telemetry carries a stored value; an online vehicle's `speedKmH` is exposed as reported, including a genuine `0` (decided 2026-07-29).
- `search.placeholder` does not exist on `LiveSidebarViewModel.search`; the search input's placeholder text is a component-local literal (D5), not application output (decided 2026-07-29).

### Delivery

```ts
// components/live/live-copy.ts
export const MAP_EMPTY_STATE_COPY: Record<LiveMapEmptyStateCode, string>;
export const BOTTOM_PANEL_EMPTY_STATE_COPY: Record<LiveBottomPanelEmptyStateCode, string>;
export const PLAYBACK_NOTICE_COPY: Record<LivePlaybackNoticeCode, string>;
export const VEHICLE_STATUS_COPY: Record<VehicleStatus, string>; // "En ruta" | "Detenido" | "Offline"
export const BOTTOM_PANEL_TAB_COPY: Record<LiveBottomPanelTab["key"], string>;
export const BOTTOM_PANEL_COLUMN_COPY: Record<string, string>; // keyed by column key
```

`BOTTOM_PANEL_TAB_COPY` and `BOTTOM_PANEL_COLUMN_COPY` are the resolution of Known Problem #6 (2026-07-29): the port and the composed view model now carry `key` only, and these two records are where delivery supplies the Spanish word for each key, the same exhaustiveness mechanism as D4. Today's fixture keys a column the same way in every tab it appears in (`alarm` means "Alarm" in both alarm tabs), so a flat `Record<string, string>` is sufficient; a genuine per-tab collision would need `BOTTOM_PANEL_COLUMN_COPY` scoped by tab key instead — a call the next fixture change gets to make, not this one.

---

## In-Memory Data Source

The fixture must exercise every branch of D1 and every degraded render path. Target matrix, spread across three fleets:

| Vehicle | `online` | `gpsAgoMs` | `speedKmH` | Device | Expected | What it proves |
|---------|----------|-----------|-----------|--------|----------|----------------|
| 1 | `true` | 30 s | 46 | active, provider A | `en-route` | Happy path |
| 2 | `false` | 20 s | 55 | active, provider A | `offline` | Explicit `false` beats a fresh report **and** a non-zero speed |
| 3 | absent | 2 min | 0 | active, provider B | `stopped` | Staleness fallback resolves online; zero speed |
| 4 | absent | 9 min | 55 | active, provider B | `offline` | Staleness fallback beats a non-zero speed |
| 5 | `true` | absent | absent | active, provider C | `stopped` | Online with no speed reported |
| 6 | absent | absent | — | inactive device | `offline` | No liveness evidence at all; `canOpenLive` false |
| 7 | no telemetry, no device | — | — | none | `offline` | Missing everything; no provider badge; must not appear in the dropdown |

Additional fixture requirements:

- **Three distinct provider values** so the dropdown has something to do, plus vehicle 7 with none — the dropdown must never render an `undefined` option.
- **A flattened sub-fleet** rendered as a sibling: `AB CONSTRUCCIONES` and `AB CONSTRUCCIONES (Rio Tinto)` as two top-level fleets. This is the fixture that proves the flat-grouping decision.
- **One empty fleet** (zero vehicles) to exercise `counts.total = 0` and the "empty fleets survive when nothing is narrowing" rule.
- Vehicles 1 and 3 keep valid GPS so the map and bottom panel keep working; vehicles 2, 4 and 6 do not.

`gpsAgoMs` is the declared form; `readLiveState()` materializes ISO strings (D11).

---

## Visual Design

Dark operator console. Tailwind v4, stock `zinc` / `emerald` / `amber`. No new theme tokens.

### Colour semantics

One hue per status, used consistently across the dot, badge, chip and count. Colour is never the only carrier — every status also shows its Spanish word.

| Status | Hue | Badge | Dot | Chip (active) |
|--------|-----|-------|-----|---------------|
| `en-route` | emerald | `bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30` | `bg-emerald-400` | same as badge |
| `stopped` | amber | `bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30` | `bg-amber-400` | same as badge |
| `offline` | zinc | `bg-zinc-700/40 text-zinc-400 ring-1 ring-inset ring-zinc-600/40` | `bg-zinc-600` | same as badge |

**Offline is grey, not red.** Red stays reserved for alarms and faults — the bottom panel already has alarm tabs. Offline is an absence of data, not an incident; painting it red trains operators to ignore red.

**Selection must not reuse the emerald fill**, because emerald already means "en ruta" and two emerald fills in one row is ambiguous. Selected row: `bg-zinc-800/80` with `border-l-2 border-emerald-500`. Emerald survives as the *interaction* accent (checkbox `accent-emerald-500`, `focus-visible:ring-2 focus-visible:ring-emerald-500/60`) but never as a row fill. Different channel, same brand hue.

**Provider badges are monochrome for every provider**: `rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 ring-1 ring-inset ring-zinc-700`. Assigning per-provider colours would put provider identity into the visual language and is the first step toward `if (provider === "howen")` in a component.

### Hierarchy inside a vehicle row

Four levels, distinguished by size and weight before colour:

1. **Plate** — headline. `text-sm font-medium uppercase tracking-wider text-zinc-100`.
2. **Vehicle label** — `text-xs text-zinc-400 truncate`. Rendered only when a plate exists (otherwise the label is the headline).
3. **Telemetry line** — speed and last report. `text-[11px] text-zinc-500 tabular-nums`. `tabular-nums` matters: without it the numbers jitter as values change.
4. **Badges** — the status badge is the only saturated element in the row; the provider badge is outline-only so it never competes.

Layout: checkbox, then a two-line identity block that takes the remaining width, then a right-aligned badge column. Row height ≈ 56–60 px (`px-2.5 py-2`, `gap-2`). Sidebar widens `w-72` → `w-80`; the old width cannot hold plate, badge, speed and provider without truncating something that matters.

### Fleet header

Sticky inside the scroll region: `sticky top-0 z-10 bg-zinc-950/95 backdrop-blur`. Label `text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400`. Counts sit right-aligned as three `tabular-nums` numbers, each tinted with its status hue and separated by a thin `text-zinc-700` divider, with a Spanish `aria-label` so the cluster is not a mystery to a screen reader. When `filters.isNarrowed` is true, the header also shows the visible count against the total.

### Filter region

Three stacked rows in a 320 px column, separated from the list by a border:

1. Search input, full width — same styling as today.
2. Provider `<select>`, full width, native element (a custom dropdown would need Radix, and shadcn/ui is not installed).
3. Chip row, `flex flex-wrap gap-1.5`. Chips are `rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset`; inactive `bg-transparent text-zinc-400 ring-zinc-700 hover:text-zinc-200`; active takes its status fill. "Todos" active style is neutral (`bg-zinc-100/10 text-zinc-100 ring-zinc-500`) so it does not claim a status hue.

### Timestamps

`lastReportAt` renders as an absolute `HH:mm` inside `<time dateTime={iso}>`, with the full local timestamp in `title`.

Relative text ("hace 3 min") was rejected: it forces the clock back into delivery, and with a frozen `nowMs` it would go silently wrong instead of visibly stale.

Formatting uses an explicit locale and time zone constant (`es-AR`, `America/Argentina/Buenos_Aires`) rather than the runtime default. `Intl` defaults differ between the Node server and the browser, which is a classic Next.js hydration mismatch. See [Open Questions](#open-questions) — a hardcoded time zone is a real assumption in a system heading for multi-tenant.

### Missing values

Reuse the `—` fallback the bottom panel already established for absent speed and absent last report. Delivery owns the fallback; the application keeps `undefined`.

### Accessibility

- Chips: `<button aria-pressed>`, not `<div onClick>`.
- Fleet toggle keeps `aria-expanded`.
- The row checkbox's accessible name becomes `"{plate} · {label}"` (or just the label when there is no plate) so existing regex-based test queries keep matching.
- Every interactive element gets `focus-visible:ring-2 focus-visible:ring-emerald-500/60`.

---

## Testing Strategy

| Layer | What to test | Approach |
|-------|-------------|----------|
| Domain | Every row of the resolution table | Table-driven, literal `nowMs` / `staleAfterMs` |
| Application | Narrowing, counts, provider list, fleet selection scope | Explicit clock and threshold per test |
| Delivery config | Default, valid override, invalid value | Set and restore `process.env` around each case |
| Hook | Set-toggle semantics, "Todos" clears | `renderHook` |
| Component | Row rendering, chip toggling, fleet counts, degraded rows | Testing Library, copy asserted via constants |
| Integration fixture | All three statuses and every degraded case are present | Resolve status over the port's output |

### The injected clock removes the need for fake timers

`resolveVehicleStatus` takes `nowMs` as an argument, so a test is a pure table of numbers — no `vi.useFakeTimers()`, no `vi.setSystemTime()`, no cleanup hooks, no interaction with any other test's timing.

```ts
// shape, not the test body
const NOW = Date.parse("2026-07-29T12:00:00.000Z");
resolveVehicleStatus({ telemetry, nowMs: NOW, staleAfterMs: 300_000 });
```

Boundary cases become trivially expressible because the elapsed time is arithmetic the test controls: exactly at the threshold, one millisecond past it, a `gpsAt` in the future, an unparsable `gpsAt`. Fake timers can express none of those without ceremony, and they leak across tests when a cleanup is missed.

The same argument holds one layer up: `buildLiveSidebarViewModel` tests pass a fixed `nowMs`, so "this vehicle went stale" is a fixture property, not a timing trick.

### Asserting Spanish copy without brittleness

**Rule: no test hardcodes a Spanish sentence.** Tests import the same record the component renders.

```ts
expect(screen.getByText(VEHICLE_STATUS_COPY["en-route"])).toBeInTheDocument();
expect(screen.getByRole("button", { name: VEHICLE_STATUS_COPY.stopped })).toBeInTheDocument();
```

Rewording then touches `live-copy.ts` and nothing else. This is the concrete migration for the existing English regexes in `live-screen.test.tsx` (`/select at least one vehicle to view its data/i` and friends), which are exactly the brittleness this avoids.

Where an element has no code-keyed text, query by **role and structure** rather than by words — `getByRole("searchbox")`, `getByRole("checkbox", { name: /Unit 101/i })`, `within(row).getByText("—")`. Component-local labels (D5) are not worth an assertion; the element's presence is what matters.

Exhaustiveness is a **compile-time** guarantee: `Record<Code, string>` fails `tsc --noEmit`, which the pipeline already runs, if a code has no copy. `live-copy.test.ts` only adds what the type cannot check — that no value is an empty string.

### Containing the test churn

The proposal flags this as a high-likelihood risk: `build-live-sidebar-view-model.test.ts` asserts whole nodes with `toEqual`, so every new field touches every assertion. Mitigation: convert behavioural assertions to `toMatchObject` on the fields under test, and keep exactly **one** full-shape `toEqual` test per view model, labelled as the contract-shape test. Behaviour tests then survive additive contract changes, and there is still one place that fails loudly when the shape changes unintentionally.

### The fixture test and its tolerance

Because `readLiveState()` materializes timestamps from `Date.now()` (D11), the fixture test reads through the port and resolves status with a `nowMs` captured immediately after. The few milliseconds of drift are irrelevant against a five-minute threshold and offsets chosen well clear of it (30 s and 9 min, not 4:59). The test asserts *at least one vehicle per status* plus the specific degraded cases, so the fixture cannot silently stop exercising a branch.

---

## Migration / Rollout

No data migration. Ordered as four work units so a regression is attributable, matching the proposal's rollback plan in reverse:

1. **Domain**: `online` optional, `resolveVehicleStatus`, its tests, doc update. Additive; nothing consumes it yet.
2. **Copy relocation**: strip `message` from four use cases, add `live-copy.ts`, update the map panel, bottom panel and existing tests. Independently revertible — it only swaps literals for codes.
3. **Contracts and builder**: new node fields, counts, status/provider narrowing, `nowMs`/`staleAfterMs` threading, config module, `.env.example`. `onlyActiveOrOnline` is removed end to end here; not independently revertible.
4. **Sidebar components**: the eight-component split plus the hook plus new component tests.

Unit 2 lands before unit 3 deliberately: doing both at once makes any copy regression look like a filter regression.

`SENTINEL_LIVE_STALE_AFTER_MS` is optional in every environment — absent means five minutes. No deployment is blocked on setting it.

---

## Known Problems Created by Fixed Decisions

These follow from decisions that are settled. The design implements them as decided; they are recorded so nobody discovers them as a surprise.

### 1. Making `online` optional weakens the type for every reader

Once `online?: boolean`, `!telemetry.online` silently means "offline **or** unknown" and TypeScript will not complain. The change exists to distinguish those two cases, and it makes the type less able to enforce the distinction everywhere else.

D3 is the mitigation: no view model carries `isOnline`, so nothing outside `domain/live/vehicle-status.ts` has a reason to read the field. **This is a convention, not an enforced invariant** — there is no lint rule for a property read. The practical check is that `\.online` should have exactly one hit outside fixtures and the domain module; a reviewer can verify it in one grep, and it should be re-verified whenever a new consumer of telemetry appears.

### 2. Provider-flag-wins produces a visible self-contradiction on screen

Fixture vehicle 2 is the case: the provider says `online: false` while sending a fresh position at 55 km/h. Before the offline-speed decision below, the sidebar would have rendered "Offline" right next to that same 55 km/h. **That half is now resolved**: an offline vehicle's node never exposes a speed at all (see the `live-operator-panels` delta), so the sidebar itself no longer contradicts its own badge.

The map half is not resolved. The same vehicle's marker still sits on the map with a heading and a speed, because the map filters by GPS validity, not by status — and whether an offline vehicle should still appear as a map marker at all was deliberately left undecided; see [Open Questions](#open-questions). This is the decided rule and it is the right default — the provider knows things we do not. But operators will report the map/sidebar disagreement as a bug, more than once. Two things follow: the map should eventually reflect status (out of scope here), and a provider that contradicts itself is a data-quality signal worth surfacing rather than hiding. Neither is implemented in this change.

### 3. The staleness rule is effectively dormant in production until polling exists

With `nowMs` captured at server render and no refresh, a vehicle that crosses the threshold while the operator watches keeps its old status until something re-renders the page. The rule is fully correct and fully tested; it just has almost nothing to do in a screen whose telemetry is equally frozen.

The tempting fix — a client-side ticker — is worse, and is explicitly rejected: it would decay vehicles to "offline" against telemetry that never changed, manufacturing a state transition the data does not support. The real fix is polling, and `nowMs` should then come from each fetch's response time. Until then, the honest statement is that this rule ships tested but largely unexercised at runtime.

### 4. Fleet counts will not add up to the visible rows

By D7, counts describe the full roster while the list is narrowed. A fleet header reading `12` above three visible rows looks wrong at first glance. The mitigation is to also show the visible count when `filters.isNarrowed`, which costs a second number in an already dense header. The alternative — counts that track the filter — was rejected because it makes the numbers carry no information precisely when a filter is active.

### 5. The copy module is a message catalogue pretending not to be one

D4 declines i18n and centralizes code-keyed copy in one Spanish-only module. That module *is* a single-locale message catalogue, with no locale metadata and no plural handling. If a second locale ever arrives, this is the migration point, and the migration will not be free — every record becomes a locale-keyed lookup and every consumer needs a locale in scope. Accepted deliberately; recorded so nobody mistakes the module for i18n readiness.

### 6. The screen will still show English words that this change does not own — RESOLVED (2026-07-29)

`readBottomPanelTabs()` returned `label` strings — `"Status"`, `"Speed (km/h)"`, `"Last event"` — rendered verbatim. They came from `integrations/`, not from a use case, so the success criterion *"no use case returns a user-facing sentence"* was satisfied while the screen stayed partly English. This was recorded as a known, deliberate gap; the user rejected leaving it.

The decision is the same code-only boundary already applied to empty states (D4): `LiveBottomPanelTab` and `LiveTableColumn` carry a stable `key` only, never a `label`. The port (`live-page-shell`) and the composed bottom-panel view model (`live-operator-panels`) both drop `label`; delivery resolves every tab and column label from its key through the same `Record<key, string>` shape as `VEHICLE_STATUS_COPY`. After this change the live screen is Spanish everywhere, including the bottom-panel tab and column headers — there is no remaining deliberate English gap.

---

## Open Questions

- **Bottom-panel tab and column labels.** Decided (2026-07-29): they become codes, same as every other screen string. No longer open — see Known Problem #6 (resolved) and the `live-page-shell` / `live-operator-panels` deltas.
- **Offline vehicles as map markers.** Whether a vehicle whose derived status is `offline` still appears as a map marker at its last known position is explicitly undecided. The offline-speed decision (2026-07-29) only governs the sidebar node's speed field; it says nothing about marker existence or visibility on the map. Not specified either way in this change.
- **Time zone.** `America/Argentina/Buenos_Aires` is hardcoded to keep SSR and hydration deterministic. Multi-tenant operation across time zones will need a per-tenant setting; the formatter constant is the seam.
- **Provider values.** `PRAXSYS` and `SENTINELPRO` are real providers with no adapter yet. `Device.provider` is rendered verbatim and uppercased for display, with no mapping table — deliberate, per the proposal. The canonical casing and identifier set are settled by the first adapter, not here.
- **Counts and multi-device vehicles.** `LiveVehicleState.device` is singular, so one vehicle carries at most one provider badge. If real data ever links two devices to one vehicle, both the badge and the provider filter need a decision. Flagged, not designed for.
