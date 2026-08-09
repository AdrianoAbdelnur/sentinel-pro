# Tasks: Multi-provider canonical catalog

## Review Workload Forecast

Estimated changed lines: 5,000-7,200. Delivery strategy: auto-chain.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

PR 1 targets the tracker; successors target their predecessor; each stays <=400 lines.

PRs: 1 core; 2 Company binding; 3 Fleet binding/union/presence; 4 matching; 5 precedence; 6 Mongo hierarchy; 7 Mongo identities/import; 8 Cybermapa contract; 9 Cybermapa import; 10 Howen import; 11 APIs; 12 Spanish UI; 13 live seam; 14 docs/quality.

## Phase 1: Domain and Application Core

- [ ] 1.1 **RED:** Test isolation, provider/native-only Vehicles, `Unassigned`, retained placement, and source-independent existence in `domain/catalog/*.test.ts` [`canonical-vehicle-catalog`].
- [ ] 1.2 **GREEN/REFACTOR:** Add separate Organization/Company contracts in `domain/catalog/entities.ts` and `application/catalog/{contracts,ports,use-cases}.ts`.
- [ ] 1.3 **RED:** Test scoped/repeated candidates, admin binding, and no identity creation [`provider-company-binding`].
- [ ] 1.4 **GREEN/REFACTOR:** Implement credential-reference contracts in `application/catalog/bind-provider-company.ts`.
- [ ] 1.5 **RED:** Test many-to-one Fleet identities, reuse, name non-binding, admin review, partial union, provider-only Vehicles, enrichment, and placement conflicts [`provider-fleet-binding`].
- [ ] 1.6 **GREEN/REFACTOR:** Add `domain/catalog/{fleet-binding,union-projection}.ts` and `application/catalog/{bind-provider-fleet,resolve-reviews}.ts`.
- [ ] 1.7 **RED:** Test identity reuse, Company plate outcomes/conflicts, forbidden names, and review [`external-identity-linking`].
- [ ] 1.8 **GREEN/REFACTOR:** Implement `domain/catalog/matching.ts` and vehicle review use case.
- [ ] 1.9 **RED:** Test capability independence, five levels, fallback, defaults, absence, and unavailable results [`capability-source-precedence`].
- [ ] 1.10 **GREEN/REFACTOR:** Implement `domain/catalog/precedence.ts` and `SetCapabilityPolicy`.

## Phase 2: MongoDB Persistence

- [ ] 2.1 **RED:** Replica-set test validators, tenant indexes, and one Company `Unassigned`.
- [ ] 2.2 **GREEN/REFACTOR:** Add hierarchy/connection persistence and migrations under `integrations/persistence/mongodb/`.
- [ ] 2.3 **RED:** Test Fleet/Vehicle uniqueness, many-to-one lookup, bounded states, concurrency, checkpoints, rollback, and successful-run-only absence.
- [ ] 2.4 **GREEN/REFACTOR:** Add identity/review/policy/import repositories with retry; failed/partial runs never mark absence.

## Phase 3: Provider Imports

- [ ] 3.1 **RED:** Test `integrations/cybermapa/*.test.ts` against observed GETVEHICULOS fields, scoped `gps_id`, and no Fleet identity [`cybermapa-catalog-import`].
- [ ] 3.2 **GREEN/REFACTOR:** Add Cybermapa client, mapper, source, and credential resolution.
- [ ] 3.3 **RED:** Test 5,542 candidates, Company gate, duplicate plates, resume/concurrency, `Unassigned`, source order, and retained placement.
- [ ] 3.4 **GREEN/REFACTOR:** Implement idempotent transitions, checkpoints, and post-success presence in `application/catalog/import-catalog.ts`.
- [ ] 3.5 **RED:** Test Howen fields, partial union, overlap enrichment, provider-only retention, omission capability loss, concurrency, and failure [`howen-catalog-import`].
- [ ] 3.6 **GREEN/REFACTOR:** Add `integrations/howen/{map-howen-catalog-candidates,howen-catalog-source}.ts` through shared import contracts.

## Phase 4: Delivery and Live

- [ ] 4.1 **RED:** Test `app/api/admin/catalog/**` authorization, tenant denial, Company/Fleet binding, reviews, imports, placement, and policy.
- [ ] 4.2 **GREEN/REFACTOR:** Add thin Route Handlers and provider-neutral composition.
- [ ] 4.3 **RED:** Test `app/admin/catalog/**` workflows and accessible Spanish copy without provider branches.
- [ ] 4.4 **GREEN/REFACTOR:** Build Company/Fleet binding, import, review, placement, and policy UI.
- [ ] 4.5 **RED:** Test union Fleet projection, canonical identity, source-local capability loss, and fallback [`live-core-contracts`].
- [ ] 4.6 **GREEN/REFACTOR:** Add `application/catalog/project-canonical-live.ts` and feature-switched live composition.

## Phase 5: Documentation and Verification

- [ ] 5.1 Update docs `03` and `05` with union, presence, rollout, and rollback.
- [ ] 5.2 Run lint, typecheck, tests, coverage, and build; record <=400-line diffs.
