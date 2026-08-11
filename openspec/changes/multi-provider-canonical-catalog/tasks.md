# Tasks: Multi-provider canonical catalog

## Review Workload Forecast

Estimated lines: 6,500-9,000. Delivery: auto-chain.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

PR1 targets tracker; successors target predecessors; <=400 lines each.

17 PRs: core; Company binding; Fleet union; matching; precedence; Mongo hierarchy; Mongo identities; Cybermapa contract/import; Howen; sync orchestration; run/lease; cron; admin API/status; Spanish UI; live; docs/quality.

## Phase 1: Core

- [x] 1.1 **RED:** Test isolation, provider/native Vehicles, `Unassigned`, placement, durable existence [`canonical-vehicle-catalog`].
- [x] 1.2 **GREEN/REFACTOR:** Add Organization/Company contracts under `domain/catalog/` and `application/catalog/`.
- [x] 1.3 **RED:** Test Company candidate scope/repetition, admin binding, no identity creation [`provider-company-binding`].
- [x] 1.4 **GREEN/REFACTOR:** Add credential references in `bind-provider-company.ts`.
- [x] 1.5 **RED:** Test many-to-one Fleets, name rejection, review, union, enrichment, retention, placement conflict [`provider-fleet-binding`].
- [x] 1.6 **GREEN/REFACTOR:** Add `domain/catalog/{fleet-binding,union-projection}.ts` and reviews.
- [x] 1.7 **RED:** Test vehicle identity reuse, Company plate outcomes/conflicts, forbidden names, review [`external-identity-linking`].
- [x] 1.8 **GREEN/REFACTOR:** Add `domain/catalog/matching.ts` and vehicle review.
- [x] 1.9 **RED:** Test capability independence, five levels, fallback, defaults, absence, unavailability [`capability-source-precedence`].
- [x] 1.10 **GREEN/REFACTOR:** Add `domain/catalog/precedence.ts` and `SetCapabilityPolicy`.

## Phase 2: MongoDB

- [x] 2.1 **RED:** Replica-set test validators, indexes, Company `Unassigned` uniqueness.
- [x] 2.2 **GREEN/REFACTOR:** Add hierarchy/connection Mongo persistence/migrations.
- [x] 2.3 **RED:** Test identity uniqueness, many-to-one lookup, presence, reviews, policies, checkpoints.
- [x] 2.4 **GREEN/REFACTOR:** Add identity/review/policy/import Mongo repositories.
- [x] 2.5 **RED:** Test active-run uniqueness, lease claim/expiry, last-success, counts, crashes, absence indexes [`catalog-synchronization`].
- [x] 2.6 **GREEN/REFACTOR:** Add run/lease documents, repositories, validators, indexes, migrations.

## Phase 3: Providers

- [x] 3.1 **RED:** Test observed Cybermapa fields, scoped `gps_id`, no Fleet identity [`cybermapa-catalog-import`].
- [x] 3.2 **GREEN/REFACTOR:** Add Cybermapa client, mapper, source, credentials.
- [x] 3.3 **RED:** Test 5,542 candidates, binding, duplicate plates, resume, `Unassigned`, order/placement.
- [x] 3.4 **GREEN/REFACTOR:** Add batching/checkpoints in `application/catalog/import-catalog.ts`.
- [x] 3.5 **RED:** Test Howen fields, partial union, enrichment, retention, omission, concurrency, failure [`howen-catalog-import`].
- [x] 3.6 **GREEN/REFACTOR:** Add Howen mapper/source via shared contracts.

## Phase 4: Synchronization

- [x] 4.1 **RED:** Inject clock; test initial sync, six-hour boundary, freshness skip, shared outcomes, exclusion, isolation/retry, successful-full-snapshot-only reconciliation, failed/partial-preservation [`catalog-synchronization`].
- [x] 4.2 **GREEN/REFACTOR:** Add shared sync/due/status use cases; reuse `ImportCatalog`.
- [x] 4.3 **RED:** Test invalid cron secret, non-disclosure, connection isolation, retryable failure.
- [x] 4.4 **GREEN/REFACTOR:** Add internal sync Route Handler and constant-time authorization. `ProviderConnectionRepository.listAll()` added (enabled-as-existence decision, intentionally tenant-unscoped and pinned by test — see apply-progress). Composition root at `app/api/internal/catalog/synchronize/composition.ts` resolves the provider adapter server-side from `credentialRef`; only Cybermapa is wired to a real adapter today, Howen connections surface as an explicit `unsupported-provider`/`permanent:true` outcome, distinguishable in the response from a merely nonexistent connection — see task 5.2b for closing that gap. Risk #15 closed in `synchronize-catalog-connection.ts`. Carried-forward risks #16, #17, #18 recorded in apply-progress.

## Phase 5: Delivery and Live

- [ ] 5.1 **RED:** Test same-origin/fresh-admin, bindings, reviews, manual sync, exclusion, status/counts. PARTIAL: reviews (list + resolve) covered in `application/catalog/resolve-catalog-review.test.ts` and `app/api/admin/catalog/catalog-admin.test.ts`, closing carried-forward risk #3 with mutation proof (both directions, fleet-binding and vehicle-match). Bindings, manual sync, and status tests are NOT yet written — see note on 5.2.
- [ ] 5.2 **GREEN/REFACTOR:** Add thin `app/api/admin/catalog/**` routes. PARTIAL — closes risk #3 only: `app/api/admin/catalog/reviews/route.ts` (list pending reviews) and `app/api/admin/catalog/reviews/[reviewId]/resolve/route.ts` (resolve a fleet-binding or vehicle-match review to an existing Fleet/Vehicle in the bound Company, with fresh-admin auth, tenant scoping, non-disclosure, and CAS-backed exactly-once resolution). New `application/catalog/resolve-catalog-review.ts` (`resolveCatalogReview`, `listPendingCatalogReviews`) supplies the previously-missing authorized-admin enforcement for fleet-binding and vehicle-match review resolution that risk #3 flagged as unenforced anywhere in the codebase. Company binding's authorization was already closed by the pre-existing `bindProviderCompany` (tested in `bind-provider-company.test.ts`), so this slice did not need to add new auth logic there — only its admin HTTP route is still pending. Deferred to a follow-up PR under the same 400-line budget, still within 5.1/5.2: (a) `POST /api/admin/catalog/companies/candidates/[candidateId]/bind` route wiring `bindProviderCompany`; (b) `POST /api/admin/catalog/connections/[connectionId]/sync` route wiring `SynchronizeCatalogConnection` (manual trigger, mutual exclusion via the existing lease, unsupported-provider handling); (c) `GET /api/admin/catalog/connections/[connectionId]/status` route wiring `GetCatalogSyncStatus`; (d) resolving a review to a newly created Vehicle/Fleet (`ReviewResolutionTarget` was deliberately narrowed to `{ targetId: string }` only, existing-target resolution, to fit budget — "new" creation dropped for this slice, not implemented, not silently assumed). Reason for the split: application-layer authorization code (contracts.ts/ports.ts/resolve-catalog-review.ts) plus its mutation-proof test suite plus the two review routes and their wiring already reached 388 changed lines on their own; adding bindings+sync+status+"new" creation was estimated at another 250-350 lines, which would have exceeded the 400-line budget by roughly 1.5-2x.
- [ ] 5.2b **GREEN/REFACTOR:** Wire Howen to automatic cron synchronization — add the per-connection company-assignment domain field (or equivalent), its Mongo document/validator/migration, and cron composition wiring in `app/api/internal/catalog/synchronize/composition.ts` so Howen connections resolve to a real `CatalogImportSource` instead of `unsupported-provider` [`catalog-synchronization`, `howen-catalog-import`]. Closes carried-forward risk #16.
- [ ] 5.3 **RED:** Test Spanish states, `Sync now`, freshness, counts, failures, accessibility.
- [ ] 5.4 **GREEN/REFACTOR:** Build focused `app/admin/catalog/**` UI.
- [ ] 5.5 **RED:** Test union projection, canonical identity, source-local capability loss, and fallback [`live-core-contracts`].
- [ ] 5.6 **GREEN/REFACTOR:** Add `project-canonical-live.ts` and switched live composition.

## Phase 6: Release

- [ ] 6.1 Update docs `03`, `05`, cron environment: cadence, security, rollout/rollback.
- [ ] 6.2 Run lint, typecheck, tests, coverage, build; record <=400-line diffs.
