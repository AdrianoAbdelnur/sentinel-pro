## Exploration: separate-live-sidebar-filter-and-expansion-state

### Current State
The sidebar has two distinct inputs: filter inputs (`searchTerm`, `status`, and `provider`) determine which fleets and vehicles are visible, while `expandedFleetIds` is UI state owned by `LiveScreen`. The view-model builder violates that separation: it calculates `shouldAutoExpandFleets` from active status/search narrowing and then sets `isExpanded` with `shouldAutoExpandFleets || expandedIds.has(fleetId)`. A fleet toggle correctly removes its ID from `expandedFleetIds`, but the forced condition remains true, so the UI cannot collapse it.

Provider filtering is currently independently tested as not controlling expansion, but the shared `isNarrowed` path and the architectural documentation still describe all narrowing as forcing expansion. The contract needs one explicit invariant: filters control visibility only; expansion is determined only by explicit fleet-toggle state.

### Affected Areas
- `application/live/build-live-sidebar-view-model.ts` — contains the coupling between status/search narrowing and `isExpanded`.
- `application/live/build-live-sidebar-view-model.test.ts` — currently asserts the incorrect status-forced expansion and needs direct independence regressions for status, provider, and search.
- `application/live/build-live-page-view-model.test.ts` — should prove page composition preserves the independent expanded-fleet input while filters narrow visibility.
- `components/live/live-screen.tsx` — owns `expandedFleetIds` and already has the correct explicit-toggle state boundary.
- `components/live/live-screen.test.tsx` — should exercise expand, filter, collapse, and filter changes through the real composition.
- `docs/architecture/05-live-application-responsibilities.md` — currently states that any narrowing input forces every fleet open and must be corrected with the independent-state rule.

### Approaches
1. **Make expansion a direct projection of explicit state** — set `isExpanded` exclusively from `expandedFleetIds.has(fleetId)`; keep the existing filter pipeline responsible only for retaining/dropping fleets and vehicle rows.
   - Pros: one owner per concern, preserves operator expansion choices across filter changes, minimum focused change, and directly prevents this class of regression.
   - Cons: a matching vehicle remains hidden until its fleet is explicitly opened.
   - Effort: Low

2. **Add per-filter expansion snapshots or reset rules** — retain separate expansion histories for each filter combination.
   - Pros: could restore different expansion layouts per saved filter context.
   - Cons: invents state the user did not request, makes behavior harder to predict, and adds avoidable coupling between filters and expansion.
   - Effort: Medium

### Recommendation
Use approach 1. Remove auto-expansion from the application view-model and make `expandedFleetIds` the sole source of `isExpanded`. Keep filtering as a pure visibility calculation. Add unit regressions for every filter kind and a screen-level interaction regression proving an operator can collapse a filtered fleet and that later filter changes do not reopen it.

### Risks
- Existing tests and architecture prose encode the incorrect forced-expansion behavior and must be changed together to avoid preserving the bug as a contract.
- If future requirements intentionally need search-result reveal, that must be an explicit separate UX decision rather than implicit expansion inside filtering.
- Fleet selection must remain computed from the full roster; this change must not alter checkbox semantics.

### Ready for Proposal
Yes — propose a focused bug fix: filter state narrows visible data, explicit fleet-toggle state alone controls expansion.
