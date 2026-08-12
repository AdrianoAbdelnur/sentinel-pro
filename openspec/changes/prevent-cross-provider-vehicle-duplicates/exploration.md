## Exploration: prevent-cross-provider-vehicle-duplicates

### Current State
Catalog synchronization first reuses an exact `(organizationId, connectionId, externalId)` identity. If none exists, it matches one active canonical Vehicle by `normalizedPlate` inside the bound Company; multiple same-plate Vehicles become a `vehicle-match` review. Otherwise it creates a new provider Vehicle and identity atomically.

This does not prevent the reported Cybermapa/Howen duplicate. Cybermapa maps `gps_id` and its explicit `patente`; Howen maps `deviceno`, `fleetid`, and `devicename`, but intentionally never treats `devicename` as a plate. Thus a Howen record with a different `deviceno` has no strong shared match key and silently creates a second Vehicle even when its display name looks like Cybermapa's plate. Current identity loading is connection-scoped, which is correct for deterministic identity reuse but cannot supply cross-provider equivalence.

Reliable data currently available:
- Cybermapa: `gps_id` is its connection-scoped deterministic identity; `patente` is an explicit plate and is normalized; `nombre_empresa` is the confirmed stable company scope. `alias`/`nombre` are display labels only.
- Howen: `deviceno` is its connection-scoped deterministic identity; configured Company and `fleetid` scope/bind the record operationally; `devicename` is display-only. The mapper tests explicitly prohibit deriving a plate from it. No independent Howen plate or shared physical-vehicle identifier is exposed.

### Affected Areas
- `domain/catalog/matching.ts` — separates deterministic reuse, trusted matching, and suspicion-only candidate detection.
- `domain/catalog/review.ts` — records the evidence type/value shown to an operator for a vehicle-match review.
- `application/catalog/ports.ts` — makes trusted plate and display-name evidence explicit on normalized import candidates.
- `application/catalog/import-catalog.ts` — routes a reasonable weak cross-provider candidate to review instead of creating a Vehicle.
- `integrations/cybermapa/map-cybermapa-catalog.ts` — marks `patente` as provider-supplied registered-plate evidence.
- `integrations/howen/map-howen-catalog.ts` — continues exposing `devicename` only as display evidence; it must not manufacture a plate.
- `integrations/persistence/mongodb/catalog-documents.ts`, `catalog-validators.ts`, `catalog-migrations.ts`, `catalog-repositories.ts` — persist and validate explicit review evidence, with any required index only if the new query needs it.
- `domain/catalog/matching.test.ts`, `application/catalog/import-catalog.test.ts`, mapper/persistence tests — define the required P1 regression and idempotency cases.

### Approaches
1. **Auto-link by display name or plate-shaped display name** — Treat Howen `devicename` as a plate and link it automatically.
   - Pros: Minimal implementation; resolves the common-looking example automatically.
   - Cons: Unsafe: `devicename` is not a declared plate, can be reused or changed, and the project already rejects that inference. A false merge corrupts the canonical catalog.
   - Effort: Low

2. **Manual cross-provider mapping only** — Create every unknown external identity as a Vehicle and rely on later operator cleanup.
   - Pros: Never auto-merges.
   - Cons: Fails P1 because it still silently creates the duplicate before review and offers no candidate detection.
   - Effort: Low

3. **Evidence-tiered matching with review-first weak candidates** — Preserve deterministic identity reuse; auto-link only a unique, Company-scoped explicit registered plate; send display-name/plate-shaped-name candidates to an idempotent review; create a Vehicle only when no strong or reasonable weak candidate exists.
   - Pros: Keeps provider data semantics explicit; prevents the Cybermapa/Howen duplicate path from becoming definitive; preserves existing safe plate behavior; uses the existing review-resolution transaction to make the final cross-provider binding atomic and retry-safe.
   - Cons: Howen records without a true shared identifier may require operator review; requires a small explicit evidence contract and review-document migration.
   - Effort: Medium

### Recommendation
Use approach 3.

Introduce provider-neutral identity evidence on `CatalogImportCandidate`: an explicit `registeredPlate` (strong evidence) and existing display label (weak evidence). Cybermapa is the only current adapter that supplies `registeredPlate`; Howen remains unable to supply it from `devicename`.

Matching order:
1. Reuse the exact connection-scoped external identity.
2. Auto-link only when an explicit normalized registered plate finds exactly one active Vehicle in the same organization and bound Company, and the existing same-connection conflict guard permits it.
3. If no strong match exists, detect a weak candidate only when Howen's normalized display name exactly equals a canonical Vehicle's normalized registered plate within that Company. Do not link; create one idempotent `vehicle-match` review carrying explicit `display-name-equals-registered-plate` evidence and candidate IDs.
4. Create a new Vehicle only when neither a strong match nor a reasonable weak candidate exists.

A resolved review binds the Howen identity to the selected existing Vehicle through the existing transactional `ensureBoundToVehicle` flow; future imports then reuse that deterministic identity. Exact label-to-label, partial/fuzzy matches, fleet-name matches, and cross-company/tenant matches remain non-matches. This is deliberately conservative: current Howen data cannot independently prove the physical identity.

Required TDD coverage:
- Cybermapa and Howen external IDs for one physical vehicle: Howen display name matching Cybermapa's stored registered plate creates one review and no second Vehicle; resolving it produces two identities on one Vehicle.
- Unique explicit registered-plate match auto-links.
- Multiple strong or weak candidates create one pending review, including on retry.
- No candidate creates a new Vehicle.
- Similar labels, partial strings, equal fleet names, or a plate-shaped but non-exact label never auto-merge.
- Retried imports and already-bound identities reuse the same Vehicle and do not duplicate identity/review records.

### Risks
- `patente` is currently assumed trustworthy but canonical storage permits duplicate plates; uniqueness plus Company scope and the existing duplicate-to-review rule are mandatory before auto-linking.
- A weak candidate review must not overload the existing `normalizedPlate` field with a display name; evidence must be typed and persisted explicitly so operators know why it was suggested.
- The in-memory fixture and Mongo adapter must preserve the same identity uniqueness/transaction behavior; otherwise concurrent syncs could still race a review resolution.
- This scope cannot auto-link Howen-only records lacking a verified shared identifier; that is the correct safety tradeoff.

### Ready for Proposal
Yes — propose the evidence-tiered matching contract, review metadata migration, and focused TDD coverage. State explicitly that no real APIs or `.env.local` are involved and that the change does not merge or alter unrelated catalog risks.
