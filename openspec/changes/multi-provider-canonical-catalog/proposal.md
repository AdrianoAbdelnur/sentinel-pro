# Proposal: Multi-provider canonical catalog

## Intent

Create `Identity Organization -> Catalog Company -> Fleet -> Vehicle` and compose partial provider rosters without provider leakage.

## Scope

### In Scope
- Tenant-owned Companies, fleets, vehicles, native creation, and `Unassigned`.
- Tenant connections with explicit Company/external-fleet bindings.
- Cybermapa-first/Howen imports, guarded matching, review, and resumable idempotency.
- Union Fleet membership and Vehicle-to-system capability precedence.
- Canonical live projection with fallback.

### Out of Scope
- Ruptela/Rinho adapters, raw telemetry expansion, inferred identity records, and UI provider branches.

## Capabilities

### New Capabilities
- `canonical-vehicle-catalog`: Companies, fleets, vehicles, native assets, and `Unassigned`.
- `provider-company-binding`: Connection-scoped company candidates admin-bound.
- `provider-fleet-binding`: Many verified external fleet identities bind one Fleet; partial rosters form a union without name inference.
- `external-identity-linking`: Company-scoped vehicle identities, guarded plate matching, and review.
- `cybermapa-catalog-import`: Observed GETVEHICULOS ingestion using scoped `gps_id`.
- `howen-catalog-import`: Verified Howen ingestion without canonical ownership.
- `capability-source-precedence`: Per-capability hierarchical policy and ordered fallback.

### Modified Capabilities
- `live-core-contracts`: Live uses canonical hierarchy and independently resolved sources.

## Approach

Organization remains the auth tenant. Admins bind external company candidates to Companies. Existing scoped vehicle identity wins; otherwise exact plate links one safe active Company match, zero matches create in `Unassigned`, and ambiguity/conflict enters review. Names/aliases never auto-link.

Fleet membership unions safely linked provider rosters. Multiple verified external fleet identities bind one Fleet only through deterministic identity or admin review; names never bind. Later source identities attach to existing Vehicles. Partial Howen coverage adds video only where linked. Provider absence affects only its capability, never canonical existence.

Cybermapa composes first; Howen-only, other-provider-only, and native Vehicles remain. GETVEHICULOS has no trustworthy fleet identity, so it creates no Fleet: Vehicles use `Unassigned` or admin placement. Policy resolves Vehicle, Fleet, Company, tenant, then system.

## Affected Areas

| Area | Impact |
|---|---|
| `domain/catalog`, `application/catalog` | Catalog rules/use cases |
| `integrations/*` | Provider adapters and persistence |
| `app/admin`, `app/api/admin`, `domain/live`, `application/live` | Delivery/projection |

## Risks

| Risk | Mitigation |
|---|---|
| Tenant/Company or fleet/name conflation | Scoped contracts; explicit binding |
| Partial rosters hide/delete assets | Union semantics; source-local availability |
| Duplicate matches/import races | Review, uniqueness, resumable transactions |

## Rollback Plan

Disable imports/routes and restore Howen live composition; retain catalog data and placement.

## Dependencies

- Tenant authorization and operational Cybermapa/Howen clients.

## Success Criteria

- [ ] Imports create no identity organizations, users, or memberships.
- [ ] External fleet bindings compose union membership without name auto-binding.
- [ ] Provider loss preserves canonical assets and unrelated capabilities.
- [ ] Cybermapa uses `Unassigned`/admin placement; Howen/native-only Vehicles remain.
- [ ] Matching, precedence, projection, and rollback pass quality gates.
