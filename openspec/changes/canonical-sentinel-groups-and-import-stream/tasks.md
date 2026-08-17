# Tasks: Canonical Sentinel Groups and Resilient Import Streaming

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,800-2,600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 -> PR 2 -> PR 3 -> PR 4 -> PR 5 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Group domain and Mongo persistence | PR 1 | Tracker base |
| 2 | Evidence and placement policy | PR 2 | PR 1 base |
| 3 | Durable V2 execution | PR 3 | PR 2 base |
| 4 | Admin stream and UI | PR 4 | PR 3 base |
| 5 | Regressions and docs | PR 5 | PR 4 base |

## Phase 1: Canonical Group Foundation

- [ ] 1.1 **RED:** Extend `domain/catalog-global/catalog-global.test.ts` for stable IDs, evidence/provenance, authority, ambiguity, label changes, and no auto-rename/delete.
- [ ] 1.2 **GREEN:** Add `sentinel-group.ts`; update `global-vehicle.ts`, `review.ts`, exports, and `application/catalog-global/ports.ts` with group/binding/placement contracts.
- [ ] 1.3 **RED:** Test validators, unique binding indexes, transactions, conservative `legacy-unverified` backfill, and ambiguity reviews in `catalog-global-mongodb.test.ts`.
- [ ] 1.4 **GREEN:** Update Mongo `catalog-global-{documents,validators,repositories,migrations}.ts` and transaction wiring; preserve legacy collections/fields.
- [ ] 1.5 **REFACTOR:** Deduplicate mapping while keeping domain/application provider- and Mongo-free.

## Phase 2: Evidence Matching and Precedence

- [ ] 2.1 **RED:** Extend candidate tests for plate reuse, Howen-only creation, idempotency/no duplicates, both provider orders, and ambiguity.
- [ ] 2.2 **GREEN:** Update `ports.ts` and `match-and-apply-provider-candidate.ts`: authoritative replaces fallback/legacy; fallback never replaces authoritative.
- [ ] 2.3 **GREEN:** Update provider `seed-*-catalog.ts` and `global-sync-source-adapters.ts` to emit Cybermapa company authority or Howen fleet fallback evidence.
- [ ] 2.4 **REFACTOR:** Centralize evidence normalization; keep provider branching in adapters.

## Phase 3: Durable Global Progress

- [ ] 3.1 **RED:** Test stable connection lookup, attempt lineage, checkpoint resume, cumulative totals/counts, retries, and no repeated effects in `synchronize-global-connection.test.ts`.
- [ ] 3.2 **GREEN:** Update synchronization and Mongo sync ports/repositories/documents/validators/indexes to persist lineage, checkpoints, and per-candidate monotonic snapshots.
- [ ] 3.3 **REFACTOR:** Publish persisted progress only; separate attempts from logical lineage.

## Phase 4: V2 Delivery and UI

- [ ] 4.1 **RED:** Test V2-only composition, connection errors, normal/error/cancel, late callback, transport failure, and double finish in `route.test.ts`.
- [ ] 4.2 **GREEN:** Replace legacy `composition.ts`; guard idempotent NDJSON send/finish and detach aborts without cancelling execution in `route.ts`.
- [ ] 4.3 **RED:** Test monotonic UI progress across group changes/reconnect snapshots in `provider-import-screen.test.tsx`.
- [ ] 4.4 **GREEN/REFACTOR:** Render persisted V2 totals/counts; keep current group contextual in `provider-import-screen.tsx`.

## Phase 5: Regression, Documentation, Validation

- [ ] 5.1 Add legacy/V2 regression tests proving `/api/admin/import` writes V2 only and leaves legacy repositories untouched.
- [ ] 5.2 Update architecture/import docs for evidence, precedence, lineage, resume, and transport; preserve proposal exclusions.
- [ ] 5.3 Run lint, typecheck, tests, coverage, and build before verification.
