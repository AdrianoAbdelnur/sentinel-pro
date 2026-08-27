## Exploration: Multi-provider vehicle catalog functional and domain outcome

### Current State

Sentinel Pro already has a provider-neutral global catalog, but its persisted contract is too narrow for the requested result. `CatalogVehicle` requires a plate and stores only identity plus placement. `ProviderContribution` is keyed by `(connectionId, externalId)` and links many provider identities to one vehicle, but stores only capabilities and presence. There is no catalog device entity, canonical or observed company field, provider-observed vehicle metadata, company-conflict record, or Howen Fleet-company resolution result.

The existing identity seam is still valuable: provider contribution identity is resolved before plate matching, exact normalized plate can link different providers, and complete snapshots can mark an omitted contribution absent without deleting the canonical vehicle. However, current behavior conflicts with the request in several material ways:

| Requested outcome | Verified current behavior |
|---|---|
| Plate is optional and a valid device identity creates a normal vehicle | Missing or malformed plate creates a `missing-plate`/`malformed-plate` review and no vehicle |
| Howen uses `plateno` as plate | The parser does not expose `plateno`; the mapper treats `devicename` as plate evidence |
| Device identity and metadata are durable | `externalId` represents the provider identity, but no Device stores kind, make, model, status, or its own internal identity |
| Provider observations and canonical vehicle attributes are durable | Vehicle and contribution contracts omit names, makes, models, observed companies, and observed plates |
| Howen Fleet contacts resolves company on every full import | The client fetches only `/vss/vehicle/findAll.action`; no Fleet endpoint, Fleet tree parser, parent traversal, or company resolution exists |
| Company disagreement is visible | No canonical-company policy or conflict model exists |
| Fleet/company changes replace current provider observations | Contribution refresh updates capabilities and presence only; old fleet memberships can remain alongside new membership evidence |

The repository also contains overlapping SDD history. `multi-provider-canonical-catalog` and `fix-howen-fleet-catalog-import` describe the removed organization-owned `Company -> Fleet -> Vehicle` structure. The archived `repair-global-provider-catalog` and the applied `define-canonical-catalog-model` establish the current direction: global physical-vehicle identity, provider contributions, provider fleet metadata, and tenant visibility through assignments. The new change must extend that surviving global model, not resurrect the parallel tenant/company-owned catalog.

The current main specs also conflict directly with the new requirement: `external-identity-linking` sends missing plate evidence to review, while the requested behavior requires ordinary creation from a valid provider-scoped device identity. `provider-company-binding` removed canonical company ownership but allows provider company metadata; the requested canonical company therefore needs a new explicit business concept that remains separate from identity `Organization` and tenant authorization.

Legacy review persistence creates a migration trap. `catalog_reviews` has a unique `(connectionId, externalId)` index and the matcher returns a pending review before creating a contribution when none exists. Therefore a `missing-plate` or `malformed-plate` review-only record remains pending forever under the current flow even after a later candidate supplies a trustworthy device identity. If a contribution already exists, the matcher reuses its vehicle but does not resolve a pending legacy review. The review already carries the exact seam needed for safe migration: its `externalId` can map to the new `deviceId`, but only within the same `connectionId`.

The behavioral reference project validates `deviceno`, `devicename`, `devicetype`, `fleetid`, and `/vss/vehicle/findAll.action`, but it does not implement or validate `/vss/fleet/findAll.action`, `contacts`, or parent Fleet traversal. Those Fleet rules come from the requested contract and must be covered by adapter contract tests before production implementation.

### Affected Areas

- `domain/catalog/catalog-vehicle.ts` — make plate optional and add canonical vehicle attributes and lifecycle semantics without coupling identity to a provider.
- `domain/catalog/provider-contribution.ts` — retain current provider observation, device linkage, company observation, status, and source timestamps instead of only capabilities/presence.
- `domain/catalog/provider-fleet-membership.ts` — preserve direct Howen Fleet identity and enough resolution provenance to explain which Fleet supplied the company.
- New `domain/catalog/device.ts` and company/conflict contracts — represent one physical vehicle with multiple devices and distinguish canonical company from provider-observed company.
- `application/catalog/match-and-apply-provider-candidate.ts` — keep contribution identity first, match new identities by a unique normalized plate only when present, create normal vehicles without plates, and stage only genuine ambiguous/conflicting merge evidence.
- `domain/catalog/review.ts` and `application/catalog/ports.ts` — distinguish obsolete legacy plate reviews from active merge/placement reviews and support an idempotent resolve-by-identity operation.
- `application/catalog/synchronize-connection.ts` and ports — reconcile mutable observations, current membership, device presence/status, and canonical projections after complete snapshots.
- `integrations/cybermapa/responses.ts` and `seed-cybermapa-catalog.ts` — map `gps_id` to provider device identity and preserve company, vehicle name/make/model, device metadata, status, and capabilities.
- `integrations/howen/client.ts`, `responses.ts`, and `seed-howen-catalog.ts` — fetch Fleets before vehicles, parse `plateno`, `deviceModel`, `devicetype`, resolve `contacts` through `parentid`, and stop treating `devicename` as registered-plate evidence.
- `integrations/persistence/mongodb/catalog-*` — persist optional plate, devices, provider observations, current Fleet resolution, conflicts, and replacement/absence semantics with connection-scoped uniqueness.
- `integrations/persistence/mongodb/catalog-{repositories,initializer,migrations}.ts` — preserve unique connection-scoped identities and resolve a legacy review in the same transaction as its device/contribution/vehicle reconciliation.
- `openspec/specs/canonical-vehicle-catalog`, `external-identity-linking`, `provider-company-binding`, `provider-fleet-binding`, `cybermapa-catalog-import`, `howen-catalog-import`, and `catalog-synchronization` — modify or supersede conflicting requirements rather than adding a disconnected parallel specification.
- `openspec/changes/define-canonical-catalog-model` and the older active catalog changes — their surviving global-model decisions must be preserved, while obsolete missing-plate and company/fleet behavior must not remain simultaneously normative.

### Approaches

1. **Extend the surviving global catalog with explicit Device and provider-observation concepts** — keep one global `CatalogVehicle`; link provider-scoped devices and mutable observations to it; derive canonical fields through provider-neutral reconciliation policy.
   - Pros: Preserves the tested identity/synchronization foundation, cleanly separates vehicle, device, source observation, tenant access, and provider details; supports missing plates and future providers.
   - Cons: Requires coordinated domain, persistence, adapter, matching, conflict, and synchronization changes; existing specs must be carefully rewritten to remove contradictions.
   - Effort: High.

2. **Expand `ProviderContribution` into the device and observation record** — treat each contribution as one device plus all provider-observed vehicle/company fields.
   - Pros: Smaller conceptual and persistence change; aligns with the current `(connectionId, externalId)` identity seam and the initial one-device-per-provider payloads.
   - Cons: Conflates a physical device with a synchronization observation, makes future provider records without a device or multiple observations per device awkward, and obscures different lifecycles for device status, source presence, and observed vehicle facts.
   - Effort: Medium.

3. **Restore the older Company/Fleet-owned catalog and bind provider records into it** — revive the structure described by `multi-provider-canonical-catalog` and `fix-howen-fleet-catalog-import`.
   - Pros: Canonical company and fleet placement appear directly in the aggregate.
   - Cons: Recreates the parallel model intentionally removed by the canonical consolidation, risks mixing business company with auth tenant, and makes provider topology own vehicle identity/placement again.
   - Effort: High and architecturally regressive.

For legacy reviews, two migration mechanisms are possible:

1. **Reconcile opportunistically inside normal candidate matching** — when the first post-rollout candidate matches a pending legacy plate review by exact `(connectionId, legacy externalId -> deviceId)`, apply the normal device/vehicle path and resolve that review in the same transaction.
   - Pros: Uses current provider evidence, naturally enriches the result, avoids a separate one-time batch, and converges on repeated imports.
   - Cons: A review remains pending until its device appears again.
   - Effort: Medium.

2. **Run a one-time review migration before imports** — scan pending reviews and create records from legacy review data alone.
   - Pros: Processes all reviews immediately.
   - Cons: Review-only rows lack the fresh provider facts needed to build a trustworthy device/vehicle, encourage guessed metadata, and require separate recovery/checkpoint machinery.
   - Effort: High and unsafe for incomplete evidence.

### Recommendation

Use approach 1 and treat this change as a deliberate evolution of the definitive global catalog.

The target model should distinguish four concepts:

1. `CatalogVehicle`: Sentinel `vehicleId`, optional canonical plate, canonical name/make/model, canonical company association, active/inactive state, and stable placement/group data.
2. `Device`: Sentinel device record linked to one vehicle, with provider connection, provider `deviceId`, kind, make/model, status, capabilities, and presence. Its durable natural identity is `(connectionId, deviceId)`; a bare provider identifier is not globally safe across accounts.
3. `ProviderVehicleObservation`: mutable current facts reported by one provider contribution, including observed company, plate, name, vehicle make/model, direct Fleet identity, company-source Fleet identity, resolution provenance, and observation time. Company is vehicle-level evidence; it is not a primary Device property even when the observation is reached through a device record.
4. `CatalogConflict`: an explicit unresolved/resolved discrepancy such as different current company observations, retaining both source values and the canonical-policy outcome.

Matching order should be deterministic: reuse `(connectionId, deviceId)` first; otherwise use one trustworthy exact normalized plate match; otherwise create a new vehicle even when plate is absent, provided `deviceId` is valid. Two unknown plate-less contributions never auto-link. If an already-linked plate-less vehicle later gains a plate that points to another vehicle, retain both identities and raise merge review rather than silently merging.

Canonical company reconciliation should be provider-neutral and policy driven, with Cybermapa before Howen as the initial configured order. Every non-empty current provider company remains visible. Differing normalized company observations create or refresh a conflict; priority selects the main value but never erases or hides the disagreement. Identity `Organization` and `OrganizationVehicleAccess` remain authorization/disclosure concepts and are not the business company.

Every full Howen import should load `/vss/fleet/findAll.action` once before vehicle mapping, build a request-scoped `guid` index, and resolve company from the vehicle's direct Fleet `contacts` or the nearest ancestor with non-empty `contacts`. Traversal needs cycle detection, missing-parent handling, trimming, and deterministic nearest-ancestor behavior. Persist the direct Fleet reference, the Fleet that supplied `contacts`, and the resolved company observation; do not persist the transient Fleet cache as a standalone catalog collection. `contacts` has this company meaning only inside the Howen adapter.

Synchronization should replace each provider's current observation and current Fleet relationship, not append stale values. A complete successful omission marks only that device/contribution absent; the vehicle remains. Canonical active state should be derived by an explicit rule from current linked-device presence/status rather than copied from whichever provider ran last. Canonical name, plate, make/model, and company need the same deterministic reconciliation discipline, while provider observations remain independently inspectable.

Legacy `missing-plate` and `malformed-plate` reviews should use opportunistic transactional reconciliation. Eligibility is deliberately narrow: the pending review must belong to the candidate's exact `connectionId`, its legacy `externalId` must deterministically map to exactly the candidate `deviceId`, and no competing device/contribution mapping may exist. Plate, name, make, model, company, or Fleet labels are enrichment evidence, never substitutes for this identity proof.

The transaction should handle two normal cases:

- **Existing device or contribution:** reuse its existing `vehicleId`, replace current facts through the normal import path, and resolve the obsolete legacy review to that vehicle. A new plate match must not relink it.
- **Review-only identity:** run normal new-device matching; use exactly one trustworthy plate match when available, otherwise create a separate vehicle, then persist device, contribution, observation, and the resolved review together.

If the review identity is blank after normalization, maps to multiple candidates, requires a non-deterministic legacy transformation, conflicts with an existing device/contribution link, or points to multiple possible vehicles, it remains pending for manual handling. Genuine `ambiguous-match`, `conflicting-identity`, placement, and group-evidence reviews are not auto-closed by this migration rule.

The operation must be idempotent. Unique `(connectionId, deviceId)` and contribution identity indexes prevent duplicate source records; the existing review row is resolved in place; an already resolved review is a no-op; and a retry first reuses the committed device/contribution before considering vehicle creation. Duplicate-key or transaction conflicts should retry the whole decision, not only the final write. The review MUST NOT be resolved unless the selected vehicle and all required identity records commit in the same MongoDB transaction. This makes the first successfully processed post-rollout candidate self-heal the legacy row without requiring the overall snapshot to be complete; complete-snapshot proof remains required only for absence reconciliation.

### Risks

- Active and main SDD artifacts currently encode contradictory ownership and missing-plate rules; adding requirements without explicit MODIFIED/REMOVED deltas would leave no single source of truth.
- The requested Howen Fleet response shape and endpoint are not validated by the reference code; parser fixtures or a sanitized captured response are required before implementation.
- Provider status, device make, and vehicle make are not consistently available; optional fields and explicit normalization rules are required to avoid inventing data.
- Plate mutation can reveal that two existing canonical vehicles are the same; this requires merge review semantics beyond ordinary first-import matching.
- A company name is mutable evidence, not a durable company identity. Name normalization may detect disagreement but must not silently merge legal/business entities.
- Reusing a bare `(provider, deviceId)` across multiple credentials can collide; connection-scoped identity is safer and must remain the persistence key.
- Current membership persistence can accumulate stale Howen Fleet relationships unless reconciliation replaces or versions the current membership.
- Vehicle active/inactive, device operational status, and snapshot presence are different states; collapsing them would produce false deactivation or false availability.
- Resolving a legacy review outside the candidate transaction could leave a closed review with no durable vehicle/device link after partial failure.
- Any normalization that makes two legacy `externalId` values map to one `deviceId` must be treated as ambiguous rather than deduplicated silently.
- A pre-existing contribution whose `vehicleId` conflicts with fresh plate evidence requires merge review; legacy cleanup must not become an implicit vehicle merge.
- The scope crosses domain, adapters, persistence, synchronization, conflict review, and specs and is likely above the 400-line review budget; tasks should plan chained work units.

### Ready for Proposal

Yes. The proposal and downstream artifacts should explicitly preserve the global canonical model, define Device and provider-observation boundaries, supersede missing-plate review behavior, and require idempotent transactional reconciliation of safely identifiable legacy plate reviews. They must leave ambiguous identities manual and keep Howen Fleet `contacts` resolution plus canonical-company conflict handling as first-class capabilities. No implementation should begin until the proposal, delta specs, design, and review-sized tasks agree on those boundaries.
