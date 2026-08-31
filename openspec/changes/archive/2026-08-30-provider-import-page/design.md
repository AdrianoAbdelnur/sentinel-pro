# Design: One-click provider catalog import

## Boundary
The new page is a delivery adapter. It sends `{ provider }` to a dedicated admin route and renders an application result. It does not call Cybermapa, Howen, MongoDB, or provider-specific endpoints directly.

## Application
Add a provider import orchestration port/use case that resolves the configured provider source, creates or reuses the organization-scoped provider connection, automatically creates discovered Companies with their unassigned fleets, authorizes the provider snapshot, and invokes the existing synchronizer. Existing catalog synchronization remains the source of truth for batching, authorization, matching, reviews, leases, and absence reconciliation.

The orchestration must reject unsupported providers, missing configuration, and unavailable connection state with safe result codes. It must not invent company bindings for ambiguous data.

## Delivery
Add:
- `app/admin/import/page.tsx` as the user-facing admin page.
- Small client components for provider selection, submit state, and result presentation.
- `app/api/admin/catalog/import/route.ts` as the HTTP adapter.

All visible copy is Spanish because the existing user-facing application uses Spanish.

## Live composition
Add a tenant-scoped Mongo catalog loader at the application/infrastructure composition boundary. It loads companies/fleets/vehicles, provider connections, external identities, capability policies, and normalized operational snapshots needed by the canonical projection. The Live page passes `createCanonicalCatalogOperationalSource(loader)` into `createOperationalSources`.

The loader must define the collision policy before combining the old Howen operational source with the canonical source. The canonical source replaces the direct Howen roster for catalog-backed vehicles; it does not duplicate both rosters.

## Testing
- Unit tests for provider orchestration result codes.
- Route tests for admin authorization, provider validation, and safe result projection.
- Testing Library tests for the page flow and translated result counts.
- Loader/projection tests proving tenant isolation and canonical vehicle availability.
- Existing catalog, integration, typecheck, lint, and build checks.
