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

- [ ] 5.1 **RED:** Test same-origin/fresh-admin, bindings, reviews, manual sync, exclusion, status/counts. PARTIAL (2nd pass): reviews (list + resolve, both existing-target AND new-target resolution), company-candidate binding, and manual sync are covered with mutation proof, closing carried-forward risk #3 fully for those three surfaces. Status/counts route tests are NOT yet written — see note on 5.2.
- [ ] 5.2 **GREEN/REFACTOR:** Add thin `app/api/admin/catalog/**` routes. PARTIAL (2nd pass) — this pass added, on top of the 1st pass's review routes: (a) `ReviewResolutionTarget` widened from `{ targetId: string }` to a union `{ kind: "existing"; targetId: string } | { kind: "new" }`, satisfying `external-identity-linking/spec.md`'s "to a Vehicle in the bound Company or to a new Vehicle there" — a vehicle-match review can now resolve to a NEW Vehicle placed in the bound Company's Unassigned Fleet, mutation-proven to retain exactly one Company-scoped link and to leak zero Vehicles on a lost CAS race. A fleet-binding review resolving to `{kind:"new"}` returns `{kind:"unsupported"}` (400) by deliberate design: `provider-fleet-binding/spec.md`'s only resolution scenario is "selects a Fleet in the same Company," never "creates a new Fleet" — this is a spec-driven asymmetry, not an oversight. (b) `POST /api/admin/catalog/companies/candidates/[candidateId]/bind` wiring the already-authorized `bindProviderCompany`, now HTTP-reachable with fresh-admin auth proven end-to-end (closing the "freshness is unverifiable end-to-end" gap the 1st pass noted). (c) `POST /api/admin/catalog/connections/[connectionId]/sync` wiring `SynchronizeCatalogConnection` with `trigger:"manual"`, `organizationId` derived strictly from the actor, provider source resolved via the SHARED `resolveConnectionSource`/`createDefaultConnectionSourceFactories` (extracted from `app/api/internal/catalog/synchronize/composition.ts` so no import mechanism is duplicated), `already-running` reusing the existing lease with zero new mutual-exclusion code. (d) A freshness call-count assertion proving `authorize()` is called fresh once per request across list/resolve/bind/sync (mirrors `admin-users.test.ts:155-168`). (e) Two of PR #32's three small findings resolved: the `review.status !== "pending"` guard in `resolve-catalog-review.ts` was kept (NOT deleted) after a direct mutation test proved it is NOT redundant — it changes the outcome from `not-found` to `already-resolved` for an already-resolved review paired with an invalid/foreign target, a real (if previously untested) behavior difference; `resolve/route.ts`'s `!reviewId.trim()` guard now has a direct missingId/invalidId test mirroring `admin-users.test.ts`. Still deferred to a follow-up PR, same 5.1/5.2: `GET /api/admin/catalog/connections/[connectionId]/status` wiring `GetCatalogSyncStatus`'s existing allowlist projection, plus extending the freshness assertion to include it. Reason for this 2nd split: this pass (resolve-to-new + 3 small fixes + company-binding route + manual-sync route + freshness test) reached 385 changed lines against `feat/catalog-admin-api` on its own — a real checkpoint at ~365 lines showed the status route's estimated ~40-55 lines (proper mutation-proof coverage, non-disclosure test, freshness extension) would exceed the 400-line budget. This deviates from the originally suggested seam ("resolve-to-new + fixes in one PR, all three routes in a second") by including 2 of 3 routes here instead of 0; company-binding and manual-sync were natural companions to the resolve-to-new work already in flight, leaving only the smallest, most isolated remaining piece (status, near-zero business logic, pure GetCatalogSyncStatus wiring) for the follow-up.
- [ ] 5.2b **GREEN/REFACTOR:** Wire Howen to automatic cron synchronization — add the per-connection company-assignment domain field (or equivalent), its Mongo document/validator/migration, and cron composition wiring in `app/api/internal/catalog/synchronize/composition.ts` so Howen connections resolve to a real `CatalogImportSource` instead of `unsupported-provider` [`catalog-synchronization`, `howen-catalog-import`]. Closes carried-forward risk #16.
- [ ] 5.3 **RED:** Test Spanish states, `Sync now`, freshness, counts, failures, accessibility.
- [ ] 5.4 **GREEN/REFACTOR:** Build focused `app/admin/catalog/**` UI.
- [ ] 5.5 **RED:** Test union projection, canonical identity, source-local capability loss, and fallback [`live-core-contracts`].
- [ ] 5.6 **GREEN/REFACTOR:** Add `project-canonical-live.ts` and switched live composition.

## Phase 6: Release

- [ ] 6.1 Update docs `03`, `05`, cron environment: cadence, security, rollout/rollback.
- [ ] 6.2 Run lint, typecheck, tests, coverage, build; record <=400-line diffs.
