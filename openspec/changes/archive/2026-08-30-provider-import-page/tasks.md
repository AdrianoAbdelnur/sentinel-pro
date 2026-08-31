# Tasks: One-click provider catalog import

## Phase 1: Provider import contract
- [x] Define provider import input/output contracts and application ports, including automatic Company creation.
- [x] Add the provider import orchestration that reuses existing synchronization.
- [x] Add failing unit tests, then implement supported-provider and failure paths.

## Phase 2: Delivery flow
- [x] Add the admin import route with administrator authorization and safe result projection.
- [x] Add the dedicated Spanish import page and focused client components.
- [x] Add route and UI tests for provider choice, loading, success, and failure.

## Phase 3: Live wiring
- [x] Add tenant-scoped canonical catalog loading at the composition boundary.
- [x] Replace duplicate direct Howen composition with the canonical source when catalog data is available.
- [x] Add tests for loader isolation and one canonical vehicle in Live.

## Phase 4: Verification and documentation
- [x] Update live/catalog architecture documentation with the active wiring.
- [x] Run lint, typecheck, tests, and build.
- [x] Verify the local flow without printing credentials or calling providers with test secrets.

## Review Workload Forecast
- 400-line budget risk: High.
- Chained PRs recommended: No, because the user requested one feature branch and continuous delivery; use reviewable commits within this branch.
- Decision: single feature branch with work-unit commits; no unrelated refactors.
