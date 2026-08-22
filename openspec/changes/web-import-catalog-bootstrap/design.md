# Design: Web import catalog bootstrap

1. Keep `CATALOG_ADAPTER_REGISTRATIONS` in the application bootstrap module and import it from the retained seed script.
2. In `app/api/admin/import/composition.ts`, obtain the shared Mongo client/database, run `initializeCatalogDatabase`, create repositories, register the existing adapters, then compose the current synchronization runtime.
3. Cache `Promise<Runtime>` rather than only the resolved runtime so concurrent web requests share initialization and registration.
4. Add focused composition tests with mocked Mongo/bootstrap dependencies; retain existing persistence tests for idempotent indexes and entity writes.
