# Design: Consolidate the Canonical Catalog

## Technical Approach

Promote the tested `catalog-global` implementation to the definitive `catalog` module through git-aware renames and dependency retargeting. Preserve active matching, placement, review, synchronization, lease, checkpoint, snapshot, access, and capability-selection behavior. Import and Live will depend on the same canonical application contracts and MongoDB repositories. Remove the parallel organization-owned and versioned stacks only after regression tests protect the retained behavior.

This is consolidation over an empty database. It adds no catalog capability, data transformation, compatibility path, `CatalogItem`, review case, matching rule, or provider behavior.

## Architecture Decisions

| Decision | Rejected alternative | Rationale |
|---|---|---|
| Rename `catalog-global` to `catalog` and keep its behavior | Reimplement a third catalog model | The active global slice already owns the required tested behavior; rebuilding it would add risk and volume. |
| Use one canonical model for import, persistence, review, and Live | Keep separate organization-owned and global models | One dependency path prevents divergent identity, placement, and visibility rules. |
| Keep checkpoint-based retry; remove unused item contracts | Implement `CatalogItem` and `catalog_items` | Current synchronization already persists resumable progress without per-candidate items. |
| Retarget the existing manual review flow only | Add review subjects, audit fields, or resolution behavior | Consolidation must preserve active behavior rather than create features. |
| Initialize only definitive unversioned collections | Read or populate old/versioned collections | MongoDB is empty, so no conversion, backfill, dual read, or cutover is needed. |

## Definitive Model and Persistence

| Collection | Canonical contract |
|---|---|
| `organizations`, `users`, `organization_memberships` | Global users and organization-scoped active roles. |
| `providers`, `provider_connections` | Platform-owned provider definitions and connections. |
| `catalog_groups`, `catalog_vehicles` | Sentinel-owned canonical grouping and physical vehicle identity. |
| `provider_contributions` | Provider identity unique by `(connectionId, externalId)`; many contributions may reference one vehicle. |
| `provider_fleet_memberships`, `group_evidence_bindings` | Provider fleet metadata and stable placement evidence; neither owns canonical grouping. |
| `organization_vehicle_access` | Organization disclosure grants unique by `(organizationId, vehicleId)`. |
| `capability_policies` | Platform-owned, provider-neutral source precedence per capability. |
| `catalog_reviews` | Existing pending and resolved manual decisions retargeted to canonical vehicles and groups. |
| `catalog_runs`, `catalog_leases` | Existing attempt, lineage, checkpoint, snapshot, retry, and connection lease state. |

## Data Flow

    provider adapter -> canonical candidate -> catalog synchronization -> canonical MongoDB repositories
                                                                  |
    membership + vehicle grants -> canonical catalog projection --+-> capability policy -> Live

Import keeps contribution-first identity, exact safe plate matching, authoritative/fallback group evidence, existing manual exceptions, checkpoint resume, renewable connection leases, and safe absence reconciliation. Live reads the resulting catalog projection, filters it through active organization membership and vehicle grants, projects `CatalogGroup` as the provider-neutral fleet, and resolves each capability independently. Provider rosters and provider fleet labels never become Live ownership.

## Target File Changes

| Path | Later action |
|---|---|
| `domain/catalog-global/**` -> `domain/catalog/**` | Rename retained entities, value objects, and ports; delete the displaced organization-owned catalog files. |
| `application/catalog-global/**` -> `application/catalog/**` | Rename and retarget existing matching, review, synchronization, access, and projection use cases without changing rules. |
| `integrations/persistence/mongodb/catalog-global-*` -> canonical catalog repository names | Rename repositories and collection constants; initialize only definitive collections. |
| `integrations/catalog/**` | Retain adapter normalization and evidence behavior; update imports and contract names only. |
| `app/api/admin/import/**`, `app/api/admin/catalog/**`, `app/api/internal/catalog/synchronize/**` | Compose the retained canonical use cases under definitive unversioned routes and existing authorization boundaries. |
| `application/live/**`, `app/live/**` | Replace direct provider roster loading with the organization-filtered canonical projection; keep the Live output contract. |
| Parallel catalog repositories, versioned routes, Company binding, compatibility loader, conversion/backfill code, and unused item contracts | Delete after imports and tests are retargeted. |

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Unit | Matching, placement, review, checkpoint, lease, snapshot, access, capability policy | Run existing tests against renamed modules; change assertions only for definitive names. |
| Integration | Import and MongoDB repository composition | Characterize current behavior before removal, then prove only definitive collections and contracts are used. |
| Regression | Live catalog projection | Prove import-created canonical vehicles are filtered by organization grants and rendered under canonical groups without provider-roster reads. |
| Validation | Repository and SDD integrity | Run lint, typecheck, full Vitest suite, build, and strict OpenSpec validation. |

## Rollout

No data migration is required. Start the empty database with the definitive schema and deploy one runtime path without flags or parallel reads.

## Open Questions

None.
