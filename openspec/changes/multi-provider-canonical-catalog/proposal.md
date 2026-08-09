# Proposal: Multi-provider canonical catalog

## Intent

Create a tenant catalog: `Identity Organization -> Catalog Company -> Fleet -> Vehicle`. Compose Cybermapa, Howen, and native records without leaking providers into authorization or UI.

## Scope

### In Scope
- Tenant-owned Companies, fleets, vehicles, native creation, and one `Unassigned` fleet per Company.
- Tenant connections and staged Cybermapa candidates admin-bound to catalog Companies.
- Idempotent Cybermapa-first/Howen imports, scoped identities, guarded plate matching, and review.
- Capability overrides at Vehicle, Fleet, catalog Company, or tenant Organization with ordered fallback.
- A live seam retaining fallback.

### Out of Scope
- Ruptela/Rinho adapters, raw telemetry expansion, inferred identity records, and UI provider branches.

## Capabilities

### New Capabilities
- `canonical-vehicle-catalog`: Tenant Companies, fleets, vehicles, native creation, and per-Company `Unassigned`.
- `provider-company-binding`: Connection-scoped external company candidates and explicit admin binding to canonical catalog Companies.
- `external-identity-linking`: Company-scoped identities, plate matching, and review.
- `cybermapa-catalog-import`: Operational Cybermapa company/vehicle ingestion using observed fields and `gps_id` identity.
- `howen-catalog-import`: Verified Howen ingestion without provider ownership of canonical records.
- `capability-source-precedence`: Vehicle-to-tenant policy inheritance and fallback.

### Modified Capabilities
- `live-core-contracts`: Live uses Company/Fleet/Vehicle identity and independently resolved source capabilities.

## Approach

Identity `Organization` remains the authorization tenant; each connection belongs to its tenant. Normalized `nombre_empresa` stages a candidate an admin binds to a Company. `gps_id` scopes vehicle identity. Exact plate auto-links only to one active vehicle in that Company without conflict; zero matches create in `Unassigned`; conflicts await review. Names/aliases never auto-link. Cybermapa composes first; provider-only/native vehicles remain. Policy resolves Vehicle, Fleet, Company, tenant, then system. Admin assignment wins over sync.

## Affected Areas

| Area | Impact |
|---|---|
| `domain/catalog`, `application/catalog` | Hierarchy, rules, ports, use cases |
| `integrations/cybermapa`, `integrations/howen` | Import adapters |
| `integrations/persistence/mongodb` | Durable catalog |
| `app/admin`, `app/api/admin` | Company binding/import/review delivery |
| `domain/live`, `application/live` | Canonical projection seam |

## Risks

| Risk | Mitigation |
|---|---|
| Tenant/company conflation | Separate contracts and ownership keys |
| Duplicate plates/label drift | Guarded matching, bindings, review |
| Import races/failure | Scoped uniqueness, resumable idempotency |

## Rollback Plan

Disable catalog routes/imports and restore Howen live composition. Snapshot additive collections before removal; identity data and admin fleet assignments remain untouched.

## Dependencies

- Authentication/tenant authorization foundation.
- Operational Cybermapa and Howen clients.

## Success Criteria

- [ ] Imports never create identity organizations, users, or memberships.
- [ ] Admin bindings produce catalog Companies and per-Company `Unassigned` fleets.
- [ ] Repeated imports create no duplicate identities; matching yields safe link, creation, or review.
- [ ] Provider-only/native vehicles and admin placement survive synchronization.
- [ ] Vehicle→Fleet→Company→tenant→system precedence and live projection pass quality gates.
