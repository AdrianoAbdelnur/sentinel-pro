# Design: Prevent Cross-Provider Vehicle Duplicates

## Technical Approach

Add provider-neutral evidence tiers to catalog import. Keep exact connection identity reuse first; auto-link only a unique, Company-scoped **explicit registered plate**. When a trusted plate cannot prove ownership but an exact normalized display name equals one or more stored registered plates, create or reuse a typed `vehicle-match` review instead of creating a Vehicle. Review resolution continues using the existing transaction and `ensureBoundToVehicle`.

## Architecture Decisions

| Decision | Choice | Alternative rejected | Rationale |
|---|---|---|---|
| Evidence model | Add `registeredPlate?` and retain `label?` as distinct candidate fields; preserve typed vehicle-review evidence. | Treat label/plate-shaped text as a plate. | Howen `devicename` is display-only; collapsing meanings could falsely merge vehicles. |
| Automatic link | Only one active Vehicle in the same organization and bound Company with an exact provider-supplied registered plate; retain same-connection conflict guard. | Name, fleet, fuzzy, or cross-company auto-link. | Cybermapa `patente` is the only current trustworthy cross-provider key. |
| Suspicion handling | Exact normalized Howen display-name-to-canonical-registered-plate equality yields a review with all candidates. | Silently create a Vehicle or infer a Howen plate. | It blocks a definitive duplicate while requiring operator approval. |
| Final binding | Reuse `resolveCatalogReview` transactional `ensureBoundToVehicle` path. | A Vehicle merge workflow. | Existing atomic uniqueness makes approval/retry deterministic. |
| Delivery | Expose neutral typed review evidence in the existing review summary/item. | Provider-specific UI branches. | Operators need the reason; UI remains contract-driven. |

## Data Flow

```text
provider adapter
  -> CatalogImportCandidate { externalId, registeredPlate?, label? }
  -> importCatalog
     -> exact identity? -----------------> reuse existing Vehicle
     -> unique registeredPlate? ---------> bind identity to Vehicle
     -> exact weak label candidate? -----> find-or-create typed review
     -> otherwise ------------------------> create Vehicle + identity
review approval -> transaction(reviews.resolve, ensureBoundToVehicle)
  -> future import -> exact identity reuse
```

Cybermapa maps `gps_id`, `nombre_empresa`, and explicit `patente` to `registeredPlate`; alias/name remains label. Howen maps `deviceno`, bound Company/`fleetid`, and `devicename` only as label. Fleet/company names, labels-to-labels, partial/fuzzy equality, and cross-company values are never match keys.

## File Changes

| File | Action | Description |
|---|---|---|
| `application/catalog/ports.ts` | Modify | Make explicit registered-plate and display evidence distinct on imports. |
| `domain/catalog/matching.ts` | Modify | Resolve deterministic/strong matches separately from weak candidate detection. |
| `domain/catalog/review.ts` | Modify | Add typed vehicle-match evidence without overloading `normalizedPlate`. |
| `application/catalog/import-catalog.ts` | Modify | Stage idempotent weak/ambiguous reviews before new-Vehicle creation. |
| `application/catalog/resolve-catalog-review.ts` | Verify/modify | Preserve atomic binding; new-Vehicle resolution uses actual registered-plate evidence only. |
| `integrations/cybermapa/map-cybermapa-catalog.ts` | Modify | Declare `patente` as explicit registered-plate evidence. |
| `integrations/howen/map-howen-catalog.ts` | Verify/modify | Keep `devicename` as label only. |
| `integrations/persistence/mongodb/catalog-{documents,validators,migrations,repositories}.ts` | Modify | Round-trip/validate typed evidence; existing review key provides idempotency. |
| `app/api/admin/catalog/delivery.ts`, `app/admin/catalog/{review-item,pending-reviews-panel}.tsx` | Modify | Deliver/show evidence generically. |
| matching/import/review/mapper/persistence tests | Modify | Add P1 and storage coverage. |

## Interfaces / Contracts

```ts
type CatalogImportCandidate = {
  externalId: string;
  registeredPlate?: string;
  label?: string;
};

type VehicleMatchEvidence =
  | { kind: "registered-plate"; normalizedValue: string }
  | { kind: "display-name-equals-registered-plate"; normalizedValue: string };
```

Matching distinguishes `reused`, `auto-linked`, `review`, and `unmatched`. A review is keyed by existing `organizationId + connectionId + subject + externalId`; retrying never creates another review or identity. Candidate lookup is limited to active Vehicles in the bound Company and organization.

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Domain | Unique strong; ambiguous strong/weak; similar/partial labels never match. | `matching.test.ts` pure fixtures. |
| Application | Different Cybermapa/Howen IDs: weak exact evidence reviews, approval binds one Vehicle; no candidate creates one; retries and bound identity reuse. | Import/review in-memory ports. |
| Integration/persistence | Cybermapa supplies registered plate; Howen never derives it; evidence round-trips/validates. | Mapper and Mongo tests, no APIs/env. |
| Delivery | Evidence summary renders without provider branching. | Existing review component/API tests. |

## Migration / Rollout

No data backfill or Vehicle merge. Add an additive review-evidence document field and validator/migration support. Existing plate reviews need compatible decoded evidence. Pending reviews use the current admin workflow.

## Open Questions

- [ ] Confirm `Vehicle.plate` remains the canonical registered-plate field before choosing the migration compatibility branch.