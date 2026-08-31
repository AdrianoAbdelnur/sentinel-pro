# Design: Handle Expired Admin Sessions in Provider Import

## Technical Approach

The client import action will inspect the HTTP response before reading the NDJSON body. Authentication statuses will invoke Next navigation to `/login` and return immediately. Successful HTTP responses will retain the existing streamed progress behavior, including provider failures.

## Architecture Decisions

### Decision: Handle authentication at the delivery boundary

**Choice**: Detect HTTP authentication status in `ProviderImportScreen` before parsing provider events.
**Alternatives considered**: Expose session semantics through the provider result; rejected because Sentinel authentication is an HTTP delivery concern.
**Rationale**: Provider failures and Sentinel session failures must remain distinct.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/admin/import/provider-import-screen.tsx` | Modify | Redirect on HTTP authentication failure. |
| `app/admin/import/provider-import-screen.test.tsx` | Modify | Cover redirect and provider failure separation. |

## Testing Strategy

Use React Testing Library with a mocked Next router and fetch responses for HTTP 403 and authenticated provider failure.
