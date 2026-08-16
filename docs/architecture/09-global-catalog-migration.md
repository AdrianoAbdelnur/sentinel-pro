# Global Catalog Migration

## Delivery boundary

`application/catalog-global/migrate-global-catalog.ts` owns migration planning and approval gates. Legacy readers and MongoDB writers are ports and adapters; the migration use case never writes legacy collections.

## Safe rollout

1. Run `npm run migrate:catalog:global -- --report=<path>` for a read-only report.
2. Inspect isolated conflicts. Any conflict blocks apply.
3. A SUPER ADMIN issues a one-purpose approval with `--issue-approval --approved-by=super-admin` and retains the report identifier.
4. Apply only with `--apply=<token> --approved-by=super-admin` and the approved report input.
5. Require all parity gates to pass before writing V2.
6. Enable global Live only after parity with `SENTINEL_LIVE_CATALOG_MODE=global`.

The CLI defaults to dry-run. V2 writes are idempotent through repository upserts, and the approval token is atomically consumed once. Legacy collections are read-only migration inputs and are never modified or deleted. `createLiveReadSwitch().rollback()` immediately restores legacy reads without changing V2 data.
