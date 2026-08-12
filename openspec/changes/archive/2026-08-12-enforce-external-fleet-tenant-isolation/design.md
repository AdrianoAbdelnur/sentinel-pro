# Design: Enforce external tenant isolation

## Technical Approach

Add immutable-looking authorization data to `ProviderConnection`: target `companyId`, authorized external fleet IDs, and authorized external vehicle IDs. A provider-neutral snapshot guard filters candidates before `ImportCatalog`; no unauthorized candidate reaches company staging, matching, review, or persistence.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Master credentials | Shared `credentialRef` is allowed | Authorization is data-scoped, not secret-scoped. |
| Howen boundary | `externalFleetId` (`fleetid`) | The mapped provider record supplies it. |
| Cybermapa boundary | Candidate `externalId` (`gps_id`) | The observed contract has no verified fleet field. |
| Default | Deny | Legacy/missing authorization imports nothing. |

## Data Flow

`master snapshot -> connection authorization guard -> ImportCatalog -> canonical catalog`

## File Changes

| File | Action | Description |
|---|---|---|
| `domain/catalog/company-candidate.ts` | Modify | Add connection authorization contract. |
| `application/catalog` | Modify | Guard snapshots before import. |
| `integrations/persistence/mongodb/catalog-*` | Modify | Persist and validate allowlists. |
| tests | Modify | Prove shared-master isolation and idempotency. |

## Testing Strategy

Unit tests run two Company connections with the same credential and mixed snapshots; persistence tests prove list round-trip and validation.
