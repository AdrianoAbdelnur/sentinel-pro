# Design: Fix Howen Provider Import Preview

## Technical Approach

Change only the transient connection construction in `getProviderImportRuntime`. The preview call already passes `"preview"` as `companyId`, but the composition currently strips it before invoking the connection source factory. Retain that value so the Howen factory can construct `createHowenImportSource`.

## Architecture Decisions

### Decision: Keep preview scope in the transient connection

**Choice**: Include `companyId: "preview"` whenever `loadSource` receives a company scope, including preview.
**Alternatives considered**: Relax the Howen factory to accept an unscoped connection or add a separate preview factory.
**Rationale**: The source contract requires a scope for mapping, and the existing preview marker is already explicit. Relaxing the factory would weaken its invariant; a second factory would duplicate composition logic.

## Data Flow

`importProvider(howen)` → `loadSource(howen, "preview")` → transient connection with `companyId: "preview"` → Howen factory → import source → Howen login and roster request.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/api/admin/import/composition.ts` | Modify | Preserve the supplied transient company scope. |
| `app/api/catalog/connection-sources.test.ts` | Create | Test preview and company-scoped Howen source resolution. |

## Testing Strategy

| Layer | What to Test | Approach |
|------|-------------|----------|
| Integration composition | Preview and existing-company source factories return sources | Vitest with stubbed Howen environment. |

## Migration / Rollout

No migration required.

## Open Questions

None.
