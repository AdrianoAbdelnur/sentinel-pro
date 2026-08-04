# Proposal: Separate Live Sidebar Filter and Expansion State

## Intent

Fix the live-sidebar regression where selecting a status, provider, or search result opens fleets and prevents the operator from closing them. Filters must only narrow visible data; fleet expansion must remain an independent operator-controlled view choice.

## Proposal question round

Skipped: the operator supplied the governing rule unambiguously—only direct fleet toggles may open or close fleets.

## Scope

### In Scope
- Make `expandedFleetIds` the sole input that determines `LiveFleetNode.isExpanded`.
- Preserve expansion choices while status, provider, and search filters change visible fleets and vehicles.
- Add unit, page-composition, and screen interaction regressions for each filter type.
- Correct the live application responsibility documentation.

### Out of Scope
- Automatically revealing search matches.
- Per-filter expansion snapshots, persistence, or changes to fleet/vehicle checkbox semantics.
- Provider-specific sidebar behavior.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `live-page-shell`: sidebar filtering and fleet expansion become explicitly independent interaction contracts.

## Approach

Keep filtering as a pure roster-visibility calculation in the application view model. Project `isExpanded` exclusively from explicit expanded-fleet state already owned by `LiveScreen`; never infer it from status, provider, or search inputs. Cover the invariant at pure-builder, page-composition, and rendered-interaction levels.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `application/live/build-live-sidebar-view-model.ts` | Modified | Remove filter-driven expansion. |
| `application/live/*sidebar*.test.ts` | Modified | Add filter/expansion independence regressions. |
| `components/live/live-screen.test.tsx` | Modified | Verify an operator can collapse filtered fleets. |
| `docs/architecture/05-live-application-responsibilities.md` | Modified | Document sole ownership of expansion. |
| `openspec/specs/live-page-shell/spec.md` | Modified | Define the corrected interaction contract. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Existing tests preserve the bug | Medium | Replace them with direct invariant tests. |
| Hidden matching vehicles surprise operators | Low | This is the explicit product rule; opening remains one click. |
| Selection behavior changes accidentally | Low | Assert full-roster checkbox behavior remains unchanged. |

## Rollback Plan

Revert the focused view-model, tests, and documentation commit. No persisted state, provider contract, or data migration is involved.

## Dependencies

- Existing `expandedFleetIds` state in `LiveScreen`.

## Success Criteria

- [ ] Status, provider, and search filters never open or reopen a fleet.
- [ ] A fleet opens or closes only after its direct toggle.
- [ ] Filter changes preserve an operator’s expansion choices.
- [ ] Existing selection/count behavior remains intact.
