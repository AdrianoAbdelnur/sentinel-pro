# Tasks: Consolidate the Canonical Catalog

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 150-400 logical; mechanical renames/deletions exceed 400 and are measured separately |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Baseline and canonical rename -> consumer retargeting -> covered removal |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Verification boundary |
|---|---|---|
| 1 | Characterize behavior and rename the active global model | Catalog, synchronization, adapter, and Mongo tests pass |
| 2 | Retarget import, review, routes, and Live | Route and Live regression tests pass without behavior changes |
| 3 | Remove covered parallel paths | Full validation proves one model and schema |

## Phase 1: Lock the Active Behavior

- [ ] 1.1 Run and record the existing tests for `domain/catalog-global/**`, `application/catalog-global/**`, `integrations/catalog/**`, `integrations/persistence/mongodb/catalog-global-*`, import routes, review routes, and `application/live/project-global-catalog-live.test.ts`.
- [ ] 1.2 Add only missing characterization assertions needed to protect current matching, group placement, multi-provider contributions, checkpoint retries, leases, reviews, access grants, and Live projection before files move.

## Phase 2: Promote the Canonical Model

- [ ] 2.1 Use `git mv` to rename `domain/catalog-global/**` to `domain/catalog/**` and `application/catalog-global/**` to `application/catalog/**`; resolve displaced parallel files without altering retained rules.
- [ ] 2.2 Use `git mv` to rename `integrations/persistence/mongodb/catalog-global-*` and replace versioned collection constants with `catalog_groups`, `catalog_vehicles`, `provider_contributions`, `provider_fleet_memberships`, `group_evidence_bindings`, `organization_vehicle_access`, `catalog_reviews`, `catalog_runs`, and `catalog_leases`.
- [ ] 2.3 Retarget `integrations/catalog/**`, Cybermapa, and Howen adapters to the renamed contracts; run the Phase 1 tests after each logical move.

## Phase 3: Retarget Existing Consumers

- [ ] 3.1 Retarget `app/api/admin/import/**`, `app/api/admin/catalog/**`, and `app/api/internal/catalog/synchronize/**` to the canonical composition and definitive unversioned routes.
- [ ] 3.2 Retarget the existing pending/resolve manual-review flow and admin UI to the same canonical review contracts; add no subjects, fields, decisions, or workflows.
- [ ] 3.3 Rename and wire `application/live/project-global-catalog-live.ts` as the production canonical projector used by `app/live/**`; preserve organization filtering and the Live output contract.

## Phase 4: Remove Covered Parallel Paths

- [ ] 4.1 Delete the displaced organization-owned `Company/Fleet/Vehicle` stack, versioned routes/collections, migration/backfill modules, compatibility loader, unused import-item contracts, and tests that assert only removed behavior.
- [ ] 4.2 Search production code and SDD targets for remaining `catalog-global`, `global-catalog`, `_v2`, `/v2`, `legacy`, migration, compatibility, duplicate collection, or parallel ownership references; allow them only in explicit exclusion history.

## Phase 5: Validate

- [ ] 5.1 Run focused tests after every phase, then `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:coverage`, and `npm run build`.
- [ ] 5.2 Run strict OpenSpec validation and inspect `git diff --stat`; confirm logical edits stay at or below 400 lines and report mechanical rename/deletion churn separately.
