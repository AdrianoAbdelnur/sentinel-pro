# Design: Restore Howen Fleet Catalog Import

## Technical Approach

Resolve each Howen external fleet before placing its vehicles. The application layer will treat the connection-scoped external fleet identity as the idempotency key. An unbound identity will create one canonical standard Fleet under the authorized Company, persist the binding, and update the in-memory fleet cache used by placement. Existing bound identities remain authoritative.

## Architecture Decisions

### Decision: Create fleets in the application boundary

**Choice**: `import-catalog.ts` creates and persists canonical Fleets through `FleetRepository`.
**Alternatives considered**: Provider adapter creation; rejected because integrations must translate external data and cannot own canonical state.
**Rationale**: Company authorization, identity binding, and vehicle placement are one application workflow.

### Decision: Use external fleet identity for idempotency

**Choice**: Reuse an identity already bound to the same organization, connection, and external fleet ID; otherwise create one Fleet and bind the identity.
**Alternatives considered**: Match by fleet label; rejected because labels are not stable or unique.
**Rationale**: Howen's fleet ID is the provider identity already carried by the candidate.

### Decision: Keep unassigned only as a safety fallback

**Choice**: A valid, resolved Howen fleet is always passed to placement; unassigned remains for candidates without a resolved fleet according to existing contracts.
**Alternatives considered**: Remove unassigned entirely; rejected because native/manual flows still require it.
**Rationale**: The fix must preserve existing catalog behavior outside valid Howen fleet imports.

## Data Flow

`Howen candidate -> application fleet resolver -> Fleet + bound external identity -> vehicle placement -> repositories`

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `application/catalog/import-catalog.ts` | Modify | Create/reuse canonical fleets and bind identities before vehicle save. |
| `application/catalog/import-catalog.test.ts` | Modify | Cover creation, grouping, repeat import, and existing bindings. |
| `openspec/.../tasks.md` | Create | Implementation checklist. |

## Testing Strategy

Unit tests will exercise the existing application fixture and assert fleet and vehicle state for first import, multiple external fleets, repeat import, and pre-bound identities. Existing Howen mapper tests remain unchanged.

## Migration / Rollout

No migration required. The previously deleted incorrect vehicles will be reimported after the fix.

## Open Questions

None.
