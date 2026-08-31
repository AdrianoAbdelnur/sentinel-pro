# Proposal: Server-Side Pagination for Live

## Intent

Prevent large fleets from loading thousands of vehicles and GPS records into the browser while preserving the existing provider-neutral Live state and playback flow.

## Scope

### In Scope
- Add 50-item server-side pagination to the group vehicle endpoint.
- Apply organization, group, and plate filtering before pagination in MongoDB.
- Fetch provider snapshots only for the returned vehicle page, with fresh Cybermapa DATOSACTUALES requests.
- Add page navigation without changing selection, map, or playback contracts.

### Out of Scope
- Additional caching, background polling, or changes to provider playback.
- Changes to unrelated catalog/import behavior.
- Changes to `verify-report.md`.

## Capabilities

### Modified Capabilities
- `live`: paged group loading and server-side plate filtering.

## Approach

Extend the existing lazy group-loading use case and repository with a paged query result. Keep the response as the existing `LiveState` shape, adding optional pagination metadata to the loaded fleet. The client requests pages using query parameters and renders controls through the existing sidebar.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `application/live` | Modified | Page input, metadata, and orchestration. |
| `integrations/persistence/mongodb` | Modified | Filtered count plus page-only vehicle query. |
| `integrations/catalog` | Modified | Provider snapshots for page vehicles. |
| `app/api/live` | Modified | Validate and pass pagination parameters. |
| `components/live` | Modified | Request and render pages. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Existing callers expect plain `LiveState` | Low | Keep metadata optional on the existing state contract. |
| Search results become stale while typing | Med | Reset to page one and reload only expanded groups. |

## Rollback Plan

Revert the branch changes; the existing endpoint and lazy-load behavior remain the fallback.

## Success Criteria

- [ ] A page never contains more than 50 vehicles.
- [ ] MongoDB applies group and plate filters before skip/limit.
- [ ] Cybermapa receives only plates from the requested page and no cache is added.
- [ ] Existing Live tests, lint, typecheck, and tests pass.
