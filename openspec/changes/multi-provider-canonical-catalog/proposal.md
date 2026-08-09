# Proposal: Multi-provider canonical catalog

## Intent

Replace provider-owned rosters with a Sentinel-owned organization, fleet, and vehicle catalog. One asset needs one identity across external sources and native creation. Source selection must vary by capability without leaking provider rules into UI.

## Scope

### In Scope
- Organization-scoped fleets and vehicles with admin-only creation.
- Scoped external identities, deterministic linking, and ambiguous-match review.
- Idempotent Howen roster import using verified fields only.
- Per-capability precedence at organization, fleet, and vehicle levels with ordered fallback.
- Cybermapa port and default policy contracts: Cybermapa for GPS/operational alerts; Howen for video/video alerts.

### Out of Scope
- Cybermapa adapter/import until `GETVEHICULOS` is verifiable.
- Ruptela/Rinho ingestion, telemetry projections, raw payload retention, automatic ambiguous merges, and broad live migration.

## Capabilities

### New Capabilities
- `canonical-vehicle-catalog`: Tenant-isolated Sentinel ownership and native fleet/vehicle creation.
- `external-identity-linking`: Scoped identities, deterministic linking, and ambiguous-match review.
- `howen-catalog-import`: Verified, idempotent Howen roster ingestion into canonical records and links.
- `capability-source-precedence`: Capability-specific policy inheritance, defaults, overrides, and ordered fallback.

### Modified Capabilities
- `live-core-contracts`: Live business identity becomes canonical while multiple provider links may contribute capabilities.

## Approach

Reuse authenticated organizations as ownership boundaries. Add catalog models/use cases, MongoDB repositories with scoped uniqueness, a Howen import adapter, and thin admin delivery. Resolve policy from vehicle to fleet to organization to system default. Synchronization never silently renames fleets, moves vehicles, or merges ambiguity.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `domain/catalog`, `application/catalog` | New | Canonical rules, ports, and use cases |
| `integrations/persistence/mongodb` | Modified | Catalog persistence and constraints |
| `integrations/howen` | Modified | Import candidate adapter |
| `app/admin`, `app/api/admin` | Modified | Authorized catalog workflows |
| `domain/live`, `application/live` | Modified | Canonical identity contract |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| False vehicle merge | High | Auto-link deterministic identities only; persist ambiguity |
| Duplicate concurrent imports | Medium | Scoped unique indexes and atomic idempotent writes |
| Incorrect fallback | Medium | Pure policy resolver with exhaustive tests |

## Rollback Plan

Disable new routes/import jobs, redeploy the previous revision, and retain existing Howen live composition. Snapshot catalog collections before removing indexes or data; identity collections remain unchanged.

## Dependencies

- Merged authentication/tenant authorization foundation.
- Verified Howen roster client and mapper.

## Success Criteria

- [ ] Admins create tenant-isolated fleets/vehicles without provider data.
- [ ] Repeated Howen imports create no duplicates; ambiguous candidates remain unmerged for review.
- [ ] Capability resolution honors vehicle, fleet, organization, defaults, and fallback order.
- [ ] Cybermapa remains limited to contracts/default policy.
- [ ] Quality gates pass.
