# Proposal: implement-live-operator-panels

## Intent

Implement the next live application slice that composes the operational sidebar and bottom panel from internal live state, so UI delivery can render small components over stable view models instead of rebuilding business rules in the page.

## Scope

### In Scope
- Compose `LiveSidebarViewModel` from fleet, vehicle, selection, and search state
- Compose `LiveBottomPanelViewModel` from selected vehicles and tabular datasets
- Add tests for collapsed fleets, selection state, search expansion, and partial-data rows

### Out of Scope
- Provider adapters and remote fetching
- Route handlers and UI components
- Playback tile rendering changes

## Capabilities

### New Capabilities
- `live-operator-panels`: Application composition for live sidebar and bottom panel view models

### Modified Capabilities
- None

## Approach

Add pure application use cases that accept normalized live state plus lightweight UI inputs, then return provider-agnostic sidebar and bottom-panel contracts ready for delivery.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `application/live/*` | Modified | New panel composition inputs, use cases, and exports |
| `application/live/*.test.ts` | New | Unit coverage for sidebar and bottom panel behavior |
| `openspec/changes/implement-live-operator-panels/*` | New | SDD artifacts for this slice |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Overloading contracts too early | Medium | Keep use cases pure and input-driven |
| UI concerns leaking into application | Low | Limit outputs to documented view models only |
| Search behavior becoming ambiguous | Medium | Lock behavior with scenarios before code |

## Rollback Plan

Remove the new change folder and revert the new application panel composition files if the team chooses a different live composition model.

## Dependencies

- `docs/architecture/05-live-application-responsibilities.md`
- `application/live/contracts.ts`

## Success Criteria

- [ ] Sidebar composition rules are executable and tested
- [ ] Bottom panel composition rules are executable and tested
- [ ] Delivery can consume panel view models without reassembling business logic
