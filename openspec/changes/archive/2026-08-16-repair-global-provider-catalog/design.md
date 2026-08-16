# Design: Repair Global Provider Catalog

## Technical Approach

Use a strangler beside the tenant-owned catalog. New `v2` repositories own global identity, placement, provider contributions, and tenant grants. Existing adapters and synchronization safety mechanisms are wrapped by neutral contracts. Legacy Live remains the default until migrated data and projections reach parity; each slice has one switch and can roll back without rewriting legacy collections.

## Architecture Decisions

| Decision | Choice | Rationale / rejected alternative |
|---|---|---|
| Platform authority | Add user-level `platformRole: "super-admin"` and `authorizePlatform()` independent of membership or active tenant. | Tenant `admin` cannot imply global authority. |
| Identity | Reuse `(connectionId, externalId)` first; otherwise match exactly one valid global `normalizedPlate`. A valid unmatched plate creates; missing, malformed, ambiguous, or conflicting evidence creates review. | Company, tenant, label, and fleet matching caused duplicates or unsafe merges. |
| Provider model | Persist provider definitions, enabled connections, declared capabilities, and contributions; composition registers adapter factories by `adapterKey`. | Avoid provider branches in domain, import orchestration, and UI. |
| Placement | Sentinel placement is immutable during enrichment. Provider fleet membership is separate metadata. Cybermapa seeds current placement; Howen supplies placement only when creating a Howen-only vehicle. | Provider fleet equivalence is not real. |
| Capability policy | Store ordered contribution source IDs per vehicle/global default and capability. | Supports current Cybermapa/Howen defaults, overrides, future providers, and direct GPS without identity changes. |
| Rollout | Versioned collections, dry-run, approval token, dual-read comparison, then one read switch. No destructive legacy writes. | A big-bang migration cannot be verified or safely reversed. |

## Data Flow

```text
SUPER ADMIN / internal scheduler -> global connection -> adapter snapshot
 -> external identity -> exact normalized plate -> global Vehicle or Review
 -> contribution + provider fleet membership -> capability resolution
 -> tenant grant filter -> unchanged Live view model
```

The scheduled and manual paths call the same use case. Existing lease renewal, checkpoints, import-item idempotency, retry classification, and complete-snapshot absence reconciliation move behind global connection keys; an incomplete snapshot never marks contributions absent.

## Interfaces / Contracts

```ts
type GlobalVehicle = { id: string; normalizedPlate: string; plate: string; placementFleetId: string };
type ProviderDefinition = { id: string; adapterKey: string; capabilities: Capability[] };
type ProviderConnection = { id: string; providerId: string; credentialRef: string; enabled: boolean; cadenceMinutes: number };
type ProviderContribution = { id: string; connectionId: string; externalId: string; vehicleId: string; capabilities: Partial<Record<Capability, CapabilitySourceStatus>>; presence: "present" | "absent" };
type ProviderFleetMembership = { connectionId: string; externalFleetId: string; vehicleId: string; label: string };
type TenantVehicleGrant = { organizationId: string; vehicleId: string };
type ProviderAdapterRegistry = { resolve(adapterKey: string, connectionId: string): CatalogImportSource | undefined };
```

## Persistence and Indexes

Create `global_vehicles_v2` (unique `id`, unique `normalizedPlate`), `sentinel_fleets_v2`, `provider_definitions_v2` (unique `id`/`adapterKey`), `provider_connections_v2`, `provider_contributions_v2` (unique `connectionId,externalId`; indexes on `vehicleId` and presence), `provider_fleet_memberships_v2` (unique `connectionId,externalFleetId,vehicleId`), `capability_policies_v2`, `tenant_vehicle_grants_v2` (unique `organizationId,vehicleId`), `catalog_reviews_v2`, `catalog_runs_v2`, `catalog_import_items_v2`, and `catalog_leases_v2`. Strict validators retain `schemaVersion`. Conflicting legacy plates stay outside target vehicles as migration conflicts, allowing the unique plate index.

## File Changes

- Create `domain/catalog-global/*`, `application/catalog-global/{ports,match-and-apply-provider-candidate,synchronize-global-connection,migrate-global-catalog}.ts`.
- Create `integrations/persistence/mongodb/catalog-global-{documents,repositories,validators,migrations}.ts` and migration CLI.
- Modify `domain/identity/entities.ts`, `application/identity/{ports,use-cases}.ts`, and `app/api/admin/import/*` for platform authorization.
- Modify provider mappers to emit validated plate evidence/capabilities; replace `app/api/catalog/connection-sources.ts` with registry-backed composition.
- Add a compatibility loader beside `application/live/project-canonical-live.ts`; preserve its output contract.
- Add scheduler deployment configuration and update `.env.example` and `docs/architecture/08-catalog-synchronization.md`.

## Small-Slice Verification and Rollback

1. Platform authorization: route/unit tests; rollback delivery wiring.
2. V2 schema and repositories: Mongo index/validator tests; drop only empty V2 collections.
3. Global matcher/contributions: RED/GREEN unit plus repository races; no production reads.
4. Cybermapa seed, then Howen enrichment/Howen-only: adapter and vertical integration tests; disable each V2 connection independently.
5. Capability policies including direct GPS: projection tests; restore prior policy document.
6. Scheduler on V2: lease/checkpoint/snapshot regression tests; disable schedule while manual path remains.
7. Grants and Live compatibility: parity tests per tenant; flip reads back to legacy instantly.
8. Migration: signed read-only report, explicit SUPER ADMIN approval, apply to V2, then cut over; rollback read switch and retain all legacy data.

Every slice starts with a focused failing test, passes lint/typecheck/tests, and lands independently; migration and cutover are forbidden before prior slice evidence passes.

## Open Questions

None.
