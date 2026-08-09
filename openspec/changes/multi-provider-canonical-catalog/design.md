# Design: Multi-provider canonical catalog

## Technical Approach

Add a hexagonal `catalog` slice. Domain owns canonical identity, match transitions, and precedence. Application owns tenant-scoped use cases and ports. MongoDB and Howen implement ports. Existing admin Route Handlers remain thin HTTP adapters; Server Components perform reads. Current live composition stays available behind a projection seam while canonical IDs are introduced.

## Architecture Decisions

| Decision | Choice and rationale | Rejected |
|---|---|---|
| Ownership | Reuse identity `Organization`; avoids a second tenant concept. | Provider/customer ownership |
| Relationships | Reference fleets, vehicles, identities, reviews, candidates, and policy entries; cardinality grows independently and arrays would be unbounded. | Embedded organization/fleet trees |
| Matching | Initial deterministic match is an existing scoped identity or administrator-approved mapping. Howen `devicename` is only a headline; similarity creates review, never an automatic link. | Plate/label auto-merge |
| Atomicity | Fetch/validate the complete roster before writes, then transact one candidate transition. This bounds transactions while retries remain idempotent. | One roster-wide transaction; unordered writes |
| Delivery | Follow existing same-origin, cookie, fresh-admin Route Handler pattern. Next.js 16 request APIs remain async and routes use Node runtime. | UI-owned rules; trusting rendered-page access |
| Cybermapa | Define provider/eligibility ports and defaults only; no payload model or adapter. | Invented `GETVEHICULOS` mapping |

## Data Model and Indexes

Every document has `schemaVersion`, timestamps, and `organizationId`; strict/error JSON Schema validators follow current migrations.

| Collection | Document purpose | Required indexes |
|---|---|---|
| `catalog_fleets` | Canonical fleet | unique `{organizationId,id}`; `{organizationId,status}` |
| `catalog_vehicles` | Canonical vehicle with `fleetId` | unique `{organizationId,id}`; `{organizationId,fleetId,status}` |
| `provider_connections` | Organization/provider source identity; no raw secrets | unique `{organizationId,id}` |
| `external_identities` | Connection-scoped fleet/device identity and optional canonical target | unique `{organizationId,connectionId,entityKind,externalId}`; canonical-target lookup |
| `match_reviews` | `pending|resolved`, source identity, resolution | partial unique pending source identity; `{organizationId,status,createdAt}` |
| `match_review_candidates` | One review/vehicle candidate per document | unique `{organizationId,reviewId,vehicleId}` |
| `capability_policy_entries` | One ordered source selector per scope/capability | unique scope/capability/rank and scope/capability/source |

No collection embeds growing vehicle, identity, candidate, or policy arrays. Multi-document create/link/review and policy replacement use `MongoTransactionRunner`; unique indexes are the concurrency authority, with duplicate-key reread/retry.

## Contracts and State Flow

```text
Admin request -> authorizeAdminRequest -> catalog use case -> catalog ports -> Mongo
Howen client -> candidate mapper -> import use case -> per-candidate transaction
                                             -> linked-existing | linked-new | pending-review
pending-review -> admin decision -> linked-existing | linked-new
```

`CatalogPorts` expose organization-scoped fleet/vehicle, connection, identity, review, policy, transaction, ID, and clock operations. `CatalogImportSource.loadCandidates()` returns provider-neutral candidates; Howen maps only verified `fleetid`, `fleetname`, `deviceno`, `devicename`, channels, GPS, and online state. Application results are discriminated unions for created, forbidden, rejected-record, pending-review, linked, and unavailable outcomes.

Precedence input is `(organizationId, fleetId, vehicleId, capability, eligibleSources)`. The resolver chooses the first level containing entries: vehicle, fleet, organization, system default. It walks rank order, skipping absent, unsupported, stale, or unavailable sources. No eligible source yields unavailable only for that capability. Defaults select Cybermapa for GPS/operational alerts and Howen for video/video alerts; provider-only vehicles may use their sole eligible source.

## File Map and Forecast

| Paths | Action |
|---|---|
| `domain/catalog/{entities,matching,precedence,index}.ts` + tests | Create |
| `application/catalog/{contracts,ports,use-cases,import-catalog,index}.ts` + tests | Create |
| `integrations/persistence/mongodb/{catalog-documents,catalog-repositories}.ts` + tests | Create |
| `integrations/persistence/mongodb/{validators,migrations,index}.ts` | Modify |
| `integrations/howen/{map-howen-catalog-candidates,howen-catalog-source}.ts` + tests | Create |
| `app/api/admin/catalog/{delivery,composition,route}.ts`, `imports/howen/route.ts`, `reviews/[reviewId]/route.ts` + tests | Create |
| `app/admin/catalog/{page,catalog-form}.tsx` + tests | Create |
| `domain/live/entities.ts`, `application/live/contracts.ts` + tests | Modify through projection types; current runtime remains fallback |

Forecast: 31 new files, 5 modified, 0 deleted.

## Testing Strategy

RED: pure domain tests for matching states and every precedence branch; application tests with in-memory ports for authorization, isolation, no rename/move/merge, failures, and retry outcomes. GREEN: minimum contracts/use cases. REFACTOR: remove duplication, then add Mongo replica-set tests for validators, indexes, rollback, duplicate-key races, and concurrent import; adapter tests for verified Howen mapping; delivery/UI tests for same-origin admin flows. Run lint, typecheck, tests, coverage, then build.

## Migration, Failure, and Rollback

Add collections/indexes idempotently; no existing collection changes shape. Import is opt-in and records per-item outcomes. Provider failure before validation writes nothing; database interruption preserves committed candidates and safe retry completes the rest. Keep existing Howen live source until a catalog projection is verified, then switch composition without UI provider branches. Rollback disables catalog routes/import, restores prior live composition, snapshots new collections, and leaves identity data untouched.

## Open Questions

None. No open blocker; cross-provider deterministic identifiers require a later verified rule or administrator decision.
