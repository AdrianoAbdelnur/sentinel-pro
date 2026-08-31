# Tasks: Server-Side Pagination for Live

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

## Phase 1: Contracts and RED tests

- [x] 1.1 Add paged vehicle repository and Live metadata tests for page size, filters, totals, and page-scoped snapshots.
- [x] 1.2 Add route/client and sidebar pagination tests for query parameters, page navigation, five-page selection, decade jumps, the fixed footer controller, and default-expanded current-page groups.

## Phase 2: GREEN implementation

- [x] 2.1 Implement filtered group counts and page-only range queries, keeping complete groups together where possible.
- [x] 2.2 Extend `loadLiveGroup` and the route with validated page and plate inputs.
- [x] 2.3 Preserve fresh Cybermapa page-scoped snapshot requests.
- [x] 2.4 Add global client page loading and pagination controls without changing selection/playback contracts; keep the controller in a non-scrolling sidebar footer with five-page selection, decade jumps, and expanded current-page groups.

## Phase 3: Verification

- [x] 3.1 Run focused Live and MongoDB tests.
- [x] 3.2 Run lint, typecheck, and the complete test suite.
