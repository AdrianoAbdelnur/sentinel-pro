# Tasks: Restore Howen Fleet Catalog Import

## Review Workload Forecast

Estimated changed lines: 120-180
400-line budget risk: Low
Chained PRs recommended: No
Decision needed before apply: No
Chain strategy: size-exception

## Phase 1: RED tests

- [x] 1.1 Add a failing application test proving a new Howen external fleet creates one canonical Fleet and places its vehicles there.
- [x] 1.2 Add failing coverage for two external fleets, repeat import idempotency, and preserving an existing bound identity.

## Phase 2: GREEN implementation

- [x] 2.1 Update `application/catalog/import-catalog.ts` to create/reuse standard Fleets and bind external fleet identities through existing repositories.
- [x] 2.2 Update the in-memory fleet cache so subsequent candidates in the same import reuse the newly created Fleet.

## Phase 3: REFACTOR and verification

- [x] 3.1 Refactor the fleet resolution path for explicit names and minimal duplication without changing behavior.
- [x] 3.2 Run focused catalog tests, lint, typecheck, and the relevant full test suite.
- [x] 3.3 Review the diff against the Howen fleet specification and record verification evidence.
