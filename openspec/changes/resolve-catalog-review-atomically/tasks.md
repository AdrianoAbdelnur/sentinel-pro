# Tasks: Resolve Catalog Reviews Atomically

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 180–260 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |

## Phase 1: Atomic Review Resolution

- [x] 1.1 RED: Add regression tests for normal resolution, persistence rollback, concurrent identity creation, same/different identity targets, retry, and final consistency.
- [x] 1.2 GREEN: Extend transaction and identity ports, execute vehicle review resolution transactionally, and return explicit conflicts.
- [x] 1.3 GREEN: Implement Mongo atomic identity ensure and wire the transaction runner into catalog-admin composition.
- [x] 1.4 REFACTOR: Keep route delivery translation explicit and run all required validations.
