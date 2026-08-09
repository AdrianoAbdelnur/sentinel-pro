# Design: Multi-provider canonical catalog

## Technical Approach

Create a hexagonal `catalog` slice. Identity `Organization` remains the authenticated tenant and authorization boundary; catalog `Company` is a separate business entity beneath it, followed by `Fleet` and `Vehicle`. Domain owns hierarchy, matching, field ownership, and capability precedence. Application orchestrates imports and admin commands through ports. MongoDB and provider integrations implement those ports. Delivery uses authenticated Server Components for reads and thin Route Handlers for mutations.

## Architecture Decisions

| Decision | Choice and rationale |
|---|---|
| Ownership | Every catalog document carries `organizationId`; imports never create identity organizations, users, or memberships. Provider connections are tenant-scoped and store only `credentialRef`; a server-only `CredentialResolver` supplies secrets. |
| Hierarchy | Each Company receives exactly one system `Unassigned` Fleet. New unmatched vehicles enter it. Imports may update provider-managed fields but never reverse an administrator's fleet placement. |
| Identity and matching | External identities are connection-scoped. Cybermapa vehicle identity is `gps_id`. Existing identity reuses its vehicle; otherwise an exact normalized plate auto-links only when exactly one active vehicle exists in the bound Company and no deterministic identity conflicts. Zero matches create a vehicle; ambiguity/conflict creates review. Names and aliases never auto-link. |
| Composition | Sentinel owns canonical IDs, Company/Fleet placement, and admin overrides. Cybermapa is first for provider-managed descriptive fields, then eligible fallback data. Howen-only, native, and other-provider-only vehicles remain canonical; absence from one snapshot never deletes them. |
| Atomicity | Fetch and validate before writes; normalize and sort candidates deterministically, then transact one candidate transition. A run checkpoints after bounded batches. Unique indexes make replay after a crash idempotent. |

## Data Model and Indexes

All documents use `schemaVersion`, timestamps, strict/error validators, and tenant-first indexes.

| Collection | Purpose and key indexes |
|---|---|
| `catalog_companies` | Company; unique `{organizationId,id}`. |
| `catalog_fleets` | Company fleet; unique `{organizationId,id}` and partial unique Unassigned `{organizationId,companyId,kind}`. |
| `catalog_vehicles` | Canonical vehicle and admin-owned placement; unique `{organizationId,id}`, lookup `{organizationId,companyId,plateNormalized,status}` and fleet index. |
| `provider_connections` | Provider plus `credentialRef`; unique tenant/id. |
| `external_company_candidates` | Normalized provider label and optional Company binding; unique `{organizationId,connectionId,normalizedLabel}`. |
| `external_identities` | Provider entity to canonical target; unique `{organizationId,connectionId,entityKind,externalId}`. |
| `match_reviews`, `match_review_candidates` | Pending/resolved decision and separately stored candidates; partial unique pending source and unique review/vehicle. |
| `capability_policy_entries` | Ranked selector per scope/capability; unique scope/capability/rank and source. |
| `catalog_import_runs`, `catalog_import_items` | Status, counts, checkpoint, and per-candidate outcome; unique run/candidate key. |

Growing identities, review candidates, policies, and import items are referenced, not embedded.

## Interfaces and Data Flow

```text
Cybermapa GETVEHICULOS / Howen roster
  -> CatalogImportSource -> normalize -> company binding gate
  -> ImportCatalog -> bounded candidate transactions -> identity/link/create/review
Admin -> authorizeAdminRequest -> bind/resolve/place/configure use case -> Mongo ports
Catalog -> ProjectCanonicalLive -> live application contracts -> provider-agnostic UI
```

`CatalogImportSource`, `CredentialResolver`, `CatalogCompanyRepository`, `CatalogHierarchyRepository`, `ProviderConnectionRepository`, `CompanyBindingRepository`, `ExternalIdentityRepository`, `MatchReviewRepository`, `CapabilityPolicyRepository`, `ImportRunRepository`, and `CatalogTransactionRunner` form the boundary. Use cases are `BindProviderCompany`, `ImportCatalog`, `ResolveMatchReview`, `PlaceVehicle`, `SetCapabilityPolicy`, and `ProjectCanonicalLive`.

Cybermapa import is mandatory in the first release and maps only observed keys: `alias`, `anio`, `color`, `consumo`, `descripcion`, `gps_id`, `gps_identificador`, `id`, `marca`, `modelo`, `nombre`, `nombre_empresa`, `nombre_modulo`, `patente`. Its 5,542-record snapshot is processed in bounded, resumable batches. Duplicate normalized plates are expected and guarded by the matching rule. Howen uses its verified roster mapper; native creation enters the same canonical repositories.

Capability resolution selects the first configured level in `Vehicle -> Fleet -> Company -> Organization -> system`, then walks ordered eligible sources, skipping unsupported or unavailable entries. Defaults are Cybermapa for GPS/operational alerts and Howen for video/video alerts.

## File Changes

- Create `domain/catalog/{entities,matching,composition,precedence}.ts` and tests.
- Create `application/catalog/{contracts,ports,import-catalog,use-cases,project-canonical-live}.ts` and tests.
- Create Cybermapa client/response/mapper/source files; add Howen catalog mapper/source and adapter tests.
- Add Mongo catalog documents, validators, migrations, repositories, indexes, and replica-set tests.
- Add `app/api/admin/catalog/**` Route Handlers and `app/admin/catalog/**` Server Component UI with Spanish visible copy and provider-neutral result codes.
- Modify live contracts/composition only at the canonical projection seam; update architecture documentation.

## Testing Strategy

Strict TDD: domain tests first for every match and precedence branch; application tests for tenant isolation, bindings, idempotent retry, retained placement, field provenance, and all outcomes; Mongo replica-set tests for validators, indexes, transactions, checkpoint replay, and races; adapter contract tests for observed payloads; delivery tests for same-origin, session, fresh-admin, and Spanish UI states. Run lint, typecheck, tests, coverage, then build.

## Migration and Rollback

Create collections and indexes idempotently, import Cybermapa first, then Howen, while preserving native data. Keep existing live composition behind a feature switch until canonical projection reaches parity. Rollback disables imports/routes and switches live composition back; additive collections, reviews, bindings, and admin placements remain intact.

## Open Questions

None; the specifications define the first-release boundary.
