# Proposal: Multi-provider canonical catalog

## Intent

Create `Identity Organization -> Catalog Company -> Fleet -> Vehicle` as a reconciled canonical catalog.

## Scope

### In Scope
- Tenant hierarchy, native assets, and `Unassigned`.
- Explicit Company/Fleet binding, matching, review, and union membership.
- Cybermapa-first/Howen initial full imports, six-hour reconciliation, and admin `Sync now`.
- Vehicle-to-system capability precedence and canonical live projection with fallback.

### Out of Scope
- Ruptela/Rinho adapters, raw telemetry expansion, inferred identity records, and UI provider branches.

## Capabilities

### New Capabilities
- `canonical-vehicle-catalog`: Canonical hierarchy, native assets, and `Unassigned`.
- `provider-company-binding`: Connection-scoped company binding.
- `provider-fleet-binding`: Many verified Fleet identities bind one union Fleet without name inference.
- `external-identity-linking`: Company-scoped vehicle identities, guarded plate matching, and review.
- `cybermapa-catalog-import`: Observed GETVEHICULOS ingestion using scoped `gps_id`.
- `howen-catalog-import`: Verified Howen ingestion.
- `catalog-synchronization`: Initial, six-hour/manual sync, exclusion, idempotency, freshness skip, isolation, and safe absence.
- `capability-source-precedence`: Per-capability hierarchical policy and fallback.

### Modified Capabilities
- `live-core-contracts`: Live uses canonical hierarchy and independently resolved sources.

## Approach

Organization remains the auth tenant. Admins bind external companies. Scoped identity wins; otherwise exact plate links one safe Company match, zero creates in `Unassigned`, and ambiguity/conflict enters review. Names/aliases never link.

Fleet membership unions linked rosters. Fleet identities bind through deterministic reuse or admin review, never names. Later identities enrich Vehicles. Provider absence affects only its presence/capabilities, never canonical existence or placement.

Cybermapa composes first while provider-only/native Vehicles remain. GETVEHICULOS has no Fleet identity, so Vehicles use `Unassigned` or admin placement. Policy resolves Vehicle, Fleet, Company, tenant, system.

One provider-neutral use case runs initial, scheduled, and admin synchronization. It allows one active connection run; triggers are idempotent. Scheduled runs may skip success within six hours. Only complete successful snapshots reconcile omissions; failures are isolated and retryable.

## Affected Areas

| Area | Impact |
|---|---|
| `domain/catalog`, `application/catalog` | Rules and synchronization |
| `integrations/*` | Provider adapters and persistence |
| `app/admin`, `app/api`, `domain/live`, `application/live` | Triggers, UI, projection |

## Risks

| Risk | Mitigation |
|---|---|
| Identity/name conflation | Scoped contracts; explicit binding |
| Partial snapshots remove availability | Success-only reconciliation |
| Concurrent runs/provider failure | Atomic claim; idempotency; isolation |

## Rollback Plan

Disable scheduling/import routes and restore Howen live composition; retain catalog data and placement.

## Dependencies

- Tenant authorization, scheduler entrypoint, and operational Cybermapa/Howen clients.

## Success Criteria

- [ ] Imports create no identity organizations or memberships.
- [ ] Fleet union and source loss preserve canonical assets.
- [ ] Initial, six-hour, and manual sync share idempotent behavior.
- [ ] Failed/partial snapshots never reconcile absence.
- [ ] Matching, precedence, projection, and rollback pass quality gates.
