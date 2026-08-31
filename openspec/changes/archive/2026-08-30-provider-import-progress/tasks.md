# Tasks: Show Real-Time Provider Import Progress

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 180–260 |
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

- [x] 1.1 Add application tests for snapshot and per-candidate progress callbacks.
- [x] 1.2 Add UI tests for incremental progress events, completion, and failure.

## Phase 2: GREEN

- [x] 2.1 Add typed progress contracts and forward callbacks through catalog synchronization.
- [x] 2.2 Add provider progress composition and NDJSON streaming in the admin route.
- [x] 2.3 Render live phase, elapsed time, and counters in the import screen.

## Phase 3: Verification

- [x] 3.1 Run focused tests, lint, typecheck, and build.
