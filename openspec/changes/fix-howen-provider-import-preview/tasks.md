# Tasks: Fix Howen Provider Import Preview

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 25–45 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single focused change |
| Delivery strategy | exception-ok |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: RED

- [x] 1.1 Add `app/api/catalog/connection-sources.test.ts` proving Howen resolves for `companyId: "preview"` and a real company scope.

## Phase 2: GREEN

- [x] 2.1 Update `app/api/admin/import/composition.ts` to retain the supplied company scope on the transient connection.

## Phase 3: Verification

- [x] 3.1 Run focused tests, full relevant checks, lint, typecheck, and build.
