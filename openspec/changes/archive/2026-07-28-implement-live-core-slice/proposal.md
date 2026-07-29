# Proposal: implement-live-core-slice

## Intent

Implement the first real runtime slice for Sentinel Pro live behavior inside `domain/live` and `application/live`, using the previously documented contracts as executable TypeScript code.

## Scope

### In Scope
- Create provider-agnostic live domain contracts in `domain/live`
- Create application contracts and ports in `application/live`
- Implement the first pure live use cases for map composition and playback opening
- Cover the new business logic with unit tests

### Out of Scope
- Provider adapters
- Route handlers
- UI components
- End-to-end playback integration

## Capabilities

### New Capabilities
- `live-runtime-contracts`: executable domain and application contracts for live
- `live-playback-opening`: application logic for initial playback opening outcomes

### Modified Capabilities
- `live-core-contracts`
- `live-page-responsibilities`

## Approach

Translate the repo-owned architecture docs into small TypeScript modules with pure functions first, so later integrations and UI can depend on stable internal contracts instead of documentation alone.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `domain/live/*` | New | Internal live entities and domain helpers |
| `application/live/*` | New | Application contracts, ports, and use cases |
| `openspec/changes/implement-live-core-slice/*` | New | Active SDD artifacts for the implementation slice |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Contracts stay too abstract to be useful | Medium | Add real use cases, not only types |
| Playback logic leaks provider concerns | Low | Keep provider resolution behind a resolver port |
| TDD gets skipped because types feel "simple" | Medium | Add tests for domain helper and application behaviors |

## Rollback Plan

Remove the new `domain/live` and `application/live` modules plus this change folder if the team replaces the live architecture.

## Dependencies

- `docs/architecture/03-live-core-domain.md`
- `docs/architecture/04-live-playback-contract.md`
- `docs/architecture/05-live-application-responsibilities.md`

## Success Criteria

- [ ] `domain/live` exposes executable internal live contracts
- [ ] `application/live` exposes provider-agnostic contracts and ports
- [ ] Map composition rules are codified in tests and implementation
- [ ] Playback open outcomes are codified in tests and implementation
