# Proposal: Fix Howen Provider Import Preview

## Intent

Restore the Howen import flow, which currently returns HTTP 502 before the provider request because its preview source is rejected as missing a company assignment.

## Scope

### In Scope
- Preserve a non-persisted preview company scope when composing the Howen source.
- Add a regression test proving the Howen preview source can be resolved.

### Out of Scope
- Changes to Howen authentication, roster endpoints, or live behavior.
- Changes to catalog reconciliation rules.

## Capabilities

### New Capabilities
- `howen-provider-import`: Howen provider import can resolve its preview source before company creation.

### Modified Capabilities
- None.

## Approach

Pass the explicit preview scope through the transient `ProviderConnection` used by the import runtime. The Howen factory requires `companyId` to build the mapper-scoped source, while the current composition accidentally removes it for preview. Persisted connections remain unchanged.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/api/admin/import/composition.ts` | Modified | Keep the preview company scope on the transient connection. |
| `app/api/catalog/connection-sources.test.ts` | New | Verify Howen preview source resolution. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Preview scope is persisted accidentally | Low | The change only affects the transient connection passed to `loadSource`; no repository save is added. |

## Rollback Plan

Revert the composition change and regression test.

## Success Criteria

- [ ] Howen preview source resolves with valid Howen configuration.
- [ ] Existing live and Cybermapa behavior remains unchanged.
