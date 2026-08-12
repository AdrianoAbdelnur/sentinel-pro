## Exploration: enforce-external-fleet-tenant-isolation

### Current State
`Organization -> Company -> Fleet -> Vehicle` is the catalog hierarchy. `ProviderConnection` is Organization-scoped and carries `credentialRef` plus optional `companyId`; external fleet identities are already persisted as `(organizationId, connectionId, externalId) -> canonical fleetId` and the canonical Fleet carries `companyId`.

The P0 hole is in `application/catalog/import-catalog.ts`: Howen's source supplies `connection.companyId` on every candidate, so the importer accepts that Company before resolving its `externalFleetId`. An unknown/unbound fleet is staged for review but its Vehicle can still be created in that Company's Unassigned Fleet. Thus Company context, not evidence of fleet ownership, controls import.

Cybermapa maps `gps_id` and mutable `nombre_empresa`, but the verified GETVEHICULOS payload has no stable fleet/group identifier. Its current label/company-candidate binding is not a record authorization boundary.

Howen is suitable for fleet authorization: validated roster records provide `fleetid` and `fleetname`; prior project exploration observed `fleetid` on all 621 records across 119 fleets, and project specs designate `fleetid` stable while `fleetname` is only a label. No real APIs or `.env.local` were read.

### Affected Areas
- `domain/catalog/fleet-binding.ts` — existing exact external Fleet binding is the Howen authorization evidence.
- `application/catalog/import-catalog.ts` and `ports.ts` — authorize before matching, identity, review, placement, or canonical mutation.
- `integrations/howen/{map-howen-catalog,source}.ts` and `app/api/catalog/connection-sources.ts` — remove Company-by-sync-context ownership.
- `integrations/cybermapa/{responses,map-cybermapa-catalog,source}.ts` — lacks a Fleet id and needs an equivalent fail-closed scope.
- Mongo catalog documents/repositories/validators/migrations and catalog/provider tests.

### Approaches
1. **Exact external Fleet binding gate** — authorize every record through `(connection, externalFleetId) -> canonical Fleet -> Company` before import.
   - Pros: Reuses durable model; supports one master account; exact, provider-stable proof.
   - Cons: Cannot cover Cybermapa's currently verified payload.
   - Effort: Medium.

2. **Connection Company / provider label gate** — retain `companyId` injection and `nombre_empresa` binding.
   - Pros: Small change.
   - Cons: No record-to-authorized-boundary proof; unsafe under a master account.
   - Effort: Low, unacceptable.

3. **External-scope gate: Fleet where available, exact vehicle authorization otherwise** — use Fleet bindings for Howen; use an explicit `(organizationId, connectionId, gps_id) -> companyId` allowlist for Cybermapa.
   - Pros: Fail-closed evidence for every record; preserves one master credential per provider.
   - Cons: Cybermapa onboarding is per vehicle until it exposes a verified group/fleet id.
   - Effort: Medium.

### Recommendation
Use approach 3. For Howen, promote the existing exact `ExternalFleetIdentity` binding into the authorization gate: a record is eligible only if its stable `fleetid` is bound to a canonical Fleet belonging to the target Company. Do not use `connection.companyId` or `fleetname` as authorization. The check MUST happen before any vehicle identity lookup/creation, matching, review, placement, or catalog write; unknown/unbound/mismatched fleets are rejected with no association.

Cybermapa cannot truthfully use fleet authorization with the verified GETVEHICULOS contract. The minimum equivalent strong boundary is an administrator-maintained exact `gps_id` authorization per Company and master connection. `nombre_empresa` remains metadata/candidate information, never security evidence. Unknown `gps_id` is ignored/rejected; it never defaults to a Company. If Cybermapa later exposes a verified stable group/fleet id, migrate that provider to the Fleet gate.

### Risks
- Checking an existing external vehicle identity before authorization would preserve a secondary cross-tenant path.
- Exact authorization must include Organization and connection, never labels or another connection's binding.
- Cybermapa `gps_id` was observed unique in one snapshot, not provider-documented immutable; its allowlist is still fail-closed.

### Ready for Proposal
Yes — implement fail-closed pre-import scope authorization: Howen `fleetid` bindings and Cybermapa exact `gps_id` allowlisting.
