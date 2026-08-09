## Exploration: Multi-provider canonical catalog

### Current State
Sentinel Pro does not yet have an organization-scoped persisted fleet and vehicle catalog. The identity foundation now provides persisted organizations, memberships, active-organization sessions, and fresh admin authorization, and it is merged into `main`; authentication is therefore no longer a blocker for catalog proposal work.

Operational live currently treats provider snapshots as the roster. `domain/live/entities.ts` permits devices to reference internal vehicle IDs, but `LiveVehicleState` carries only one optional device. The Howen mapper creates transient `howen:*` fleet, vehicle, and device identities, and `aggregateOperationalSources` rejects a later source atomically when identities collide rather than linking multiple source identities to one canonical vehicle.

Howen is the only implemented external operational source. Its verified roster exposes fleet identity and label, device number, vehicle headline, channel count, GPS, and online state, which is enough to support the first import adapter. There is no Cybermapa integration or contract in either repository. The recorded `GETVEHICULOS` failure prevents verifying a Cybermapa import now, so only its future port contract and default precedence policy belong in this change.

The confirmed domain direction is that Sentinel owns the canonical organization, fleet, and vehicle catalog. A canonical vehicle may originate from Cybermapa, Howen, Ruptela, Rinho, another provider, or native manual creation. Multiple scoped external identities may link to one canonical vehicle. Provider-only vehicles remain valid, while ambiguous matches require explicit review and MUST NOT merge automatically.

Source choice is capability-specific rather than vehicle-wide. The default order prefers Cybermapa for GPS and operational alerts, and Howen for video and video alerts. An organization, fleet, or vehicle may override each capability with an ordered fallback; the most specific applicable policy should win.

### Affected Areas
- `domain/identity/*` and `application/identity/*` — existing organization and authorization contracts establish the tenant and admin boundary; they should be reused rather than duplicated as a catalog customer model.
- New `domain/catalog/*` — canonical fleets, vehicles, scoped external identities, capabilities, precedence policies, and match-review states.
- New `application/catalog/*` — manual creation, idempotent provider import, deterministic linking, ambiguous-match review, and capability-source resolution use cases and ports.
- `integrations/persistence/mongodb/*` — organization-scoped catalog documents, uniqueness constraints, repositories, and atomic import persistence.
- `integrations/howen/*` — adapt the verified roster to import candidates without allowing Howen identities to become canonical identities.
- `domain/live/entities.ts` and `application/live/contracts.ts` — later consume multiple linked devices/capability contributions for one canonical vehicle instead of one provider-owned snapshot identity.
- `application/live/aggregate-operational-sources.ts` and `app/live/create-operational-sources.ts` — later replace collision-based roster concatenation with canonical catalog composition and per-capability source resolution.
- `app/admin/*` and future catalog Route Handlers — deliver authorized manual catalog and import/review workflows without owning matching or provider logic.
- `openspec/specs/live-core-contracts/spec.md` and related live specs — currently require internal business identity but do not yet specify durable canonical identity, matching, or per-capability precedence.

### Approaches
1. **Replicate provider rosters as separate catalogs** — preserve one fleet and vehicle tree per external source.
   - Pros: Simple imports and direct traceability.
   - Cons: Duplicates real vehicles, forces operators to understand providers, and cannot resolve capabilities consistently.
   - Effort: Medium.

2. **Sentinel-owned canonical catalog with explicit source links** — persist one organization-scoped fleet and vehicle model, link provider identities separately, and resolve sources through capability policies.
   - Pros: Stable business identity, native manual records, provider-only records, durable reviewed links, and provider-agnostic UI/application contracts.
   - Cons: Requires matching, review, idempotent synchronization, policy inheritance, and migration away from transient IDs.
   - Effort: High.

3. **Infer canonical matches and precedence at read time** — retain raw snapshots and reconstruct vehicle identity for each request.
   - Pros: Minimal initial persistence.
   - Cons: Ambiguity is not durably resolved, corrections cannot be audited, results may change between requests, and precedence logic spreads into live composition.
   - Effort: Medium initially, High operationally.

### Recommendation
Use approach 2. Reuse the authenticated organization as the catalog ownership boundary, then persist Sentinel-owned fleets and vehicles separately from provider connections and scoped external identities. A source link should identify at least the organization connection, provider entity kind, and external ID so identifiers from different accounts cannot collide.

The first delivery should include the canonical catalog, native manual fleet/vehicle creation, Howen import, deterministic high-confidence linking, an explicit review state for ambiguity, and per-capability precedence contracts. Imports must be idempotent and must not silently rename canonical fleets, move vehicles, or merge ambiguous records.

Resolve capability policy from vehicle to fleet to organization to system default, preserving an ordered fallback list at each selected level. Document Cybermapa as the default GPS and operational-alert source and Howen as the default video and video-alert source, while allowing an available lower-priority source to serve a capability when the preferred source is absent or unavailable.

Defer the Cybermapa adapter/import until `GETVEHICULOS` can be exercised and verified. Also defer direct Ruptela/Rinho ingestion, raw payload retention, telemetry projections, and broad live-screen migration unless a later task is required to expose the first catalog slice safely.

### Risks
- Weak identifiers such as labels or plates can merge unrelated vehicles; only deterministic matches may link automatically, and ambiguous candidates need persisted review.
- Provider external IDs may be unique only within an account, so uniqueness must include the provider connection and organization scope.
- Import retries or concurrent runs can create duplicates unless candidate identity and persistence writes are idempotent and atomic.
- Current transient `howen:*` identities and the single-device live state require an explicit migration path before canonical IDs drive live views.
- Capability fallback must distinguish source absence, unsupported capability, stale data, and temporary unavailability or it may select misleading operational data.
- Cybermapa field mappings and import behavior cannot be validated until its vehicle endpoint works; documenting more than the port and policy would invent a contract.

### Ready for Proposal
Yes — the auth and tenant-authorization prerequisite is implemented and merged, the canonical ownership and matching rules are confirmed, and the first delivery boundary is explicit: canonical catalog, native manual creation, and Howen import, with Cybermapa contracts/default policy documented but its adapter deferred.
