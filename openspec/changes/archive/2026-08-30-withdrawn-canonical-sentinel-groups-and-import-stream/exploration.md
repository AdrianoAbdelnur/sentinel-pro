## Exploration: Canonical Sentinel groups and resilient provider import streaming

### Current State
The public admin import path and the V2 global catalog are separate implementations. `app/api/admin/import/composition.ts` composes `application/catalog`, `createMongoCatalogRepositories`, and `createSynchronizeCatalogConnectionApplication`, so `/api/admin/import` still creates legacy Companies, `Unassigned` Fleets, provider connections, and synchronization runs per group (`application/catalog/import-provider.ts`). It does not use `application/catalog-global` or the V2 MongoDB repositories already composed by `app/api/internal/catalog/v2/composition.ts`.

The V2 vehicle and provider contracts are close to the desired boundary but cannot own canonical groups yet:

- `domain/catalog-global/global-vehicle.ts` stores only `placementFleetId` and explicitly retains the first placement.
- `application/catalog-global/ports.ts` has no Sentinel Fleet entity or repository.
- `integrations/persistence/mongodb/catalog-global-documents.ts` and `catalog-global-validators.ts` define `SentinelFleetDocument` and `sentinel_fleets_v2`, but `catalog-global-repositories.ts` never exposes that collection.
- `application/catalog-global/match-and-apply-provider-candidate.ts` accepts an optional `placementFleetId`; an existing plate match never changes placement. Provider fleet membership is already kept separately as provider metadata.

Provider evidence differs and must remain provider-specific below the application boundary. Cybermapa exposes `nombre_empresa` but no verified fleet identifier (`integrations/cybermapa/responses.ts`); `mapCybermapaGlobalCatalog` currently discards that value and applies one configured `placementFleetId` to every vehicle. Howen exposes `fleetid` and `fleetname`, validates `devicename` as a plate, and preserves the fleet as `providerFleetMembership` (`integrations/howen/seed-howen-catalog.ts`).

Progress and transport lifecycle are also split incorrectly. The legacy importer creates a new connection and run per group, forwards each run's local counts directly, and only sums outcomes after a group finishes. A retry creates new connection IDs, so its checkpoint is not globally reusable. The V2 synchronizer persists a checkpoint and counts for a stable connection, but exposes no progress callback. Finally, `app/api/admin/import/route.ts` has no `request.signal`, stream cancellation, closed-state guard, or safe send/close operation; late `enqueue`/`close` calls can throw after the consumer disconnects, and the resulting callback rejection can be interpreted as an import failure. Existing route tests cover authorization only.

The approved behavior conflicts with current source-of-truth requirements. `openspec/specs/canonical-vehicle-catalog/spec.md` says the first provider fixes placement forever, while `openspec/specs/howen-catalog-import/spec.md` says a later match never changes placement. Both must be narrowed so Cybermapa group evidence has explicit placement precedence. `cybermapa-catalog-import`, `provider-fleet-binding`, and `catalog-synchronization` also require deltas for canonical group resolution, metadata retention, durable cumulative progress, and safe delivery cancellation.

### Affected Areas
- `openspec/specs/canonical-vehicle-catalog/spec.md` — replace unconditional first-writer placement with explicit Cybermapa precedence.
- `openspec/specs/cybermapa-catalog-import/spec.md` — define `nombre_empresa` as canonical-group evidence without pretending it is a provider fleet ID.
- `openspec/specs/howen-catalog-import/spec.md` — retain plate matching and Howen-only group creation while permitting a later Cybermapa re-placement.
- `openspec/specs/provider-fleet-binding/spec.md` — preserve provider names and memberships as metadata, separate from canonical group identity.
- `openspec/specs/catalog-synchronization/spec.md` — require stable V2 connections/runs, cumulative persisted progress, and checkpoint-based resume.
- `domain/catalog-global/global-vehicle.ts` — support an auditable application-owned placement change instead of unconditional retention.
- `domain/catalog-global/` — add the missing canonical Sentinel group model and group-source evidence/binding contract.
- `application/catalog-global/ports.ts` — expose canonical group persistence and lookup ports.
- `application/catalog-global/match-and-apply-provider-candidate.ts` — resolve group evidence and apply the provider precedence policy independently of UI/provider conditionals.
- `application/catalog-global/synchronize-global-connection.ts` — emit cumulative progress from persisted run state and resume a stable connection.
- `integrations/cybermapa/seed-cybermapa-catalog.ts` — map `nombre_empresa` to Cybermapa group evidence instead of a single configured placement.
- `integrations/howen/seed-howen-catalog.ts` — derive initial canonical groups for Howen-only vehicles while retaining `fleetid`/`fleetname` metadata.
- `integrations/persistence/mongodb/catalog-global-documents.ts` — persist canonical groups and their provider evidence/bindings.
- `integrations/persistence/mongodb/catalog-global-repositories.ts` — implement the currently missing `sentinel_fleets_v2` repository and group binding persistence.
- `app/api/admin/import/composition.ts` — replace the legacy composition with the global V2 import/synchronization application.
- `app/api/admin/import/route.ts` — make NDJSON delivery cancellation-aware and idempotent without coupling transport failure to run status.
- `app/api/admin/import/route.test.ts` — cover client cancellation, late progress, one terminal event, and safe closure.
- `app/admin/import/provider-import-screen.tsx` — consume monotonic cumulative progress rather than replacing totals with group-local counts.

### Approaches
1. **Patch the legacy import orchestrator** — accumulate group counts and add stream guards while continuing to create Companies, Fleets, connections, and runs per group.
   - Pros: Smallest immediate diff; preserves the current endpoint shape.
   - Cons: Keeps two catalog models, cannot provide durable global resume, and deepens the structural debt the V2 catalog was created to remove.
   - Effort: Medium

2. **Make V2 the sole admin import path and complete canonical groups** — add a first-class Sentinel group aggregate plus provider group evidence, map both adapters into it, execute imports on stable V2 connections/runs, and project persisted cumulative progress through a cancellation-safe stream.
   - Pros: Matches the approved behavior and architecture; preserves provider metadata; supports checkpoint resume; eliminates legacy writes from the endpoint.
   - Cons: Requires coordinated domain, application, persistence, adapter, route, UI, migration, and specification changes.
   - Effort: High

3. **Keep placement IDs opaque and add precedence only in the matcher** — synthesize placement IDs in adapters without a canonical group aggregate or repository.
   - Pros: Less persistence work than a complete group model.
   - Cons: Names remain accidental identity, renames and provenance are not auditable, `sentinel_fleets_v2` remains an unused schema, and group administration cannot be added cleanly.
   - Effort: Medium

### Recommendation
Use approach 2. Model each Sentinel group with a generated stable ID and canonical label. Store provider group evidence separately: Cybermapa contributes a normalized `nombre_empresa` key plus its raw label; Howen contributes `fleetid` plus `fleetname`. Provider labels remain metadata and never become the Sentinel group's database identity.

Resolve each candidate in this order:

1. Match or reuse the global vehicle by the existing validated identity rules, primarily normalized plate.
2. Cybermapa resolves or creates the canonical group represented by `nombre_empresa` and sets that placement. If the vehicle was initially placed from Howen, record an explicit Cybermapa-authoritative move.
3. Howen attaches video capabilities and fleet metadata to a matched vehicle without moving a Cybermapa-established placement.
4. If Howen is the only source, resolve or create a Sentinel group from stable `fleetid` evidence and use it as initial placement.

The precedence rule belongs in application/domain policy, not in UI rendering or provider-name conditionals. A placement should carry enough provenance to distinguish a Cybermapa-authoritative placement from a Howen-derived initial placement, making re-imports idempotent and future policy changes auditable.

The admin endpoint should resolve existing stable V2 provider connections and invoke one resumable global synchronization run per provider connection. Progress should be derived from the persisted run (`checkpoint`, cumulative `counts`, and total snapshot size), so every event is monotonic and reconnection can read the latest status. Stream delivery should use a single guarded sender/closer tied to `request.signal`; disconnecting the HTTP reader must stop further transport writes but must not turn an otherwise valid catalog run into a provider/internal failure. Any future business-level cancellation must be an explicit application command, not an accidental consequence of `enqueue` failure.

### Risks
- Cybermapa provides only a company name, so normalization collisions and provider-side renames can create ambiguous group evidence; ambiguous cases need review rather than silent merge.
- Moving a Howen-first vehicle when Cybermapa arrives changes the current immutability contract and needs an audit/provenance field plus regression tests for re-import ordering.
- Existing `global_vehicles_v2` records may lack placement provenance; migration must classify them conservatively instead of guessing their authority.
- Stable connection lookup must avoid creating duplicate V2 connections and must define behavior when multiple enabled connections exist for one provider.
- Checkpoint ordering currently uses `externalId`; snapshot or grouping changes must not cause skipped candidates during resume.
- A client disconnect can race with progress and completion; the stream adapter must make send/close idempotent while allowing the application run to finish and persist independently.
- Empty or renamed groups need explicit lifecycle rules so absence reconciliation does not delete or rename canonical groups implicitly.

### Ready for Proposal
Yes. The proposal should make V2 the exclusive admin import path, introduce first-class canonical Sentinel groups with provider evidence, codify Cybermapa placement precedence, preserve Howen fleet metadata, and separate durable import execution from best-effort NDJSON delivery. It should explicitly defer automatic deletion/renaming of empty groups unless separate business rules are approved.
