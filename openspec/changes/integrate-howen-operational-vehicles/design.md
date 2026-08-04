# Design: Aggregate Howen Operational Vehicles

## Technical Approach

`/live` will ask an application use case to load configured operational sources independently. It merges successful `LiveState` snapshots and converts failures into source-labelled warnings. A server-only Howen adapter supplies one source. Production never substitutes demo fixtures. Polling remains deferred to `refresh-operational-live-snapshot`.

## Architecture Decisions

| Decision | Alternatives | Rationale |
|---|---|---|
| Define one async port per source plus `aggregateOperationalSources` | One selected source or page-level merging | The application owns partial availability; delivery only wires sources. |
| Return merged state and warnings even when every source fails | Throw or all-or-nothing result | Successful sources survive independently; total failure is an empty state with all warnings. |
| Give each source stable `id` and operator-facing `label` | Infer identity from provider payloads | Warnings identify the failed connection without exposing raw errors. |
| Reject a source atomically on any fleet, vehicle, or device ID collision | Partially merge or overwrite | Configured order is deterministic: earlier accepted sources remain, the colliding source leaks no data, and one generic warning identifies it. The same rule covers duplicates inside one candidate state. |
| Remove unused `Customer` plus `customerId` from `Fleet` and `Vehicle`; make the secondary label optional | Preserve tenancy placeholders or duplicate the plate | Tenancy is unapproved. Howen provides only the required headline. |
| Keep Howen infrastructure server-only | Browser access or disk sessions | Credentials and sessions never cross the RSC boundary. |
| Cache one activity-aware process-local session and one shared login promise; retry once after `10004`/`10023` | Timers, fixed absolute expiry, disk persistence, or unbounded retries | Howen documents expiry after 30 minutes without interface interaction. Successful authenticated calls refresh local activity; the next request renews after a conservative inactivity threshold. This prevents login storms and loops while retaining `token`, `pid`, and `JSESSIONID`. |
| Validate envelopes and records before mapping | Cast JSON or parse in UI | Invalid `deviceno` rejects only that record; complete-roster requests use `pageNum: -1`, `pageCount: -1`. |
| Use namespaced IDs seeded by verified provider IDs | Raw or generated IDs | `howen:fleet:<fleetid>`, `howen:vehicle:<deviceno>`, and `howen:device:<deviceno>` are stable and collision-resistant. |
| Map only verified meanings | Legacy aliases and inferred labels | `fleetname` labels `fleetid`; `devicename` becomes the `Vehicle.plate` headline; `deviceno` seeds internal IDs and `Device.externalId` but stays hidden from delivery; no secondary Howen label. Channel count, `accessmode >= 1`, finite coordinates, speed, and direction map directly. |
| Parse zone-less `dtu` as `America/Argentina/Buenos_Aires` before ISO conversion | Treat as UTC or omit | The authorized server confirmed this timezone; explicit conversion prevents a three-hour shift. |
| Compose Howen plus memory automatically only in local development | Production fixtures or failure fallback | Local development can compare real and hardcoded data; production failures stay visible and honest. |
| Use `HOWEN` as the canonical provider value and source label | Lowercase storage plus CSS uppercase | Filters, badges, real records, demo Howen records, and warnings share one identity. |
| Reuse one lazily created Howen source per server process | Recreate session/client on every request | Page requests share the Phase 4 session lifecycle and avoid needless logins. |

## Data Flow

```text
app/live/page.tsx -> environment-selected OperationalSource[]
                         |
                 aggregateOperationalSources
                   / success       \ failure
              merge LiveState    source warning
                         \         /
                    LiveScreen(state, warnings)
```

Development selects Howen plus development memory. Production selects Howen
only. Bottom-panel fixture tabs and rows are development-only.

Howen's path is `env -> config -> MD5(password) -> login -> session -> findAll -> validation -> mapper`. The login is single-flight. Normal successful authenticated requests update session activity; no timer runs. After conservative inactivity, the next request obtains a new session. Provider codes `10004` (not logged in) and `10023` (access-token error) invalidate the session and permit exactly one re-login and retry. Neutral failure categories are reduced to `source-unavailable` warnings.

## Testing Strategy

| Layer | Coverage |
|---|---|
| Domain/application | Removal of `Customer` and both ownership fields, optional label, merging, failures, warnings, collisions, no fixture fallback. |
| Howen unit | Verified fields, 621/119 fixture shape, invalid identities/options, Buenos Aires conversion, stable IDs, no secondary label. |
| Howen integration | MD5 login, token/pid/cookie retention, single-flight login, all-device request, one expiry retry, translated failures with mocked `fetch`. |
| Delivery | Explicit source composition, partial/total warnings, successful roster retained, technical IDs absent from visible labels. |

Apply follows RED-GREEN-REFACTOR and must reread relevant Next.js 16 local docs before framework-sensitive changes.

## Migration / Rollout

No data migration. Copy the authorized Example-sentinel account into gitignored `.env.local`; `.env.example` contains names only. Local development renders Howen and memory together. Verify the complete current roster, then deploy. Production contains only real sources. Roll back by removing Howen composition while retaining the aggregator; never use memory in production.
