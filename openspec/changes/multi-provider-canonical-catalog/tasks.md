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

- [x] 5.1 **RED:** Test same-origin/fresh-admin, bindings, reviews, manual sync, exclusion, status/counts. COMPLETE (3rd pass): all five route groups (list/resolve reviews, company-candidate binding, manual sync, sync status) are covered with mutation proof, closing carried-forward risk #3 fully. Status/counts is now covered by `GET /api/admin/catalog/connections/[connectionId]/status`, wired to the already-tenant-scoped, already-allowlist-projected `GetCatalogSyncStatus` (not widened). The freshness call-count assertion now spans all five routes (list, resolve, bind, sync, status).
- [x] 5.2 **GREEN/REFACTOR:** Add thin `app/api/admin/catalog/**` routes. COMPLETE (3rd pass) — closes the remaining gap from the 2nd pass plus a fresh-context review's four findings: (a) `GET /api/admin/catalog/connections/[connectionId]/status` wiring `GetCatalogSyncStatus` (blank-connectionId → 400, not-found/cross-tenant → 403 non-disclosure, found → 200 with the already-allowlisted `CatalogSyncStatus`, all mutation-proven). (b) **Bug fix**: the new-Vehicle path in `resolve-catalog-review.ts` was creating a Vehicle with no `plate`, even though `VehicleMatchReview.normalizedPlate` was available — `toActiveCompanyVehicle` (`import-catalog.ts`) excludes any vehicle with `plate === undefined` from the plate-matching candidate pool, so an admin-created Vehicle was permanently invisible to future automatic plate matching (same class of bug PR #25 fixed for the import path). Fixed by carrying `plate: review.normalizedPlate` through, mutation-proven. (c) Added a `fleetIdentities.save` call-count spy and mutation-proved a duplicate-write blind spot that a plain `.get()` assertion could not catch (a fixed-key, pure-function write is invisible to state-based assertions on a duplicate call — the same shape already caught and fixed for `vehicles.save` in the 2nd pass). (d) Two small coverage gaps closed: a genuinely nonexistent `targetId` on an otherwise-pending, correctly-scoped vehicle-match review (previously only cross-company and already-resolved-plus-missing were tested, and the latter is short-circuited earlier by the status guard — dropping the `vehicle &&` short-circuit would have thrown uncaught for this exact input, now caught); a blank `candidateId` test for the bind route (both sibling routes already had one, this one didn't). Reviewer-verified this pass: the kept `review.status !== "pending"` guard (2nd pass) is correct — the reviewer traced that the org-scope check at line 28 runs strictly before it, so cross-tenant opacity is unaffected either way, and confirmed the prior "removal changes zero test outcomes" claim was factually wrong. The Vehicle-only resolution-to-new + fleet-binding-rejects-new design (2nd pass) was independently confirmed against both specs, and reusing HTTP 400 for the unsupported case was confirmed consistent (zero existing 422 usage in this codebase). **RISK #22 (new, recorded, not fixed):** `app/api/admin/catalog/composition.ts` now imports from `app/api/internal/catalog/synchronize/composition.ts` (for `resolveConnectionSource`/`createDefaultConnectionSourceFactories`) — two delivery composition roots now depend on each other. Not a behavior bug; shared provider-resolution logic arguably belongs outside either route's composition file. A consolidation candidate for slice 17. Also: `createDefaultConnectionSourceFactories` has no direct unit test — low risk, since it only recomposes already-tested pieces (`createCybermapaClient`/`readCybermapaConfig`/`createCybermapaImportSource`, each independently tested).
- [ ] 5.2b **GREEN/REFACTOR:** Wire Howen to automatic cron synchronization — add the per-connection company-assignment domain field (or equivalent), its Mongo document/validator/migration, and cron composition wiring in `app/api/internal/catalog/synchronize/composition.ts` so Howen connections resolve to a real `CatalogImportSource` instead of `unsupported-provider` [`catalog-synchronization`, `howen-catalog-import`]. Closes carried-forward risk #16.
- [ ] 5.3 **RED:** Test Spanish states, `Sync now`, freshness, counts, failures, accessibility.
- [ ] 5.4 **GREEN/REFACTOR:** Build focused `app/admin/catalog/**` UI.
- [ ] 5.5 **RED:** Test union projection, canonical identity, source-local capability loss, and fallback [`live-core-contracts`].
- [ ] 5.6 **GREEN/REFACTOR:** Add `project-canonical-live.ts` and switched live composition.

## Phase 6: Release

- [ ] 6.1 Update docs `03`, `05`, cron environment: cadence, security, rollout/rollback.
- [ ] 6.2 Run lint, typecheck, tests, coverage, build; record <=400-line diffs.
