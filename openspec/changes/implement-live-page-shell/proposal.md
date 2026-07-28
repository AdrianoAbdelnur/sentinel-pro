# Proposal: implement-live-page-shell

## Intent

Deliver the first visible live screen at `/live`, rendering the sidebar and bottom panel over the existing application view models with in-memory data, so the composed contracts are exercised end to end before any provider integration exists.

## Scope

### In Scope
- Compose `LivePageViewModel` from live state, selection, search, and tab inputs
- An in-memory live data source that supplies fleets, vehicles, devices, and telemetry
- A `/live` route rendering the sidebar and bottom panel
- Small presentational components driven exclusively by view models
- Interaction: toggling vehicle and fleet selection, expanding fleets, searching, switching tabs

### Out of Scope
- Map rendering
- Video playback grid and tiles
- Provider adapters and remote fetching
- Route handlers and persistence

## Capabilities

### New Capabilities
- `live-page-shell`: Delivery of the live operator screen over composed view models

### Modified Capabilities
- None

## Approach

Add `buildLivePageViewModel` to compose the existing sidebar and bottom-panel use cases into one page contract. Feed it from an in-memory data source that implements a narrow read port. Render it through small presentational components, with a single client component owning interaction state.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `application/live/*` | Modified | Page-level composition use case and its input contract |
| `integrations/live/in-memory/*` | New | In-memory live data source for development |
| `app/live/*` | New | Route entry for the live screen |
| `components/live/*` | New | Presentational sidebar and bottom-panel components |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Interaction state leaking business rules into components | Medium | Components receive view models only; all derivation stays in application |
| The screen component growing into a god component | Medium | Split into small components from the start; keep state in one thin client island |
| In-memory data becoming a hidden contract | Low | Expose it behind an explicit read port the future provider adapter can implement |

## Rollback Plan

Delete the `app/live` route, `components/live`, and `integrations/live/in-memory`, then revert the page composition use case. The existing application slice remains untouched.

## Dependencies

- `application/live/build-live-sidebar-view-model.ts`
- `application/live/build-live-bottom-panel-view-model.ts`
- `docs/architecture/05-live-application-responsibilities.md`

## Success Criteria

- [ ] `/live` renders fleets, vehicles, and the bottom panel from composed view models
- [ ] Selecting, searching, expanding, and switching tabs work against in-memory data
- [ ] No component contains provider conditionals or business derivation
- [ ] Page composition is covered by unit tests and the screen by component tests
