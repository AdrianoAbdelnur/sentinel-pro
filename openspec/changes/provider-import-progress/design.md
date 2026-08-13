# Design: Show Real-Time Provider Import Progress

## Technical Approach

Add a typed progress callback to the catalog synchronization path. `import-catalog` emits a snapshot total and per-candidate counters; `import-provider` enriches this with provider-level found fleet/company counts. The route adapts those events to newline-delimited JSON. The client reads the response body incrementally and renders the latest event.

## Architecture Decisions

### Decision: NDJSON stream over a new job system

**Choice**: Keep the current request lifecycle and stream newline-delimited JSON.
**Alternatives considered**: Persisted background jobs with polling; simulated client progress.
**Rationale**: It provides real feedback with a small boundary change, avoids fake numbers, and does not introduce job lifecycle/storage complexity yet.

### Decision: Progress callbacks remain application-owned

**Choice**: Emit progress from application use cases and adapt to transport in the route.
**Alternatives considered**: Instrument Mongo repositories or make the UI infer counts.
**Rationale**: The application knows business outcomes; repositories and UI must not become the progress authority.

## Data Flow

`provider import` → `snapshot event` → `candidate events` → `NDJSON route` → `stream reader` → `progress cards`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `application/catalog/contracts.ts` | Modify | Add progress event types. |
| `application/catalog/import-catalog.ts` | Modify | Emit per-candidate progress. |
| `application/catalog/sync-contracts.ts` | Modify | Carry progress callback through synchronization. |
| `application/catalog/synchronize-catalog-connection.ts` | Modify | Forward progress while renewing leases. |
| `application/catalog/import-provider.ts` | Modify | Compose provider-level progress and found counts. |
| `app/api/admin/import/route.ts` | Modify | Stream NDJSON events. |
| `app/admin/import/provider-import-screen.tsx` | Modify | Render live progress. |

## Testing Strategy

| Layer | What to Test | Approach |
|------|-------------|----------|
| Application | Per-candidate and provider progress | Vitest callback assertions. |
| Delivery | NDJSON event stream shape | Route tests with mocked runtime. |
| UI | Incremental event rendering and failure | React Testing Library stream fixture. |

## Migration / Rollout

No migration required.

## Open Questions

None.
