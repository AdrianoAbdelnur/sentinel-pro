# Design: Consolidate the Canonical Catalog

## Technical Approach

Keep the tested `catalog-global` implementation stable while consumers converge on it. First retarget administration and reviews, then synchronization and adapters, then Live, validating tests and typecheck after each boundary. Once the organization-owned catalog has no runtime or test consumers, delete it. Only then rename `catalog-global` to the definitive `catalog` module and remove `_v2` collection constants and versioned route names through git-aware mechanical renames.

Preserve active matching, placement, review, synchronization, lease, checkpoint, snapshot, access, and capability selection. Over an empty database, this adds no capability, data transformation, compatibility path, transitional facade, `CatalogItem`, review case, matching rule, or provider behavior.

## Architecture Decisions

| Decision | Rejected alternative | Rationale |
|---|---|---|
| Converge consumers before renaming `catalog-global` | Rename the module while incompatible `domain/catalog` and `application/catalog` APIs still exist | Retargeting one boundary at a time keeps the working implementation stable and prevents repository-wide breakage. |
| Use one canonical model for import, persistence, review, and Live | Keep separate organization-owned and global models | One dependency path prevents divergent identity, placement, and visibility rules. |
| Keep checkpoint-based retry; remove unused item contracts | Implement `CatalogItem` and `catalog_items` | Current synchronization already persists resumable progress without per-candidate items. |
| Retarget the existing manual review flow only | Add review subjects, audit fields, or resolution behavior | Consolidation must preserve active behavior rather than create features. |
| Initialize only definitive unversioned collections | Read or populate old/versioned collections | MongoDB is empty, so no conversion, backfill, dual read, or cutover is needed. |

## Definitive Model and Persistence

| Collection | Canonical contract |
|---|---|
| `organizations`, `users`, `organization_memberships` | Global users and active organization roles. |
| `providers`, `provider_connections` | Platform-owned provider definitions and connections. |
| `catalog_groups`, `catalog_vehicles` | Sentinel-owned canonical grouping and physical vehicle identity. |
| `provider_contributions` | Provider identity unique by `(connectionId, externalId)`; many contributions may reference one vehicle. |
| `provider_fleet_memberships`, `group_evidence_bindings` | Provider fleet metadata and placement evidence; neither owns grouping. |
| `organization_vehicle_access` | Organization disclosure grants unique by `(organizationId, vehicleId)`. |
| `capability_policies` | Platform-owned, provider-neutral source precedence per capability. |
| `catalog_reviews` | Existing pending and resolved manual decisions retargeted to canonical vehicles and groups. |
| `catalog_runs`, `catalog_leases` | Existing run, checkpoint, snapshot, retry, and lease state. |

## Data Flow

    provider adapter -> canonical candidate -> catalog synchronization -> canonical MongoDB repositories
                                                                  |
    membership + vehicle grants -> canonical catalog projection --+-> capability policy -> Live

Import keeps contribution-first identity, exact safe plate matching, group evidence, manual exceptions, checkpoint resume, leases, and safe absence reconciliation. Live filters the catalog projection through active membership and vehicle grants, projects `CatalogGroup` as the provider-neutral fleet, and resolves capabilities independently. Provider rosters and fleet labels never become Live ownership. Consumers call `catalog-global` directly until the final rename; no adapter or facade joins the catalog APIs.

## Target File Changes

| Path | Ordered action |
|---|---|
| `app/api/admin/catalog/**`, existing review composition | 1. Retarget administration and reviews to `application/catalog-global/**`; preserve authorization and resolution behavior. |
| Synchronization composition and `integrations/catalog/**` | 2. Retarget sync and adapters to canonical candidates, use cases, and repositories; preserve adapter evidence and run behavior. |
| `application/live/**`, `app/live/**` | 3. Replace direct provider roster loading with the organization-filtered `catalog-global` projection; keep the Live output contract. |
| Existing organization-owned `domain/catalog/**`, `application/catalog/**`, repositories, routes, and tests | 4. Delete only after reference search, tests, and typecheck prove they have no consumers. |
| `domain/catalog-global/**`, `application/catalog-global/**` | 5. Rename to `domain/catalog/**` and `application/catalog/**`; update imports mechanically without changing behavior. |
| `integrations/persistence/mongodb/catalog-global-*`, `_v2` constants, versioned catalog routes | 6. Rename to definitive repository, collection, and route names; initialize only definitive collections. |
| Company binding, conversion/backfill code, compatibility loaders, and unused item contracts | Remove from the final product; do not replace them. |

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Characterization | Matching, placement, review, checkpoint, lease, snapshot, access, capability policy | Freeze current `catalog-global` behavior before retargeting consumers. |
| Boundary regression | Administration/reviews, sync/adapters, then Live | After each boundary, run its focused tests and full typecheck before continuing. |
| Integration | Import, MongoDB persistence, and Live projection | Prove imported canonical vehicles reach Live through organization grants and canonical groups without provider-roster reads. |
| Final rename | Definitive imports, collections, and routes | Run reference searches plus lint, typecheck, full Vitest suite, build, and strict OpenSpec validation. |

## Rollout

No data migration is required. Start the empty database with the definitive schema and deploy one runtime path without flags, parallel reads, or temporary bridge layers.

## Open Questions

None.
