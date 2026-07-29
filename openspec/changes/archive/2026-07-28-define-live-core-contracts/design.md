# Design: define-live-core-contracts

## Technical Approach

Create Sentinel Pro-owned architecture documents plus OpenSpec artifacts that establish the first authoritative live contracts before implementation code is introduced.

## Architecture Decisions

### Decision: Split operational live from playback live

**Choice**: Document them as separate concerns with separate contracts.
**Alternatives considered**: One combined live state model.
**Rationale**: The legacy project proved this coupling becomes hard to maintain and leaks provider behavior upward.

### Decision: Keep the first slice documentation-first

**Choice**: Persist architecture and SDD artifacts before coding domain types.
**Alternatives considered**: Start by creating TypeScript types directly.
**Rationale**: This repo needs alignment and permanence first; implementation can follow the contracts.

### Decision: Store docs in `docs/architecture` and change artifacts in `openspec`

**Choice**: Keep durable architecture docs separate from active change artifacts.
**Alternatives considered**: Put everything only in OpenSpec.
**Rationale**: The user wants project documentation, not only process artifacts.

## Data Flow

```text
Reference docs (Example-sentinel)
        |
        v
Sentinel Pro architecture docs
        |
        v
OpenSpec change artifacts
        |
        v
Future domain/application implementation
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `docs/architecture/02-provider-agnostic-live-principles.md` | Create | Live architecture rules |
| `docs/architecture/03-live-core-domain.md` | Create | Normalized operational contracts |
| `docs/architecture/04-live-playback-contract.md` | Create | Playback monitor and tile contracts |
| `docs/architecture/05-live-application-responsibilities.md` | Create | Application and delivery boundaries |
| `openspec/changes/define-live-core-contracts/*` | Create | Proposal, specs, design, tasks |

## Interfaces / Contracts

The documented contracts cover:

- `Customer`
- `Fleet`
- `Vehicle`
- `Device`
- `DeviceTelemetry`
- `LiveSelectionState`
- `LiveMonitor`
- `LiveTile`
- `LivePageViewModel` boundary

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | future mappers and selectors | test-first against these contracts |
| Integration | future use cases composing live view models | scenario-based tests from specs |
| E2E | none in this slice | not applicable yet |

## Migration / Rollout

No migration required.

## Open Questions

- [ ] Which provider becomes the first real adapter slice after contracts are accepted?
