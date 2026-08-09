# Tasks: Multi-provider canonical catalog

## Review Workload Forecast

Estimated changed lines: 4,500-6,500. Delivery strategy: auto-chain.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

Draft tracker; PR 1 targets it and each successor targets its predecessor. Every <=400-line slice includes proof.

PRs: 1 core; 2 connection/binding; 3 matching/review; 4 precedence; 5 Mongo hierarchy; 6 Mongo identity/review/policy/import; 7 Cybermapa contract/mapper; 8 Cybermapa import; 9 Howen import; 10 admin APIs; 11 Spanish UI; 12 live seam; 13 docs/quality.

## Phase 1: Domain and Application Core

- [ ] 1.1 **RED:** Test tenant isolation, native/provider-only vehicles, `Unassigned`, and retained placement in `domain/catalog/*.test.ts` [`canonical-vehicle-catalog`].
- [ ] 1.2 **GREEN/REFACTOR:** Add `domain/catalog/entities.ts` and `application/catalog/{contracts,ports,use-cases}.ts`; keep Organization and Company separate.
- [ ] 1.3 **RED:** Test scoped/repeated candidates, authorized binding, and no identity creation [`provider-company-binding`].
- [ ] 1.4 **GREEN/REFACTOR:** Implement `application/catalog/bind-provider-company.ts` with credential-reference contracts.
- [ ] 1.5 **RED:** Test identity reuse, Company plate outcomes/conflicts, forbidden name matching, and review [`external-identity-linking`].
- [ ] 1.6 **GREEN/REFACTOR:** Implement `domain/catalog/matching.ts` and `application/catalog/resolve-match-review.ts`.
- [ ] 1.7 **RED:** Test capability independence, five levels, ordered fallback, defaults, and unavailable results [`capability-source-precedence`].
- [ ] 1.8 **GREEN/REFACTOR:** Implement `domain/catalog/precedence.ts` and `SetCapabilityPolicy`.

## Phase 2: MongoDB Persistence

- [ ] 2.1 **RED:** In Mongo replica-set tests, reject cross-tenant writes and duplicate Company `Unassigned` fleets.
- [ ] 2.2 **GREEN/REFACTOR:** Add hierarchy/connection documents, repositories, validators, indexes, and migrations under `integrations/persistence/mongodb/`.
- [ ] 2.3 **RED:** Reproduce concurrent identity, pending-review, policy-rank, import-item, checkpoint, and rollback races.
- [ ] 2.4 **GREEN/REFACTOR:** Add identity/review/policy/import repositories and bounded transactional reread/retry.

## Phase 3: Provider Imports

- [ ] 3.1 **RED:** Contract-test `integrations/cybermapa/*.test.ts` against observed GETVEHICULOS keys and required `gps_id`/company label [`cybermapa-catalog-import`].
- [ ] 3.2 **GREEN/REFACTOR:** Add Cybermapa client, mapper, source, and server-only credential resolution.
- [ ] 3.3 **RED:** Test 5,542 candidates, binding, duplicate plates, bounded resume/concurrency, source order, and placement.
- [ ] 3.4 **GREEN/REFACTOR:** Implement `application/catalog/import-catalog.ts` with checkpoints and idempotent candidate transactions.
- [ ] 3.5 **RED:** Test verified Howen fields, missing Company/identity, concurrency, failure, and canonical preservation [`howen-catalog-import`].
- [ ] 3.6 **GREEN/REFACTOR:** Add `integrations/howen/{map-howen-catalog-candidates,howen-catalog-source}.ts`.

## Phase 4: Delivery and Live

- [ ] 4.1 **RED:** Test `app/api/admin/catalog/**` authorization, tenant denial, validation, binding, import, review, placement, and policy.
- [ ] 4.2 **GREEN/REFACTOR:** Add thin Route Handlers and provider-neutral composition.
- [ ] 4.3 **RED:** Test `app/admin/catalog/**` workflows and accessible Spanish copy without provider business branches.
- [ ] 4.4 **GREEN/REFACTOR:** Build focused Company, binding, import, review, placement, and policy UI.
- [ ] 4.5 **RED:** Test canonical hierarchy and independently sourced capabilities through `ProjectCanonicalLive` [`live-core-contracts`].
- [ ] 4.6 **GREEN/REFACTOR:** Add `application/catalog/project-canonical-live.ts` and fallback-switched live composition without UI branches.

## Phase 5: Documentation and Verification

- [ ] 5.1 Update architecture docs `03` and `05` with catalog boundaries, projection, rollout, and rollback.
- [ ] 5.2 Run lint, typecheck, tests, coverage, and build; record each PR's clean diff and <=400-line budget.
