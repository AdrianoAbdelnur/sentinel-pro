# Proposal: Show Real-Time Provider Import Progress

## Intent

Make long provider imports understandable by showing real milestones and counters instead of a static loading label.

## Scope

### In Scope
- Stream import progress events from the server to the import screen.
- Report provider records found, fleets detected, processed records, saved/linked vehicles, and reviews.
- Show current phase and elapsed time while the import is active.
- Keep final counts and failure handling accurate.

### Out of Scope
- Cancelling an active import.
- Background jobs that survive browser navigation.
- Invented percentage estimates.

## Capabilities

### New Capabilities
- `provider-import-progress`: The provider import screen displays streamed, real progress.

### Modified Capabilities
- None.

## Approach

Extend the application callbacks already used for lease renewal with typed progress events. The route returns newline-delimited JSON events, and the client consumes them incrementally. Progress is emitted after the provider snapshot and after each catalog candidate is processed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `application/catalog/*` | Modified | Add progress contracts and callbacks. |
| `app/api/admin/import/route.ts` | Modified | Stream progress and final result. |
| `app/admin/import/provider-import-screen.tsx` | Modified | Render phase, timer, counters, and final result. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A disconnected client leaves work running | Medium | Preserve current server-side import semantics; cancellation remains out of scope. |
| Progress event parsing fails | Low | Use newline-delimited JSON and focused client tests. |

## Rollback Plan

Revert the streaming route, progress contracts, UI, tests, and this change folder.

## Success Criteria

- [ ] The screen shows a non-static phase while importing.
- [ ] Found and processed counts come from real provider/application events.
- [ ] Final success and failure messages remain correct.
