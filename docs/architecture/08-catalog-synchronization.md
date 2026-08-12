# Catalog Synchronization

## Goal

Define the operational contract for keeping the canonical `Company -> Fleet ->
Vehicle` catalog synchronized with provider systems (Cybermapa, Howen): who
triggers a sync, how often, under what authorization, and how to roll the
feature out or back.

## Cadence

- `SynchronizeDueCatalogConnections` computes freshness as
  `lastSuccessfulAt + 6h`. A connection becomes due for a new run six hours
  after its last successful completion; a run that fails or only partially
  completes does not reset this clock.
- `POST /api/internal/catalog/synchronize` (the cron entry point) evaluates
  every enabled connection once per invocation and synchronizes only the ones
  currently due. It does not own a schedule itself — a hosting cron
  scheduler is expected to call it repeatedly (for example every few
  minutes) so no due connection waits meaningfully longer than six hours.
- A manual `Sync now`
  (`POST /api/admin/catalog/connections/[connectionId]/sync`) bypasses the
  due-connections freshness gate for that one connection at the requesting
  admin's initiative. A manual trigger never re-checks freshness: the
  post-lease recheck in `SynchronizeCatalogConnection` is gated behind
  `trigger === "scheduled"`, and a manual run is meant to proceed regardless
  of how recently the connection last succeeded.

  Two distinct mechanisms keep runs from overlapping, and they protect
  different scenarios. The per-connection lease is what stops a manual and a
  scheduled trigger racing each other: exactly one claims it and the loser
  reports `already-running`. The post-lease freshness recheck instead
  protects the sequential case, where a scheduled run's due-candidate list
  was computed before some other run completed and is stale by the time the
  lease is held. Do not treat either as a substitute for the other.

## Security

- `app/api/internal/catalog/synchronize/route.ts` declares
  `export const runtime = "nodejs"`. The Edge runtime cannot run the
  constant-time secret comparison this route needs, and the MongoDB driver
  used by every catalog repository requires Node APIs.
- Authorization is a Bearer token compared against the server-only
  `SENTINEL_CATALOG_SYNC_SECRET` using
  `integrations/security/authorize-internal-secret.ts`'s constant-time
  comparison, never `===`, to avoid a timing side-channel. A missing or
  mismatched secret returns 401 with no further detail; the secret itself is
  never logged, echoed, or included in any response body.
- Manual `Sync now` carries no separate secret. It reuses the same
  same-origin, session-token, and fresh tenant-admin authorization
  (`authorizeAdminRequest`) as every other `/api/admin/catalog/**` route.

## Rollout

1. Add the catalog collections and indexes idempotently — existing
   migrations are safe to re-run and do not duplicate or drop data.
2. Configure `SENTINEL_CATALOG_SYNC_SECRET` in the server environment.
3. Run an initial Cybermapa sync, then an initial Howen sync. A Howen
   connection only resolves to a real `CatalogImportSource` once an
   administrator has assigned it a Company via
   `POST /api/admin/catalog/connections/[connectionId]/company`; before that,
   cron and manual sync both classify it as `missing-company-assignment`,
   distinct from `unsupported` (no matching provider factory at all) and
   `misconfigured` (a factory exists but declines) — see
   `app/api/catalog/connection-sources.ts`'s `classifyConnectionSourceProblem`.
4. Enable the cron scheduler against `POST /api/internal/catalog/synchronize`
   once both providers have reached parity with the previous data source.

## Rollback

Disabling the cron scheduler, the manual sync routes, and the live
composition's canonical feature switch (`05-live-application-responsibilities.md`)
fully reverts to pre-catalog behavior. Catalog data, sync run history,
Company/Fleet bindings, pending and resolved reviews, and admin-assigned
placement are untouched by rollback — they simply stop being read until the
feature switch is re-enabled.
