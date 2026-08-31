# Proposal: Consolidate the Canonical Catalog

## Intent

Converge Sentinel Pro on the tested global catalog behavior using definitive names and collections. MongoDB starts empty, so this is structural cleanup and dependency retargeting, not migration or feature development.

## Scope

### In Scope
- Rename the active global catalog model and collections without changing behavior.
- Retarget import, manual review, persistence, and Live to one canonical model.
- Preserve active matching, group evidence, runs, checkpoints, leases, snapshot safeguards, organization access, and provider-neutral capability resolution.
- Remove unused or parallel contracts from the final product boundary.

### Out of Scope
- Code or database changes in this SDD phase.
- Data migration, backfill, dual operation, compatibility reads, or versioned product contracts.
- Durable import items, new review cases/audit fields, new matching rules, or new provider behavior.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `canonical-vehicle-catalog`: definitive vehicle, group, contribution, and collection vocabulary.
- `external-identity-linking`: retain active global matching and manual review behavior.
- `provider-fleet-binding`: retain external fleet metadata and group evidence behavior.
- `catalog-synchronization`: retain active runs, lineages, checkpoints, leases, retries, and safe absence reconciliation; exclude unused import items.
- `tenant-catalog-access`: definitive organization membership and vehicle-access vocabulary.
- `global-provider-registry`: definitive platform-owned provider and connection names.
- `capability-source-precedence`: retain provider-neutral per-capability source ordering.
- `cybermapa-catalog-import`, `howen-catalog-import`: retain verified adapter evidence and capabilities.
- `live-core-contracts`: use the same canonical projection as import.
- `provider-company-binding`: remove the parallel Company ownership model.
- `global-catalog-migration`: remove the unused migration capability.

## Approach

Promote the active global implementation by mechanical rename and retargeting. Keep contribution-first matching, exact safe plate matching, authoritative/fallback group evidence, manual exception review, checkpoint resume, runs, leases, and safe snapshots unchanged. Project canonical groups as Live fleets and filter vehicles by organization access. Remove unused item persistence rather than implementing it.

## Risks

- Mechanical renames can leave hidden imports or collection initializers; acceptance tests must prove a single end-to-end model.
- Live currently uses a direct provider roster; retargeting must preserve its provider-neutral output contract.

## Rollback Plan

Revert this unimplemented SDD change. No runtime or data rollback is required.

## Success Criteria

- [ ] One definitive model is used by import, persistence, review, and Live.
- [ ] No unused item contract or parallel catalog behavior remains in the target.
- [ ] No data migration or compatibility behavior is required.
- [ ] Acceptance criteria are testable and OpenSpec validation passes.
