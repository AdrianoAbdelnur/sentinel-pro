# Design: Multi-provider canonical catalog

## Technical Approach

Create a hexagonal `catalog` slice. Identity `Organization` remains the authenticated tenant; catalog `Company -> Fleet -> Vehicle` is separate. Canonical hierarchy is durable and source-independent. Provider adapters emit company, verified fleet, and vehicle candidates; application use cases bind identities, match vehicles, track source presence, and project union rosters. Delivery remains thin Next.js 16 Route Handlers plus authenticated Server Components.

## Architecture Decisions

| Decision | Choice and rationale |
|---|---|
| Fleet identity | Store provider-agnostic, connection-scoped external Fleet identities separately from canonical Fleets. Many identities may target one Fleet; exact identity reuses its binding, while a new identity requires admin binding/review. Labels are descriptive only, preventing name collisions from merging fleets. |
| Union ownership | `catalog_vehicles.fleetId` is canonical membership and the union projection reads canonical Vehicles, not provider intersections. A later safe source match enriches the existing Vehicle. A source cannot delete or move canonical records. |
| Placement conflict | A bound external Fleet may place a new or non-admin-assigned `Unassigned` Vehicle. A match already placed elsewhere creates review; imports never override administrator placement. |
| Presence | Each external vehicle identity stores last successful sighting plus bounded capability states. Only a successfully completed full provider run may mark unseen identities absent. Failed/partial runs change no absence state. This isolates capability loss from canonical existence. |
| Cybermapa | GETVEHICULOS maps only observed fields and scoped `gps_id`. It exposes no verified fleet identity, so no Cybermapa Fleet is created; new Vehicles enter Company `Unassigned`, and later sync retains admin placement. |
| Atomicity | Fetch/validate before writes, sort candidates deterministically, transact one candidate transition, checkpoint bounded batches, and finalize presence only after the full run. Unique indexes make replay idempotent. |

## MongoDB Model

All documents use `schemaVersion`, timestamps, strict/error validators, and tenant-first indexes.

| Collection | Purpose and indexes |
|---|---|
| `catalog_companies` | Canonical Company; unique `{organizationId,id}`. |
| `catalog_fleets` | Canonical Fleet; unique tenant/id and partial unique `{organizationId,companyId,kind:"unassigned"}`. |
| `catalog_vehicles` | Canonical placement and admin-ownership marker; unique tenant/id, Company/plate/status and Fleet indexes. |
| `provider_connections` | Provider and `credentialRef` only; unique tenant/id. |
| `external_company_candidates` | Company binding; unique tenant/connection/normalized label. |
| `external_fleet_identities` | Verified external ID, label, Company, optional `canonicalFleetId`, binding status; unique `{organizationId,connectionId,externalId}`, plus canonical-Fleet lookup. |
| `external_vehicle_identities` | External ID, canonical Vehicle, external Fleet identity, `presenceStatus`, `lastSeenRunId`, `lastSeenAt`, bounded capability states; unique tenant/connection/external ID and canonical lookup. |
| `match_reviews`, `match_review_candidates` | Vehicle/fleet conflicts and explicit resolution; partial unique pending source and unique review/candidate. |
| `capability_policy_entries` | Ranked source selector; unique scope/capability/rank and source. |
| `catalog_import_runs`, `catalog_import_items` | Status/checkpoint/counts and per-candidate outcome; unique run/candidate key. |

Growing identities, candidates, policies, and import items are referenced, never embedded.

## Interfaces and Data Flow

```text
Provider -> CatalogImportSource -> normalize/stage -> Company/Fleet binding gate
 -> ImportCatalog -> match/link/create/review -> checkpoint
 -> successful-run presence reconciliation
Canonical Fleet -> ProjectCanonicalFleetUnion -> capability resolver -> live/UI
```

Ports: `CatalogHierarchyRepository`, `ProviderConnectionRepository`, `CompanyBindingRepository`, `FleetIdentityRepository`, `VehicleIdentityRepository`, `MatchReviewRepository`, `CapabilityPolicyRepository`, `ImportRunRepository`, `CatalogTransactionRunner`, `CredentialResolver`, and `CatalogImportSource`.

Use cases: `BindProviderCompany`, `BindProviderFleet`, `ImportCatalog`, `ResolveFleetBindingReview`, `ResolveVehicleMatchReview`, `PlaceVehicle`, `SetCapabilityPolicy`, and `ProjectCanonicalLive`. Matching first reuses scoped identity, then exact-one safe Company plate; ambiguity, identity conflict, or incompatible Fleet placement enters review. Union projection deduplicates by canonical Vehicle ID and resolves each capability through Vehicle, Fleet, Company, tenant, system.

## File Changes

- Create `domain/catalog/{entities,matching,fleet-binding,union-projection,precedence}.ts` and tests.
- Create `application/catalog/{contracts,ports,bind-provider-fleet,import-catalog,resolve-reviews,project-canonical-live}.ts` and tests.
- Create Cybermapa client/response/mapper/source; add Howen fleet/vehicle candidate source and tests.
- Add Mongo catalog documents, repositories, validators, migrations, indexes, and replica-set tests.
- Add `app/api/admin/catalog/**` bindings/import/review/policy routes and `app/admin/catalog/**` Spanish UI.
- Modify live contracts/composition only at the feature-switched canonical projection seam; update architecture docs.

## Testing Strategy

Strict TDD covers name non-binding, many-to-one fleet binding, partial-roster union, later identity enrichment, placement conflict review, provider-only Vehicles, and source absence. Replica-set tests prove uniqueness, transactions, crash replay, concurrent imports, and absence finalization only after successful runs. Adapter tests pin observed payloads; delivery tests cover same-origin/session/fresh-admin and tenant isolation. Run lint, typecheck, tests, coverage, then build.

## Migration and Rollback

Add collections/indexes idempotently; import Cybermapa before Howen. Keep current Howen live composition behind a switch until union projection reaches parity. Rollback disables imports/routes and restores prior live composition; canonical data, bindings, reviews, and admin placement remain.

## Open Questions

None.
