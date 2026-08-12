# Tasks: Prevent Cross-Provider Vehicle Duplicates

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 280–380 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Evidence-tiered matching and idempotent review staging | Single PR | Tests, implementation, persistence, and docs together |

## Phase 1: RED — Matching Contract

- [x] 1.1 Extend `domain/catalog/matching.test.ts` for unique explicit registered-plate auto-link, ambiguous candidates, and similar/partial labels never matching.
- [x] 1.2 Extend `application/catalog/import-catalog.test.ts` for cross-provider IDs: safe link, weak exact Howen label review, no-candidate creation, retries, and existing identity reuse.
- [x] 1.3 Extend `application/catalog/resolve-catalog-review.test.ts` for approved review binding followed by deterministic import reuse.

## Phase 2: GREEN — Evidence and Import

- [x] 2.1 Update `application/catalog/ports.ts` and `domain/catalog/matching.ts` to distinguish `registeredPlate` strong evidence from display `label` weak candidates in Company scope.
- [x] 2.2 Update `domain/catalog/review.ts` and `application/catalog/import-catalog.ts` to persist typed vehicle-match evidence, reuse an idempotent pending review, and create a Vehicle only without candidates.
- [x] 2.3 Verify or minimally adjust `application/catalog/resolve-catalog-review.ts` so approved identity binding remains atomic and retry-safe.

## Phase 3: Adapters and Storage

- [x] 3.1 Update `integrations/cybermapa/map-cybermapa-catalog.ts` and mapper tests so only `patente` supplies `registeredPlate`; retain aliases as labels.
- [x] 3.2 Verify or minimally adjust `integrations/howen/map-howen-catalog.ts` and tests so `devicename` remains label-only and never inferred as a plate.
- [x] 3.3 Update `integrations/persistence/mongodb/catalog-{documents,validators,migrations,repositories}.ts` and focused tests to round-trip typed review evidence and preserve review-key idempotency.

## Phase 4: Delivery, Documentation, Verification

- [x] 4.1 Update `app/api/admin/catalog/delivery.ts` and `app/admin/catalog/{review-item,pending-reviews-panel}.tsx` with generic evidence display and existing component/API tests, without provider branches.
- [x] 4.2 Update `docs/architecture/08-catalog-synchronization.md` with evidence tiers, review behavior, and no-merge/no-backfill rollout constraint.
- [x] 4.3 Refactor only after GREEN without changing behavior; run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` without provider APIs or `.env.local`.
