## Exploration: Consolidate the catalog for an empty database

### Objective

Sentinel Pro starts with empty MongoDB. This change keeps the tested global catalog behavior, gives it definitive names, retargets import and Live to it, and removes the parallel organization-owned catalog from the product boundary. It is not a data repair, migration, compatibility rollout, or new catalog implementation.

### Verified Current State

- `/api/admin/import` uses `domain/catalog-global`, `application/catalog-global`, and the `catalog-global-*` MongoDB repositories.
- The parallel `domain/catalog` stack still owns `Company -> Fleet -> Vehicle`, organization-scoped connections, `Unassigned` placement, reviews, routes, and collections.
- Live production still loads the direct Howen source. `project-global-catalog-live.ts` already projects the global catalog but is not the production source.
- Global import already performs contribution-first matching, exact normalized-plate matching, multi-provider linking, group-evidence resolution, provider-fleet metadata, safe snapshot assessment, checkpoint resume, run persistence, and renewable per-connection leases.
- Global reviews retain unsafe identity or group evidence. Existing manual review behavior must be retargeted without adding review subjects, audit data, or resolution cases.
- `catalog_import_items_v2` has only a validator and index. No global repository or import use case reads or writes it; checkpoint resume is active. A final `CatalogItem` contract would be new functionality.
- Versioned collections, rollout names, duplicate Sentinel fleet/group collections, `legacy-unverified`, compatibility selectors, migration scripts, and backfill code describe coexistence that an empty database does not need.

### Definitive Model

| Concept | Collection | Rule |
|---|---|---|
| `Organization`, `User`, `OrganizationMembership` | `organizations`, `users`, `organization_memberships` | Membership establishes the active organization boundary. |
| `Provider`, `ProviderConnection` | `providers`, `provider_connections` | Platform-owned; never organization-owned. |
| `CatalogGroup` | `catalog_groups` | Canonical placement projected as a Live fleet. |
| `CatalogVehicle` | `catalog_vehicles` | One physical vehicle with one accepted group placement. |
| `ProviderContribution` | `provider_contributions` | Unique `(connectionId, externalId)`; many may reference one vehicle. |
| `ProviderFleetMembership` | `provider_fleet_memberships` | External topology metadata/evidence only. |
| `GroupEvidenceBinding` | `group_evidence_bindings` | Provider evidence bound to a canonical group. |
| `OrganizationVehicleAccess` | `organization_vehicle_access` | Filters disclosure only. |
| `CapabilityPolicy` | `capability_policies` | Ordered source selection per capability. |
| `CatalogReview` | `catalog_reviews` | Existing manual exception flow retargeted to canonical targets. |
| `CatalogRun` | `catalog_runs` | Existing attempt, lineage, checkpoint, counts, snapshot, and failure state. |
| `CatalogLease` | `catalog_leases` | Existing renewable exclusive lease per connection. |

`catalog_import_items` is not part of the model. Its unused versioned validator, index, and collection initializer must be removed rather than implemented.

### Preserved Behavior

- Reuse contribution identity before exact safe normalized-plate matching.
- Allow several contributions to describe one vehicle; retain unsafe evidence for manual review.
- Treat Cybermapa group evidence as authoritative and Howen evidence as fallback.
- Keep provider fleets as metadata, manual review semantics, run/lineage checkpoints, snapshot safeguards, absence reconciliation, and renewable leases.
- Make import and Live read the same canonical repositories and application projection.

### Explicitly Excluded

- Data migration, backfill, dual reads/writes, compatibility switches, or old collection names.
- `Company`, organization-owned connections, `Unassigned` fleets, duplicate Sentinel fleets, legacy placement authority, and migration approval tokens.
- Durable import items, new review workflows, new audit fields, new matching rules, or new provider behavior.
- Any code or database change during this SDD-only phase.

### Recommendation

Promote the tested global implementation through mechanical rename and dependency retargeting. Disconnect the parallel catalog only after tests prove import and Live use the definitive contracts. This change authorizes no new catalog behavior.
