# Proposal: Resolve Catalog Reviews Atomically

## Intent
Prevent a catalog review from becoming resolved unless its selected canonical association commits with it.

## Scope
- Execute vehicle review resolution in the existing Mongo transaction boundary.
- Atomically claim the scoped external vehicle identity and distinguish same-target idempotence from a different-target conflict.
- Preserve rollback when identity or Vehicle persistence fails.
- Add regression tests for normal resolution, persistence failure, concurrent identity creation, same-target identity, different-target conflict, retry, and final consistency.

## Out of Scope
Provider calls, `.env.local`, other catalog risks, and merge operations.
