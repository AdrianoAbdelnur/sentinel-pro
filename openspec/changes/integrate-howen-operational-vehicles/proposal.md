# Proposal: Integrate Howen Operational Vehicles

## Intent

Render Howen's verified 621 vehicles and 119 fleets in `/live` with provider independence and partial availability.

## Scope

### In Scope
- Remove unused `Customer`, mandatory `customerId` from `Fleet`/`Vehicle`, and allow vehicles without a secondary label.
- Aggregate async sources; preserve successes and source warnings.
- Authenticate, normalize, and render one Howen snapshot.
- Use `devicename` as headline; never display `deviceno` or a secondary Howen label.
- Use the authorized account via gitignored configuration; forbid production demo fallback.

### Out of Scope
- Tenancy, customer ownership, or tenant-to-fleet relationships.
- Polling (`refresh-operational-live-snapshot`), playback, alarms, WebSockets, loops, and persisted sessions.

## Capabilities

### New Capabilities
- `operational-source-aggregation`: Merge independent source successes, retain source warnings, and forbid production demo fallback.
- `howen-operational-snapshot`: Authenticate and normalize the verified Howen roster.

### Modified Capabilities
- `live-core-contracts`: Remove unused `Customer` and mandatory `customerId` from `Fleet`/`Vehicle`; make the secondary vehicle label optional.
- `live-runtime-contracts`: Add reusable async source and aggregate-result contracts.
- `live-page-responsibilities`: Keep aggregation and partial-failure rules in application logic.
- `live-page-shell`: Render generic source warnings without provider payload knowledge.

## Approach

Each adapter returns an outcome; application logic merges successes and warnings. The composition root only wires sources.

Howen uses single-flight sessions and one bounded re-authentication. Verified mapping: `fleetid`/`fleetname` provide fleet identity/label; `deviceno` stays internal; `devicename` is the sole visible headline; `videoencodernumber` is channel count; `accessmode >= 1` is online. Valid location, motion, and `dtu` become telemetry. Zone-less timestamps use `America/Argentina/Buenos_Aires`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `domain/live/entities.ts` | Modified | Remove customer model; optional vehicle label |
| `application/live/*` | Modified/New | Async sources, aggregation, warnings |
| `integrations/howen/*` | New | Config, auth, client, validation, mapper |
| `app/live/*`, `components/live/*` | Modified | Wiring and generic warning delivery |
| `.env.local`, `.env.example` | Modified | Ignored secrets; documented names |
| `integrations/live/in-memory/*` | Modified | Development/test source only |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Timestamp shift | Medium | Test Buenos Aires conversion |
| Session failure | Medium | Retain token, pid, cookie; bounded retry |
| Roster growth | Medium | Observe the measured 2 MB request |

## Rollback Plan

Disable Howen wiring while retaining the aggregator; do not substitute demo data in production.

## Dependencies

- Howen connectivity and configuration.

## Success Criteria

- [ ] The verified snapshot normalizes 621 vehicles into 119 named fleets.
- [ ] A Howen failure preserves other source data and adds a generic Howen warning.
- [ ] Labels, identities, timestamps, session reuse, and no-fallback behavior are tested.
- [ ] UI contracts contain no raw Howen fields or errors.
