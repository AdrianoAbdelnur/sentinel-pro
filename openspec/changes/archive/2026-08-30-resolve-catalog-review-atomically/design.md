# Design: Resolve Catalog Reviews Atomically

## Approach
Extend the catalog transaction repository set to include reviews and external identities. The application resolves a pending vehicle review inside `transactions.run`. It conditionally resolves the review first, atomically ensures the identity target, and then persists a newly requested Vehicle. An identity conflict throws a private transaction-abort error; the application catches it after the transaction runner returns and maps it to an explicit `conflict` result. Any throw aborts all writes.

Mongo implements identity ensuring with `findOneAndUpdate` using the unique identity key and `$setOnInsert`. If a competing sync commits first, Mongo retries the transaction callback on a transient transaction conflict; the retry sees either the same target (success) or a different target (explicit conflict). The existing unique index remains the serialization constraint.

## Contracts
- `ExternalVehicleIdentityRepository.ensureBoundToVehicle(identity): Promise<"bound" | "conflict">`
- `ResolveCatalogReviewResult` gains `{ kind: "conflict" }`.
- `CatalogReviewApplicationPorts` receives `transactions`.

## Ordering
The conditional review resolution runs in the transaction before writes that could otherwise create an orphaned new Vehicle. An identity conflict aborts the transaction, so the resolved review is rolled back. A retry after a committed resolution returns `already-resolved` without writes.

## Test Strategy
Use an in-memory transactional fixture that snapshots maps and restores them on thrown persistence failures or identity conflicts. Cover all requested scenarios and assert review, Vehicle, and identity final state.
