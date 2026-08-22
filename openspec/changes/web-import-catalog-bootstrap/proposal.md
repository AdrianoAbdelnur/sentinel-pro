# Proposal: Bootstrap catalog imports from the web

## Intent

Make the existing Cybermapa and Howen web import self-sufficient when MongoDB is empty or not initialized, without changing import behavior or provider contracts.

## Scope

### In Scope
- Initialize catalog collections and indexes from the web import composition.
- Register the existing Cybermapa and Howen provider definitions/connections idempotently before resolving the requested import.
- Prevent duplicate bootstrap work from concurrent calls in the same application process.
- Add focused tests.

### Out of Scope
- Changes to clients, mappers, matching, reviews, persistence model, UI, scripts, migrations, seeds, Live, or providers.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `global-provider-registry`: web import bootstraps the existing global provider registrations when absent.
- `catalog-synchronization`: web import can start against an uninitialized catalog database.

## Approach

Reuse the current catalog initializer and bootstrap application from the import runtime. Move the existing adapter registration data to the application bootstrap module so the web composition and the retained seed script use one definition. Cache the runtime promise so concurrent requests share one initialization and registration sequence.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/api/admin/import/composition.ts` | Modified | Initialize Mongo and register existing adapters before creating the runtime. |
| `application/catalog/bootstrap-catalog.ts` | Modified | Own the existing adapter registration data. |
| `integrations/persistence/mongodb/catalog-seed.ts` | Modified | Reuse registration data; script behavior remains available. |
| Focused tests | Modified | Cover automatic bootstrap and cached/idempotent runtime setup. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Bootstrap runs more than once during concurrent requests | Low | Cache the in-flight runtime promise and retain unique Mongo indexes. |
| Existing seed behavior changes | Low | Keep the script and reuse the same registration constant only. |

## Rollback Plan

Revert the composition/bootstrap changes; existing manual scripts remain unchanged and available.

## Success Criteria

- [ ] Web import initializes required catalog Mongo structures without manual commands.
- [ ] Cybermapa and Howen registrations are reused on repeated imports.
- [ ] Focused tests pass without touching real data.
