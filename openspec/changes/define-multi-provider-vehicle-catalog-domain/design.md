# Design: Define Multi-provider Vehicle Catalog Domain

## Technical Approach

Extend the global `domain/catalog` slice. Provider adapters emit provider-neutral candidates; application policies match connection-scoped devices, replace current source state, project canonical vehicle fields, and reconcile eligible legacy plate reviews. MongoDB stores vehicles, devices, contributions, observations, memberships, conflicts, and reviews separately. Placement and authorization remain unchanged.

## Architecture Decisions

| Decision | Alternative / tradeoff | Rationale |
|---|---|---|
| Separate `CatalogVehicle`, `Device`, `ProviderContribution`, and `ProviderVehicleObservation` | Expanding contribution is smaller but conflates equipment, linkage, and mutable facts | Each has a different identity and lifecycle. |
| Match device/contribution by exact `(connectionId, deviceId)` first, then exactly one valid normalized plate, otherwise create | Global device IDs collide; required plates reject valid assets | Existing identity is strongest; unknown plate-less devices remain separate. |
| Reconcile only pending `missing-plate`/`malformed-plate` legacy reviews whose unmodified `externalId` equals candidate `deviceId` | Fuzzy/transformed matching closes more reviews but can merge assets incorrectly | Exact legacy identity is auditable and idempotent; all unsafe reasons remain manual. |
| Resolve the review in the candidate transaction | Post-commit cleanup is simpler but can close without durable linkage | Vehicle, device, contribution, observation, membership, projections, and review must succeed or roll back together. |
| Project fields through injected precedence policies | Last-write-wins is order-dependent | Current observations remain inspectable; disagreement creates or refreshes `CatalogConflict`. |
| Resolve Howen Fleet ancestry in a request-scoped cache | Persisting topology introduces stale provider concepts | A `guid` map supports nearest `contacts`, cycle safety, and explicit outcomes. |

## State Semantics

- Operational status is provider-reported and omission never rewrites it.
- Device/contribution presence reflects the latest confirmed complete connection snapshot.
- An absent contribution retains audit evidence but does not supply canonical fields.
- Vehicle activity is recomputed from any present active device.

## Data Flow

```text
adapter -> candidate -> transaction
  -> load exact device + contribution + pending review
  -> if identity links disagree: preserve links; keep review pending
  -> else reuse linked vehicle, or unique-plate match, or create vehicle
  -> upsert device/contribution -> replace observation/membership
  -> reconcile projections/conflicts -> resolve eligible review -> commit

successful complete snapshot -> separate omission transaction(s)
failed/partial snapshot       -> no absence reconciliation
```

The current early `existingReview => review` branch in `match-and-apply-provider-candidate.ts` becomes reason-aware. Eligible obsolete plate reviews bypass it. Reviews with `missing-placement`, ambiguity, conflicts, group evidence, missing identity, multiple links, or non-exact/transformed identity retain the existing short-circuit. If device and contribution exist but point to different vehicles, neither is rewritten and the review remains pending.

## Interfaces / Contracts

`ProviderCandidate` carries `deviceId` plus device facts, observed vehicle facts, Fleet provenance, resolution outcome, time, and optional creation placement. `DeviceRepository.findByConnectionAndDeviceId` and `ProviderContributionRepository.findByConnectionAndExternalId` provide identity-first lookup. `CatalogReviewRepository.findPendingByExactIdentity` returns at most one review; eligibility is a domain predicate in `domain/catalog/review.ts`. `CatalogVehicleRepository.findAllByNormalizedPlate` supports the exactly-one rule. Observation and membership repositories expose replacement-by-contribution operations. `resolveCatalogReview` remains idempotent.

MongoDB enforces unique `(connectionId, deviceId)`, unique contribution `(connectionId, externalId)`, one current observation and membership per contribution, and one review identity. Add a `{ connectionId, externalId, status }` lookup index. Duplicate-key/write-conflict retries rerun the whole transaction and reuse winning identity records.

## File Changes

| Path | Action |
|---|---|
| `domain/catalog/{device,review,provider-vehicle-observation,catalog-conflict}.ts` | Add contracts, eligibility, and invariants. |
| `application/catalog/{match-and-apply-provider-candidate,reconcile-canonical-vehicle,ports}.ts` | Add atomic identity-first reconciliation. |
| `application/catalog/synchronize-connection.ts` | Keep record-local commits separate from complete-snapshot omission. |
| `integrations/{cybermapa,howen}/*`, `integrations/catalog/sync-source-adapters.ts` | Emit normalized device and observation facts; resolve Howen ancestry. |
| `integrations/persistence/mongodb/catalog-{documents,repositories,initializer,validators,migrations}.ts` | Add storage, indexes, transactions, and backfill. |
| Corresponding `*.test.ts` files | Add RED-first unit, application, adapter, and MongoDB tests. |

## Testing Strategy

| Layer | Coverage |
|---|---|
| Domain | Review eligibility, exact identity, idempotent resolution, optional plates, state separation. |
| Application | Existing device/contribution wins; review-only unique-plate/create; plate-less create; link collision stays pending; unsafe reason stays pending; retry creates no duplicates; partial snapshot does not mark absence. |
| Adapter | Sanitized mappings, device identity, Howen Fleet ancestry and failure outcomes. |
| MongoDB | Indexes, validator round trips, atomic rollback/commit, duplicate-key retry, concurrent candidate processing. |

## Migration / Rollout

Deploy additive collections, validators, and indexes first. Backfill one device per existing contribution using the exact stored `externalId`; preserve vehicle, placement, grants, and known facts, and never infer missing metadata. Leave legacy reviews pending. Feature-gate the new matcher; on each first successful matching candidate it reconciles only its local eligible review. Run Cybermapa then Howen, audit resolved/pending counts and collisions, then retire legacy fields. Rollback disables the matcher while retaining additive data and unresolved reviews.

## Open Questions

None blocking design; final Howen parser acceptance still requires a sanitized `/vss/fleet/findAll.action` fixture.