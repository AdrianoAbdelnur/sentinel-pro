# Tasks: Separate Live Sidebar Filter and Expansion State

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 160-260 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Decouple expansion from filtering with regressions and docs. | Single PR | Tests and documentation included. |

## Phase 1: RED - Reproduce the Independence Contract

- [x] 1.1 Update `application/live/build-live-sidebar-view-model.test.ts`: table-drive status, provider, and search cases proving collapsed matching fleets stay collapsed and explicit IDs alone expand them.
- [x] 1.2 Replace the forced-status-expansion assertion with open -> filter -> close -> filter-change regressions that prove a direct toggle is the sole expansion mutation.
- [x] 1.3 Update `application/live/build-live-page-view-model.test.ts`: prove filters and `expandedFleetIds` are forwarded independently while map and bottom-panel models remain unchanged.
- [x] 1.4 Update `components/live/live-screen.test.tsx`: for status, provider, and search, exercise visible fleet opening, filtering, closing, and subsequent filter changes; vehicle rows must remain hidden after closing.

## Phase 2: GREEN - Remove the Coupling

- [x] 2.1 Modify `application/live/build-live-sidebar-view-model.ts`: delete filter-derived auto-expansion and set every `LiveFleetNode.isExpanded` only from `expandedFleetIds.has(fleetId)`.
- [x] 2.2 Verify `components/live/live-screen.tsx` preserves `expandedFleetIds` across filter setters and that only `toggleExpanded` changes it; make no unrelated selection changes.
- [x] 2.3 Run the focused tests until every Phase 1 regression passes without weakening assertions.

## Phase 3: REFACTOR and Documentation

- [x] 3.1 Simplify the sidebar builder after the GREEN change, retaining filter logic solely for visibility and full-roster count/selection semantics.
- [x] 3.2 Update `docs/architecture/05-live-application-responsibilities.md`: replace forced-narrowing expansion prose with the explicit sole-owner expansion rule.
- [x] 3.3 Confirm source files remain comment-free and no provider-specific expansion branch is introduced.

## Phase 4: Verification

- [x] 4.1 Run `npm test -- application/live/build-live-sidebar-view-model.test.ts application/live/build-live-page-view-model.test.ts components/live/live-screen.test.tsx`.
- [x] 4.2 Run `npm run lint`, `npm run typecheck`, and `npm test`; report any pre-existing failures separately.
- [ ] 4.3 Perform a browser check at `/live`: each status/provider/search filter keeps fleets collapsed by default, and any visible fleet can be opened and later closed regardless of filters.
