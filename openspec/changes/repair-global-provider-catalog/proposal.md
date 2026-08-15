# Proposal: Repair Global Provider Catalog

## Intent

Separate global vehicle identity, provider contributions, and tenant access. This supersedes tenant/Company-scoped ingestion and matching that made Howen create duplicates.

## Scope

### In Scope
- SUPER ADMIN global ingestion, configuration/review, and manual/initial runs; tenant access follows later.
- Provider-neutral identity, provider memberships/capabilities, and Sentinel placement.
- Recurring sync and approval-gated migration with dry run.

### Out of Scope
- New adapters beyond Cybermapa and Howen.
- Merging ambiguous or invalid plates.
- Tenant-driven identity, placement, or source policy.

## Capabilities

### New Capabilities
- `global-provider-registry`: Register providers, capabilities, credentials, and schedules without core/UI branches.
- `tenant-catalog-access`: Assign visibility without affecting identity.
- `global-catalog-migration`: Report, approve, and migrate records safely.

### Modified Capabilities
- `canonical-vehicle-catalog`: Make identity and Sentinel placement global.
- `external-identity-linking`: Replace Company-scoped matching with guarded global plate matching.
- `provider-company-binding` and `provider-fleet-binding`: Replace ownership with independent contributions and memberships.
- `cybermapa-catalog-import` and `howen-catalog-import`: Cybermapa seeds today's rollout; matching Howen plates add video without moving vehicles; Howen-only vehicles inherit Howen placement.
- `capability-source-precedence`: Configure source order; defaults are Cybermapa GPS and Howen video; direct GPS and future providers remain valid.
- `catalog-synchronization`: Synchronize global connections automatically; SUPER ADMIN retains manual controls.
- `live-core-contracts`: Resolve global sources, then filter by tenant assignments.

## Approach

Add global catalog and provider-contribution boundaries while preserving adapters and sync safeguards. Reuse external identity first; otherwise link one trustworthy exact global normalized-plate match. Missing, ambiguous, or conflicting evidence requires SUPER ADMIN review. Provider fleet names never establish identity; later providers never change Sentinel placement. Cut over after dry-run parity and grant validation.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `domain/catalog`, `application/catalog` | Modified | Identity, placement, matching |
| `integrations/*`, MongoDB | Modified | Contributions and indexes |
| `domain/identity`, `app/api/*` | Modified | SUPER ADMIN and scheduler |
| `application/live` | Modified | Projection and tenant filtering |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Dirty-plate merges | High | Validated exact evidence; review ambiguity |
| Visibility regression | Medium | Verify grants before cutover |
| Migration regression | High | Small slices, dry-run, versioned cutover |

## Rollback Plan

Disable new scheduling/reads and restore legacy reads; retain originals until approval.

## Dependencies

- SUPER ADMIN identity, scheduler configuration, and validated Howen plate extraction.

## Success Criteria

- [ ] A shared plate produces one vehicle with independent capabilities and unchanged placement.
- [ ] Provider fleets, tenants, and Companies never establish identity.
- [ ] Manual/scheduled runs are idempotent; a future provider needs only registration, configuration, and an adapter.
- [ ] Migration writes require an approved dry run with conflicts isolated.
