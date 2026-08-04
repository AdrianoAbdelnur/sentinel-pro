## Exploration: Multi-provider canonical catalog

### Current State
Live is provider-agnostic only at the display boundary. `domain/live/entities.ts` and `application/live/contracts.ts` assume one optional device per vehicle. Howen roster data becomes transient `howen:*` identities, while `aggregateOperationalSources` rejects collisions instead of combining provider capabilities on one canonical vehicle.

There is no organization-scoped persisted catalog. Howen is the only implemented operational provider. Cybermapa vehicle import is blocked because `GETVEHICULOS` does not work.

### Affected Areas
- `domain/live/entities.ts` — replace the singular-device assumption with canonical vehicle capabilities.
- `application/live/contracts.ts` and `aggregate-operational-sources.ts` — compose multiple device contributions on one vehicle.
- `integrations/howen/*` — normalize roster data for initial import and capability linkage.
- `app/live/create-operational-sources.ts` — load canonical state rather than Howen-owned identities.
- New `domain/catalog`, `application/catalog`, and persistence adapters — own canonical catalog and matching.

### Approaches
1. **Replicate full provider rosters** — copy all external records into Sentinel.
   - Pros: complete local snapshots.
   - Cons: duplicated ownership, storage, and synchronization complexity.
   - Effort: High.

2. **Canonical Sentinel catalog with explicit external connections** — Sentinel owns organizations, fleets, and vehicles; provider accounts and devices link through separate records.
   - Pros: stable identity, multi-provider capabilities, and minimal replication.
   - Cons: requires import, matching, and composition workflows.
   - Effort: High.

3. **Match provider snapshots at render time** — infer vehicle identity on each request.
   - Pros: smallest schema.
   - Cons: ambiguous matches and no durable corrections.
   - Effort: Medium.

### Recommendation
Use approach 2. Persist `organization -> fleet -> vehicle`, plus separate `provider_connections` for tenant-scoped provider accounts and `device_connections` for external devices attached to canonical vehicles.

The initial change covers the canonical catalog and Howen import only. Import minimal identity, fleet, vehicle, device, and capability data. Match only with high-confidence identifiers and send ambiguity to review. Cybermapa import is deferred until `GETVEHICULOS` works. Direct Ruptela/Rinho TCP ingestion, raw payloads, and telemetry projections belong to a later change.

Canonical fleets are Sentinel-owned and catalog mutations are admin-only. A display label may explicitly use a custom value or a provider label, but synchronization MUST never rename a fleet or move a vehicle automatically.

Authentication and tenant-scoped authorization are prerequisites for catalog administration.

### Risks
- Existing transient `howen:*` identities require a controlled migration.
- Automatic matching can merge unrelated vehicles without strict confidence rules.
- Capability precedence needs an explicit rule when multiple sources contribute the same capability.
- Howen sync failures must not corrupt the last valid canonical catalog.

### Ready for Proposal
No — complete the auth foundation decisions first, then propose canonical catalog plus Howen import only.
