# Exploration: Web import catalog bootstrap

## Current State

The web import composition opens MongoDB and creates repositories, but it neither initializes catalog collections/indexes nor registers the Cybermapa/Howen provider definitions and enabled connections. Those steps currently exist only in `catalog-initialize.ts` and `catalog-seed.ts`. The synchronization and persistence layers already use atomic upserts and uniqueness indexes.

## Affected Areas

- `app/api/admin/import/composition.ts` — web runtime entry point missing bootstrap.
- `integrations/persistence/mongodb/catalog-initializer.ts` — existing idempotent Mongo setup to reuse.
- `application/catalog/bootstrap-catalog.ts` — existing idempotent provider/connection setup.
- `integrations/persistence/mongodb/catalog-seed.ts` — existing registration data currently coupled to the script.

## Recommendation

Call the existing initializer and bootstrap application from the web import composition, reuse one registration constant, and cache the in-flight runtime promise. Do not alter import adapters or domain contracts.

## Risks

- A process-local cache does not replace Mongo uniqueness constraints for multi-process startup; those constraints already exist.
- Other catalog routes may still require their own bootstrap if used before import; that is outside this request.
