# Proposal: One-click provider catalog import

## Intent
Expose the already implemented Cybermapa and Howen catalog synchronization through a provider-neutral administrator flow that imports provider data into the canonical Sentinel catalog and reports the result clearly.

## Scope
- Add a dedicated admin import page.
- Let an administrator choose a supported provider and start an import without entering internal IDs.
- Reuse the existing provider adapters, catalog synchronization application, Mongo repositories, and authorization rules.
- Connect the canonical catalog projection to Live through a tenant-scoped loader.
- Preserve the existing technical catalog panel as a diagnostic fallback during this change.

## Out of scope
- Changing provider APIs or credential storage.
- Removing the existing technical panel.
- Automatically resolving ambiguous vehicle or fleet matches without domain evidence.
- Production deployment or exposing secrets to the browser.

## Success criteria
An administrator with valid configured runtime credentials can select a provider, start an import, see a translated result with counts/failures, and find the imported canonical vehicles in Live after a successful run.
