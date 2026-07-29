# Proposal: define-live-core-contracts

## Intent

Define Sentinel Pro's first real live architecture documents and contracts inside this repo so implementation starts from explicit internal models instead of legacy behavior recall.

## Scope

### In Scope
- Document provider-agnostic live principles
- Define normalized operational live entities
- Define playback live contracts
- Define application-layer live responsibilities

### Out of Scope
- Provider adapter implementation
- UI components and route handlers

## Capabilities

### New Capabilities
- `live-core-contracts`: Internal operational and playback contracts for live features
- `live-page-responsibilities`: Application responsibilities and behavioral boundaries for live pages

### Modified Capabilities
- None

## Approach

Adapt the validated architecture from Example-sentinel into Sentinel Pro-owned documents and SDD specs, but rewrite them as clean internal contracts for greenfield implementation.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `docs/architecture/*` | New | Persistent architecture documentation |
| `openspec/changes/define-live-core-contracts/*` | New | Active SDD change artifacts |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Over-copying legacy structure | Medium | Keep contracts, not implementation details |
| Ambiguous first slice boundaries | Medium | Separate operational live from playback live |

## Rollback Plan

Remove the new docs and active change folder if the team decides on a different live architecture direction.

## Dependencies

- `Example-sentinel/docs/03..05`

## Success Criteria

- [ ] Sentinel Pro has persistent live architecture docs in-repo
- [ ] OpenSpec contains the first real live contract change
