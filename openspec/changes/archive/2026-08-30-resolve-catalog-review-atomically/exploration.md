# Exploration: Resolve Catalog Review Atomically

## Current State
`resolveCatalogReview` claims the pending review before saving the chosen Vehicle and external identity. A persistence failure or a concurrent catalog synchronization can therefore leave the review resolved without its selected association.

## Decision
Use the existing Mongo transaction runner. The review compare-and-set, identity claim, optional new Vehicle creation, and review resolution execute in one transaction. The identity repository needs an atomic ensure operation keyed by tenant, connection, entity kind, and external ID. It returns an idempotent success for the same Vehicle and a conflict for a different one.

## Scope
Only review resolution integrity. No provider calls, environment reads, or unrelated risk remediation.
