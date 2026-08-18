# Tasks: Consolidate the Canonical Catalog

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated logical changes | At most 400 lines; no new functionality |
| Mechanical churn | Renames and covered deletions measured separately |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Base boundary |
|---|---|---|
| 1 | Characterize the surviving slice | Feature/tracker branch |
| 2 | Retarget consumers while `catalog-global` remains stable | Unit 1 branch |
| 3 | Remove the unreferenced parallel slice | Unit 2 branch |
| 4 | Apply definitive names and validate | Unit 3 branch |

## Phase 1: Characterize Existing Behavior

- [x] 1.1 Run the current tests for `domain/catalog-global/**`, `application/catalog-global/**`, `integrations/catalog/**`, `integrations/persistence/mongodb/catalog-global-*`, admin review routes, synchronization routes, import, and Live projection.
- [x] 1.2 Add only missing regression assertions required to protect current matching, placement, contributions, checkpoints, leases, manual reviews, access filtering, and Live projection before dependency changes.
- [x] 1.3 Verify `app/api/admin/import/**` already composes the surviving canonical behavior; change no import behavior.

## Phase 2: Retarget Consumers to the Surviving Slice

- [x] 2.1 Retarget `app/api/admin/catalog/**` and `app/admin/catalog/**` review/status consumers to `application/catalog-global/**`; preserve existing authorization and review decisions.
- [x] 2.2 Retarget `app/api/internal/catalog/synchronize/**` and `integrations/catalog/**` adapters to the same synchronization contracts; preserve provider mapping, matching, checkpoint, and lease behavior.
- [x] 2.3 Wire `application/live/project-global-catalog-live.ts` into `app/live/**` as the production catalog source; preserve organization-grant filtering and the provider-neutral Live output.
- [x] 2.4 Run focused route, adapter, synchronization, review, import, and Live regression tests; prove the organizational slice has no remaining production consumers.

## Phase 3: Remove the Parallel Organizational Slice

- [x] 3.1 Delete displaced `domain/catalog/**`, `application/catalog/**`, and Mongo repositories that implement organization-owned `Company/Fleet/Vehicle`, company binding, or `Unassigned` placement.
- [x] 3.2 Delete their routes, admin components, compatibility loader, conversion/backfill modules, unused import-item contracts, and tests that assert only removed behavior.
- [x] 3.3 Search the repository for imports of removed modules and run focused tests before any surviving-file rename.

## Phase 4: Apply Definitive Names

- [ ] 4.1 Use `git mv` to rename `domain/catalog-global/**` and `application/catalog-global/**` to their final `catalog/**` paths; update imports without changing rules.
- [ ] 4.2 Use `git mv` for `integrations/persistence/mongodb/catalog-global-*`; rename constants to the definitive unversioned collections listed in `design.md` and initialize only those collections.
- [ ] 4.3 Rename the surviving Live projector and replace versioned admin/internal route paths with definitive unversioned paths; update tests mechanically.
- [ ] 4.4 Search production code for `catalog-global`, `global-catalog`, `_v2`, `/v2`, `legacy`, migration, compatibility, duplicate collections, and parallel ownership; retain references only in explicit exclusion history.

## Phase 5: Validate

- [ ] 5.1 Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:coverage`, and `npm run build`.
- [ ] 5.2 Run strict OpenSpec validation; inspect `git diff --stat` and report logical edits separately from rename/deletion churn.
