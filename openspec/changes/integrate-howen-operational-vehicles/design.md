# Design: Aggregate Howen Operational Vehicles

## Technical Approach

`/live` will ask an application use case to load configured operational sources independently. It merges successful `LiveState` snapshots and converts failures into source-labelled warnings. A server-only Howen adapter supplies one source. Production never substitutes demo fixtures. Polling remains deferred to `refresh-operational-live-snapshot`.

## Architecture Decisions

| Decision | Alternatives | Rationale |
|---|---|---|
| Define one async port per source plus `aggregateOperationalSources` | One selected source or page-level merging | The application owns partial availability; delivery only wires sources. |
| Return merged state and warnings even when every source fails | Throw or all-or-nothing result | Successful sources survive independently; total failure is an empty state with all warnings. |
| Give each source stable `id` and operator-facing `label` | Infer identity from provider payloads | Warnings identify the failed connection without exposing raw errors. |
| Remove unused `Customer` plus `customerId` from `Fleet` and `Vehicle`; make the secondary label optional | Preserve tenancy placeholders or duplicate the plate | Tenancy is unapproved. Howen provides only the required headline. |
| Keep Howen infrastructure server-only | Browser access or disk sessions | Credentials and sessions never cross the RSC boundary. |
| Cache one process-local session and one shared login promise; retry once after `10004`/`10023` | Timers or unbounded retries | Prevents login storms and loops. The session retains `token`, `pid`, and `JSESSIONID`. |
| Validate envelopes and records before mapping | Cast JSON or parse in UI | Invalid `deviceno` rejects only that record; complete-roster requests use `pageNum: -1`, `pageCount: -1`. |
| Use namespaced IDs seeded by verified provider IDs | Raw or generated IDs | `howen:fleet:<fleetid>`, `howen:vehicle:<deviceno>`, and `howen:device:<deviceno>` are stable and collision-resistant. |
| Map only verified meanings | Legacy aliases and inferred labels | `fleetname` labels `fleetid`; `devicename` becomes the `Vehicle.plate` headline; `deviceno` seeds internal IDs and `Device.externalId` but stays hidden from delivery; no secondary Howen label. Channel count, `accessmode >= 1`, finite coordinates, speed, and direction map directly. |
| Parse zone-less `dtu` as `America/Argentina/Buenos_Aires` before ISO conversion | Treat as UTC or omit | The authorized server confirmed this timezone; explicit conversion prevents a three-hour shift. |
| Configure sources explicitly; allow memory only when explicitly selected outside production | Failure fallback to fixtures | Production failures stay visible and honest. |

## Data Flow

```text
app/live/page.tsx -> configured OperationalSource[]
                         |
                 aggregateOperationalSources
                   / success       \ failure
              merge LiveState    source warning
                         \         /
                    LiveScreen(state, warnings)
```

Howen's path is `env -> config -> MD5(password) -> login -> session -> findAll -> validation -> mapper`. Neutral failure categories are reduced to `source-unavailable` warnings.

## File Changes

| File | Action | Description |
|---|---|---|
| `domain/live/entities.ts`, exports, and affected tests/fixtures | Modify | Remove unused `Customer`, both `customerId` fields, and permit an absent secondary vehicle label. |
| `application/live/contracts.ts`, `aggregate-operational-sources.ts`, `index.ts` | Modify/Create | Add source, result, warning, aggregate contracts and independent merge use case. |
| `integrations/howen/config.ts`, `session.ts`, `client.ts`, `responses.ts`, `map-howen-roster.ts`, `parse-howen-timestamp.ts`, `howen-operational-source.ts` | Create | Server-only config, MD5 login, session reuse, validation, mapping, timezone conversion, failure translation. |
| `integrations/live/in-memory/in-memory-live-data-source.ts` | Modify | Separate async fixture source from bottom-panel fixtures; allow explicit development/test use only. |
| `app/live/live-runtime-config.ts`, `create-operational-sources.ts`, `page.tsx` | Modify/Create | Read enabled sources, validate Howen config, wire sources, aggregate once. |
| `components/live/live-screen.tsx`, `live-source-warnings.tsx`, `live-copy.ts`, sidebar presenters | Modify/Create | Render generic warnings and omit absent secondary labels without provider branching. |
| `.env.local`, `.env.example`, `docs/architecture/03-live-core-domain.md`, `05-live-application-responsibilities.md`, `06-live-delivery-layer.md` | Modify | Secure authorized config and document the narrow pre-tenancy cleanup, source contracts, and composition. |

## Interfaces / Contracts

```ts
type OperationalSource = {
  identity: { id: string; label: string };
  loadSnapshot(): Promise<OperationalSourceResult>;
};

type OperationalSourceResult =
  | { kind: "success"; state: LiveState }
  | { kind: "failure"; code: OperationalSourceFailureCode };

type OperationalSnapshot = {
  state: LiveState;
  warnings: { code: "source-unavailable"; sourceId: string; sourceLabel: string }[];
};
```

## Testing Strategy

| Layer | Coverage |
|---|---|
| Domain/application | Removal of `Customer` and both ownership fields, optional label, merging, failures, warnings, collisions, no fixture fallback. |
| Howen unit | Verified fields, 621/119 fixture shape, invalid identities/options, Buenos Aires conversion, stable IDs, no secondary label. |
| Howen integration | MD5 login, token/pid/cookie retention, single-flight login, all-device request, one expiry retry, translated failures with mocked `fetch`. |
| Delivery | Explicit source composition, partial/total warnings, successful roster retained, technical IDs absent from visible labels. |

Apply follows RED-GREEN-REFACTOR and must reread relevant Next.js 16 local docs before framework-sensitive changes.

## Migration / Rollout

No data migration. Copy the authorized Example-sentinel account into gitignored `.env.local`; `.env.example` contains names only. Enable Howen, verify 621 vehicles/119 fleets, then deploy. Roll back by disabling Howen while retaining other sources; never use memory in production.

## Open Questions

None.
