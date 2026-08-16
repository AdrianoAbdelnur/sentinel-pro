## Exploration: Repair Global Provider Catalog

### Current State
Sentinel currently persists the catalog as `Organization -> Company -> Fleet -> Vehicle`. Provider connections, external identities, reviews, sync runs, capability policies, and matching all carry `organizationId`; vehicle matching is further limited to one `companyId`. Tenant administrators can run imports because the identity model has only `admin` and `operator` roles.

The one-click importer amplifies that incorrect ownership model. Cybermapa candidates are grouped by company label, while every Howen candidate is grouped under a synthetic `Howen` Company. Each group creates a fresh provider connection. Howen therefore cannot see matching Cybermapa vehicles and creates separate vehicles and fleets. The generic importer also resolves provider fleet placement before saving a matched vehicle, so a later provider can change system-managed placement.

Useful foundations already exist: provider adapters normalize snapshots, external IDs support deterministic re-import, synchronization has leases/checkpoints/snapshot-integrity protection, and capability resolution accepts ordered source IDs. However, the defaults and delivery factories name Cybermapa and Howen directly, Howen exposes `devicename` only as a label instead of validated plate evidence, no scheduler is configured to call the internal cron endpoint, and capability policies remain tenant-owned.

The required model is three separate concerns:

1. A SUPER ADMIN-owned global Sentinel catalog, where one physical vehicle is identified globally and has one authoritative Sentinel fleet placement.
2. Provider contributions, identities, capabilities, and provider-specific fleet memberships. Provider fleets never establish vehicle identity and a later provider never moves an existing vehicle.
3. Tenant access assignments, applied only after global ingestion and never consulted for matching, creation, source selection, or synchronization.

Today Cybermapa is imported first: it seeds vehicles, Sentinel fleet placement, and GPS. A matching Howen plate enriches that vehicle with video without changing placement. A Howen-only vehicle is created using its Howen fleet. The same rules must work for future registered providers without adding provider branches to domain, application, or UI code. Recurring synchronization is automatic; SUPER ADMIN configures providers and may trigger initial or manual runs.

### Affected Areas
- `domain/catalog/entities.ts`, `company-candidate.ts`, and `matching.ts` — remove tenant/Company ownership from physical identity and replace Company-scoped plate matching with guarded global matching.
- `domain/catalog/precedence.ts` — move capability precedence to global/provider-neutral policy and replace hardcoded provider defaults with persisted configuration.
- `application/catalog/import-catalog.ts` and `import-provider.ts` — separate identity matching, initial placement, provider fleet membership, and enrichment; reuse connections instead of creating synthetic Companies and fresh connections.
- `application/catalog/ports.ts` and catalog use cases — add global lookup/uniqueness ports, provider registration/capability contracts, and tenant access-assignment boundaries.
- `application/catalog/synchronize-*.ts` — retain leases, idempotency, cadence, and snapshot protection while removing tenant ownership from synchronization inputs and records.
- `domain/identity/*` and `app/api/admin/import/*` — introduce global SUPER ADMIN authorization for provider configuration/import without granting tenant administrators catalog-ingestion rights.
- `integrations/cybermapa/*` and `integrations/howen/*` — keep provider API details in adapters; expose validated plate evidence, capabilities, and independent provider fleet membership through one neutral candidate contract.
- `app/api/catalog/connection-sources.ts` — replace the closed Cybermapa/Howen delivery map with a provider registry/composition mechanism.
- `integrations/persistence/mongodb/catalog-*` — migrate organization/company-scoped documents and indexes into global vehicles, provider identities/contributions/fleet memberships, global policies, and separate tenant grants.
- `application/live/project-canonical-live.ts` — resolve selected capability sources from global vehicle contributions, then filter the resulting catalog through tenant access grants.
- `app/api/internal/catalog/synchronize/*` and deployment configuration — retain the internal endpoint but add a real scheduler invocation and enumerate registered enabled connections globally.

### Approaches
1. **Patch current matching** — search all Companies by normalized plate and special-case Howen placement.
   - Pros: Fastest visible fix; reuses current collections.
   - Cons: Leaves tenant ownership, synthetic Companies, connection duplication, provider branching, and unsafe fleet coupling intact; future providers repeat the problem.
   - Effort: Medium

2. **Incremental global-catalog strangler** — introduce explicit global catalog, provider-contribution, and tenant-access boundaries; migrate Cybermapa and Howen through provider-neutral contracts; switch reads only after dry-run parity.
   - Pros: Restores the agreed separation, preserves reusable adapters/synchronization safeguards, supports future providers, and permits reversible migration.
   - Cons: Requires coordinated schema, authorization, import, live-projection, and data migration work.
   - Effort: High

3. **Rewrite the entire catalog and synchronization module** — discard existing catalog code and rebuild all ingestion infrastructure.
   - Pros: Clean slate with fewer compatibility seams.
   - Cons: Throws away validated leases, snapshot integrity, adapters, and tests; maximizes regression and rollout risk without business benefit.
   - Effort: Very High

### Recommendation
Use approach 2 and deliver it in reviewable vertical slices.

Define a global Vehicle identity keyed by normalized plate when trustworthy. Exact external identity reuse remains first. A new external identity with one exact global plate match attaches a provider contribution to that Vehicle; ambiguous, missing, or conflicting evidence goes to SUPER ADMIN review rather than silently creating or merging. Provider fleet membership is stored independently. The provider that creates a new Vehicle supplies its initial Sentinel fleet placement; later contributions never move it. Because Cybermapa is currently synchronized first, Cybermapa establishes placement for shared vehicles, while Howen supplies placement only for Howen-only vehicles.

Represent provider capabilities and source order as data. Cybermapa currently declares GPS/operational capabilities and Howen video capabilities, but application code consumes only neutral capability contributions. SUPER ADMIN may override the ordered sources per capability, including a future direct-GPS source. A new provider requires registration, credentials, an adapter, declared capabilities, and scheduling configuration—not changes to matching, fleet, tenant, or UI rules.

Keep the existing synchronization engine's leases, checkpoints, idempotency, partial-snapshot protection, and manual/scheduled shared use case. Change its scope to registered global provider connections, then configure an external scheduler to invoke the existing internal endpoint. Manual initial/retry imports require SUPER ADMIN; cron uses internal service authentication.

Migrate safely with new collections or versioned documents: first produce a read-only report grouped by normalized plate, select Cybermapa-backed records as the survivor for current shared vehicles, attach Howen identities/capabilities, retain Cybermapa placement, retain Howen placement only for Howen-only vehicles, and flag collisions. Apply only after tests and dry-run approval; then create tenant access grants from existing ownership data and switch reads. No current data is modified during this change's exploration/specification phases.

### Risks
- Existing duplicate or malformed plates make an unconditional unique index unsafe; migration needs deterministic conflict classification and SUPER ADMIN review.
- Howen `devicename` is currently modeled as display-only; its use as plate evidence must be explicitly validated and adapter-tested before automatic linking.
- Removing `organizationId` touches many MongoDB keys and transactional uniqueness guarantees; dual-write or versioned migration must preserve idempotency during rollout.
- Tenant access grants must be derived and verified before global catalog reads replace tenant-owned reads, or tenants could gain or lose visibility.
- Existing open SDD artifacts encode the superseded tenant-owned catalog model; proposal/spec/design must explicitly replace those requirements rather than silently editing history.
- A cron endpoint exists but no scheduler is configured; deployment remains incomplete until the scheduler and secret are operationally verified.

### Ready for Proposal
Yes — propose the incremental global-catalog repair, explicitly supersede tenant-owned ingestion/matching requirements, and split implementation into global identity, provider contributions/placement, configurable capability sources, SUPER ADMIN plus tenant grants, synchronization scheduling, and dry-run migration work units.
