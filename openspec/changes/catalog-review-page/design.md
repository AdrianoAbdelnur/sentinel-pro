# Design: Catalog review resolution page

## Approach
Add a thin protected Server Component page at `app/admin/revisiones/page.tsx` and reuse the existing client review list. Move initial loading into the client list so the page is useful immediately and preserve the existing review route/application authorization.

## Decisions
- Reuse `/api/admin/catalog/reviews` and `/api/admin/catalog/reviews/[reviewId]/resolve`; no duplicate business logic.
- Keep resolution target IDs explicit until a read model provides labels; this change improves access and flow without inventing entity data.
- Preserve existing domain restrictions: fleet reviews resolve only to existing fleets; vehicle reviews may resolve to an existing vehicle or a new vehicle.

## Testing
- Page authorization test.
- Client list tests for automatic load, empty state, success removal, and failure retention.
- Existing route/application tests remain the contract for authorization and resolution.
