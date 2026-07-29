# Tasks: define-live-core-contracts

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
| 1 | Persist live architecture docs and active SDD change | PR 1 | Documentation-first slice |

## Phase 1: Architecture Documentation

- [x] 1.1 Create `docs/architecture/02-provider-agnostic-live-principles.md` with the live boundary rules.
- [x] 1.2 Create `docs/architecture/03-live-core-domain.md` with normalized operational entities.
- [x] 1.3 Create `docs/architecture/04-live-playback-contract.md` with `LiveMonitor` and `LiveTile`.
- [x] 1.4 Create `docs/architecture/05-live-application-responsibilities.md` with layer responsibilities.

## Phase 2: SDD Contracts

- [x] 2.1 Write `openspec/changes/define-live-core-contracts/proposal.md`.
- [x] 2.2 Write `openspec/changes/define-live-core-contracts/specs/live-core-contracts/spec.md`.
- [x] 2.3 Write `openspec/changes/define-live-core-contracts/specs/live-page-responsibilities/spec.md`.
- [x] 2.4 Write `openspec/changes/define-live-core-contracts/design.md`.
- [x] 2.5 Write `openspec/changes/define-live-core-contracts/tasks.md`.

## Phase 3: Verification

- [x] 3.1 Review doc consistency between architecture docs and OpenSpec specs.
- [x] 3.2 Confirm operational live and playback live remain separate in every artifact.
- [x] 3.3 Confirm no artifact leaks provider-specific behavior into UI responsibilities.
