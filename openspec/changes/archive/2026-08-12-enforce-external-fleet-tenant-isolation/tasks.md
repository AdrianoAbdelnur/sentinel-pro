# Tasks: Enforce external tenant isolation

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

## Phase 1: Authorization contract

- [x] 1.1 RED: Test shared-master mixed snapshots, unauthorized scopes, unknown IDs, and repeat idempotency.
- [x] 1.2 GREEN: Add deny-by-default connection authorization and filter snapshots before import.
- [x] 1.3 GREEN: Persist and validate authorization allowlists in Mongo documents.

## Phase 2: Verification

- [x] 2.1 Run lint, typecheck, tests, and build.
