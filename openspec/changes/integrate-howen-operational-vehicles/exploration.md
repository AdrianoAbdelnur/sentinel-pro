## Exploration: Howen operational vehicle snapshot

### Current State
Sentinel Pro renders a provider-agnostic `LiveState` composed of fleets and normalized vehicle, device, and telemetry data. `app/live/page.tsx` is the composition root, but it currently reads a synchronous in-memory source. Its `LiveDataSource` contract also mixes the operational snapshot with unrelated bottom-panel fixtures.

A read-only query against the authorized Howen server verified the real boundary:

- `findAll.action` returned 621 records with unique `deviceno` values across 119 fleets.
- The response was about 2.0 MB and completed in about 370 ms.
- Every record contained `deviceno`, `devicename`, `fleetid`, `fleetname`, `accessmode`, and `videoencodernumber`.
- 617 records contained `dtu`, `speed`, and `direct`.
- Login uses the existing raw password, which the client hashes with MD5, and returns `token`, `pid`, and `JSESSIONID`.
- Howen timestamps have no zone offset and represent `America/Argentina/Buenos_Aires` local time.
- Visible plate-like labels such as `AA264KK` are stored in `devicename`; `plateno` was populated only once. `deviceno` is the technical external device ID.

The current domain `Customer` entity and the `customerId` fields on `Fleet` and `Vehicle` came from the reference project without an approved Sentinel Pro tenancy decision. Tenancy is deferred, so the active live core must not require those unused ownership contracts or invent values for them. Removing those premature requirements is a prerequisite; the future tenant-to-fleet relationship belongs to a separate change.

Operational providers must be aggregated independently. A failed Howen request must produce a Howen-specific warning without hiding successfully loaded Hikvision, Praxsys, or other source data. Production must never fall back silently to demo fixtures.

### Affected Areas
- `domain/live/entities.ts` — remove the unused `Customer` contract and premature `customerId` requirements from the active `Fleet` and `Vehicle` contracts; broader tenancy remains out of scope.
- `application/live/contracts.ts` — separate asynchronous operational loading from fixture-only bottom-panel data and represent independently successful and failed sources.
- `application/live/*` — aggregate normalized source results without making one provider's failure block the others.
- `integrations/howen/*` — add server-only configuration, authentication/session handling, response validation, mapping, and provider-error translation.
- `app/live/page.tsx` — compose the aggregator with the configured sources and pass normalized state plus source warnings to the delivery layer.
- `components/live/*` — render source-specific load warnings and omit a secondary vehicle label when none exists, without branching on provider names.
- `.env.local` — receive the authorized secure copy of the existing Howen server/account configuration and remain gitignored.
- `.env.example` — document variable names only, without secret values.
- `integrations/live/in-memory/*` — remain deterministic test/development data, never a production failure fallback.
- `openspec/changes/refresh-operational-live-snapshot/*` — own later automatic polling, overlap prevention, and stale-data behavior.

### Approaches
1. **Independent source adapters behind an application aggregator** — each provider returns its own normalized result; the application merges successes and preserves source-specific failures.
   - Pros: isolates providers, supports partial success, keeps Howen details out of UI, and gives polling a reusable boundary later.
   - Cons: requires explicit result and warning contracts in addition to the Howen adapter.
   - Effort: Medium

2. **Aggregate providers in the page composition root** — wire each adapter in `app/live/page.tsx` and merge results there.
   - Pros: fewer initial application files.
   - Cons: puts operational behavior in the delivery layer, makes partial-failure rules harder to reuse and test, and encourages page growth.
   - Effort: Medium

3. **Expose Howen through an internal Route Handler** — normalize Howen behind `/api/...` and call it from the live page.
   - Pros: creates an HTTP boundary that external consumers could reuse.
   - Cons: adds an unnecessary internal request for the initial Server Component path and risks moving orchestration into transport code.
   - Effort: Medium

### Recommendation
Use approach 1. Define a small asynchronous operational-source contract, implement it for Howen, and add an application-level aggregator that combines independent source outcomes. The composition root only chooses and wires configured adapters.

Map the verified Howen payload as follows:

- `fleetid` is the stable fleet identity and `fleetname` is its visible label.
- `deviceno` is the stable technical external device identity and remains internal.
- `devicename` is the visible vehicle plate/headline.
- The secondary vehicle label is optional. Howen provides only the visible `devicename` headline for this purpose, and `deviceno` must not be displayed.
- `videoencodernumber` becomes channel count.
- `accessmode >= 1` means online.
- Valid coordinates, speed, direction, and `dtu` become normalized telemetry.
- Zone-less Howen timestamps are interpreted in `America/Argentina/Buenos_Aires` and converted to the internal timestamp format.
- Invalid optional values become `undefined`, never `NaN`; unusable device identities follow an explicit tested rejection rule.

The Howen adapter should authenticate server-side, hash the raw configured password with MD5 as required by the provider, retain `token`, `pid`, and `JSESSIONID`, reuse a request-driven in-memory session with single-flight login, and allow one bounded re-authentication attempt for an expired session. Configuration will use the same server/account as `Example-sentinel`, copied securely into gitignored `.env.local`.

This slice loads the snapshot once when `/live` is rendered. Automatic refresh remains in `refresh-operational-live-snapshot`. Playback, alarms, WebSocket updates, background loops, persisted sessions, and tenancy are out of scope.

Tests should cover the mapper, Buenos Aires timestamp interpretation, authentication/session reuse, one bounded re-authentication, provider-error translation, independent source aggregation, partial-success warnings, no demo fallback, and composition-root wiring. UI tests must not know Howen field names.

### Risks
- Howen's zone-less timestamps require disciplined Buenos Aires interpretation; treating them as UTC would shift telemetry time.
- The 2.0 MB all-device response is acceptable in the measured request but must remain observable as the fleet grows.
- Session handling needs both token fields and `JSESSIONID`; incomplete reuse may cause intermittent authorization failures.
- Partial-success behavior requires warnings to be associated with source identity without exposing provider payloads or error codes.
- Removing the unused `Customer` and `customerId` requirements from the active live core must stay narrowly scoped; designing tenancy now would expand this change incorrectly.
- `devicename` is operationally the plate/headline despite its generic provider field name; using the mostly empty `plateno` would hide nearly every vehicle label.

### Ready for Proposal
Yes. The proposal should commit to the independent-source aggregator, verified Howen mapping, source-specific partial-failure warnings, secure server-only configuration, and the narrow vehicle-contract prerequisite. It must explicitly defer polling to `refresh-operational-live-snapshot` and defer all tenancy design.
