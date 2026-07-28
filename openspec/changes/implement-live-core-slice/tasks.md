# Tasks: implement-live-core-slice

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250-400 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Implement first domain/application live slice with tests | PR 1 | Pure contracts and use cases only |

## Phase 1: Contracts

- [x] 1.1 Create `domain/live/*` with live entities, playback contracts, and GPS validation helper.
- [x] 1.2 Create `application/live/contracts.ts` with view models, playback notice/result contracts, and resolver port.

## Phase 2: Use Cases

- [x] 2.1 Implement `buildLiveMapViewModel` for selected vehicle marker composition and empty states.
- [x] 2.2 Implement `openVehicleLive` for append-tiles, offline/no-video notice, and already-open noop outcomes.

## Phase 3: Verification

- [x] 3.1 Add unit tests for GPS validity and map composition behavior.
- [x] 3.2 Add unit tests for playback opening behavior.
- [x] 3.3 Run targeted tests and typecheck for the new slice.
