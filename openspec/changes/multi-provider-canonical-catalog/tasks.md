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

- [ ] 1.1 **RED:** Test isolation, provider/native Vehicles, `Unassigned`, placement, durable existence [`canonical-vehicle-catalog`].
- [ ] 1.2 **GREEN/REFACTOR:** Add Organization/Company contracts under `domain/catalog/` and `application/catalog/`.
- [ ] 1.3 **RED:** Test Company candidate scope/repetition, admin binding, no identity creation [`provider-company-binding`].
- [ ] 1.4 **GREEN/REFACTOR:** Add credential references in `bind-provider-company.ts`.
- [ ] 1.5 **RED:** Test many-to-one Fleets, name rejection, review, union, enrichment, retention, placement conflict [`provider-fleet-binding`].
- [ ] 1.6 **GREEN/REFACTOR:** Add `domain/catalog/{fleet-binding,union-projection}.ts` and reviews.
- [ ] 1.7 **RED:** Test vehicle identity reuse, Company plate outcomes/conflicts, forbidden names, review [`external-identity-linking`].
- [ ] 1.8 **GREEN/REFACTOR:** Add `domain/catalog/matching.ts` and vehicle review.
- [ ] 1.9 **RED:** Test capability independence, five levels, fallback, defaults, absence, unavailability [`capability-source-precedence`].
- [ ] 1.10 **GREEN/REFACTOR:** Add `domain/catalog/precedence.ts` and `SetCapabilityPolicy`.

## Phase 2: MongoDB

- [ ] 2.1 **RED:** Replica-set test validators, indexes, Company `Unassigned` uniqueness.
- [ ] 2.2 **GREEN/REFACTOR:** Add hierarchy/connection Mongo persistence/migrations.
- [ ] 2.3 **RED:** Test identity uniqueness, many-to-one lookup, presence, reviews, policies, checkpoints.
- [ ] 2.4 **GREEN/REFACTOR:** Add identity/review/policy/import Mongo repositories.
- [ ] 2.5 **RED:** Test active-run uniqueness, lease claim/expiry, last-success, counts, crashes, absence indexes [`catalog-synchronization`].
- [ ] 2.6 **GREEN/REFACTOR:** Add run/lease documents, repositories, validators, indexes, migrations.

## Phase 3: Providers

- [ ] 3.1 **RED:** Test observed Cybermapa fields, scoped `gps_id`, no Fleet identity [`cybermapa-catalog-import`].
- [ ] 3.2 **GREEN/REFACTOR:** Add Cybermapa client, mapper, source, credentials.
- [ ] 3.3 **RED:** Test 5,542 candidates, binding, duplicate plates, resume, `Unassigned`, order/placement.
- [ ] 3.4 **GREEN/REFACTOR:** Add batching/checkpoints in `application/catalog/import-catalog.ts`.
- [ ] 3.5 **RED:** Test Howen fields, partial union, enrichment, retention, omission, concurrency, failure [`howen-catalog-import`].
- [ ] 3.6 **GREEN/REFACTOR:** Add Howen mapper/source via shared contracts.

## Phase 4: Synchronization

- [ ] 4.1 **RED:** Inject clock; test initial sync, six-hour boundary, freshness skip, shared outcomes, exclusion, isolation/retry, successful-full-snapshot-only reconciliation, failed/partial-preservation [`catalog-synchronization`].
- [ ] 4.2 **GREEN/REFACTOR:** Add shared sync/due/status use cases; reuse `ImportCatalog`.
- [ ] 4.3 **RED:** Test invalid cron secret, non-disclosure, connection isolation, retryable failure.
- [ ] 4.4 **GREEN/REFACTOR:** Add internal sync Route Handler and constant-time authorization.

## Phase 5: Delivery and Live

- [ ] 5.1 **RED:** Test same-origin/fresh-admin, bindings, reviews, manual sync, exclusion, status/counts.
- [ ] 5.2 **GREEN/REFACTOR:** Add thin `app/api/admin/catalog/**` routes.
- [ ] 5.3 **RED:** Test Spanish states, `Sync now`, freshness, counts, failures, accessibility.
- [ ] 5.4 **GREEN/REFACTOR:** Build focused `app/admin/catalog/**` UI.
- [ ] 5.5 **RED:** Test union projection, canonical identity, source-local capability loss, and fallback [`live-core-contracts`].
- [ ] 5.6 **GREEN/REFACTOR:** Add `project-canonical-live.ts` and switched live composition.

## Phase 6: Release

- [ ] 6.1 Update docs `03`, `05`, cron environment: cadence, security, rollout/rollback.
- [ ] 6.2 Run lint, typecheck, tests, coverage, build; record <=400-line diffs.
