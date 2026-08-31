# Proposal: Define Multi-provider Vehicle Catalog Domain

## Intent

Evolve the global catalog so one physical vehicle retains multiple provider-scoped devices and observations without mandatory plates or provider-owned identity.

## Scope

### In Scope
- Define vehicle, device, observation, company-conflict, and lifecycle contracts.
- Reuse exact `(connectionId, deviceId)` identity first, then one normalized plate match; otherwise create a vehicle, including without a plate.
- On the first successfully processed post-rollout candidate, reconcile legacy `missing-plate` and `malformed-plate` reviews by exact `(connectionId, legacy externalId/deviceId)` identity.
- Map provider metadata and Howen Fleet ancestry, where `contacts` means company only inside that adapter.
- Replace mutable observations and memberships after complete synchronization without deleting vehicles.

### Out of Scope
- UI, manual merging, and conflict-resolution workflows.
- Auto-resolution of ambiguous, conflicting, transformed, or identity-less legacy reviews.
- Persisting the transient Howen Fleet tree or changing tenant authorization.

## Capabilities

### New Capabilities
- `vehicle-device-catalog`: One-to-many devices with scoped identity, metadata, status, and presence.
- `provider-vehicle-observations`: Source facts, provenance, canonical reconciliation, and disagreement.

### Modified Capabilities
- `canonical-vehicle-catalog`: Optional plate; canonical metadata, company, and active state.
- `external-identity-linking`: Plate-less creation, safe merge review, and exact-identity legacy reconciliation.
- `provider-company-binding`: Separate canonical company, observations, conflicts, and tenant identity.
- `provider-fleet-binding`: Replace membership and retain company-resolution provenance.
- `cybermapa-catalog-import`: Preserve device, vehicle, company, status, and capabilities.
- `howen-catalog-import`: Use `plateno`; resolve nearest non-empty Fleet ancestor `contacts`.
- `catalog-synchronization`: Transactionally reconcile observations, presence, projections, and eligible legacy reviews.

## Approach

Add Device and ProviderVehicleObservation concepts with provider-neutral policies. For an eligible legacy review, reuse its device/contribution vehicle; otherwise run normal safe matching or creation. Commit identity records and review closure atomically. Leave uncertain identities pending and preserve authorization boundaries.

## Affected Areas

- `domain/catalog/*`: catalog and review contracts.
- `application/catalog/*`: matching and reconciliation.
- `integrations/{cybermapa,howen,persistence}/*`: translation and persistence.
- `openspec/specs/*`: normative behavior.

## Risks

- **Historical conflicts (High):** explicit deltas supersede obsolete rules.
- **Unverified Howen Fleet payload (Medium):** require sanitized fixtures and adapter tests.
- **Silent merge (Medium):** require unique identity; retain conflicts and merge review.
- **Premature review closure (Medium):** close only in the candidate transaction; retries reuse committed identity.

## Rollback Plan

Revert these artifacts before implementation. Delivery requires reversible migrations and feature-gated synchronization.

## Dependencies

- Verified Howen Fleet fixtures and existing catalog contracts.

## Success Criteria

- [ ] Specs define identities, optional plates, observations, reconciliation, and conflicts consistently.
- [ ] Eligible legacy reviews self-heal idempotently; unsafe reviews remain pending.
- [ ] Provider mappings are deterministic and provider-contained.
- [ ] Tenant authorization and global placement remain unchanged.
