import {
  failCatalogSyncRun,
  isCatalogSyncDue,
  markExternalVehicleIdentityAbsent,
  shouldReconcileCatalogSyncAbsence,
  startCatalogSyncRun,
  succeedCatalogSyncRun,
} from "@/domain/catalog";

import type { ImportCatalogResult } from "./contracts";
import { authorizeCatalogSnapshot, hasCatalogImportAuthorization } from "./authorize-catalog-snapshot";
import { createImportCatalogApplication } from "./import-catalog";
import type { CatalogImportSource, SynchronizeCatalogConnectionPorts } from "./ports";
import type { CatalogSyncOutcome, SynchronizeCatalogConnectionInput } from "./sync-contracts";

export const CATALOG_SYNC_LEASE_DURATION_MS = 5 * 60 * 1000;
export const CATALOG_SYNC_LEASE_RENEWAL_INTERVAL_MS = CATALOG_SYNC_LEASE_DURATION_MS / 3;

export function createSynchronizeCatalogConnectionApplication(ports: SynchronizeCatalogConnectionPorts) {
  const importer = createImportCatalogApplication(ports);

  async function abandonExpiredPreviousRun(previousRunId: string, now: Date): Promise<void> {
    const previousRun = await ports.syncRuns.findById(previousRunId);
    if (previousRun && previousRun.status === "active") {
      await ports.syncRuns.save(failCatalogSyncRun(previousRun, now, { category: "internal" }));
    }
  }

  async function reconcileAbsence(organizationId: string, connectionId: string, runId: string): Promise<number> {
    const stale = await ports.vehicleIdentities.listStaleByRun(organizationId, connectionId, runId);
    for (const identity of stale) await ports.vehicleIdentities.save(markExternalVehicleIdentityAbsent(identity));
    return stale.length;
  }

  function createLeaseRenewal(organizationId: string, connectionId: string, runId: string, claimedAt: Date): () => Promise<void> {
    let lastRenewedAt = claimedAt;
    return async function renewLeaseIfDue(): Promise<void> {
      const now = ports.clock.now();
      if (now.getTime() - lastRenewedAt.getTime() < CATALOG_SYNC_LEASE_RENEWAL_INTERVAL_MS) return;
      const claim = await ports.syncLeases.claim(organizationId, connectionId, runId, now, CATALOG_SYNC_LEASE_DURATION_MS);
      if (claim.outcome === "held") throw new Error("catalog sync lease was lost before the import finished");
      lastRenewedAt = now;
    };
  }

  async function synchronizeCatalogConnection({ organizationId, connectionId, trigger, source }: SynchronizeCatalogConnectionInput): Promise<CatalogSyncOutcome> {
    const connection = await ports.connections.findById(organizationId, connectionId);
    if (!connection) return { kind: "not-found" };

    const runId = ports.ids.create();
    const claimedAt = ports.clock.now();
    const claim = await ports.syncLeases.claim(organizationId, connectionId, runId, claimedAt, CATALOG_SYNC_LEASE_DURATION_MS);
    if (claim.outcome === "held") return { kind: "already-running" };
    if (claim.previousRunId) await abandonExpiredPreviousRun(claim.previousRunId, ports.clock.now());

    if (trigger === "scheduled") {
      const lastSuccess = await ports.syncRuns.findLastSuccess(organizationId, connectionId);
      if (!isCatalogSyncDue(lastSuccess?.completedAt, ports.clock.now())) {
        await ports.syncLeases.release(organizationId, connectionId, runId);
        return { kind: "skipped-fresh", lastSuccessAt: lastSuccess?.completedAt as Date };
      }
    }

    const run = startCatalogSyncRun(runId, { organizationId, connectionId, trigger, fullSnapshot: true }, ports.clock.now());
    if ((await ports.syncRuns.claimActive(run)) === "already-active") {
      await ports.syncLeases.release(organizationId, connectionId, runId);
      return { kind: "already-running" };
    }

    const authorizedSource: CatalogImportSource = {
      async loadCompleteSnapshot() {
        if (!hasCatalogImportAuthorization(connection)) return { kind: "failed", failure: { category: "invalid-response", providerErrorCode: "missing-authorization" } };
        const snapshot = await source.loadCompleteSnapshot();
        return snapshot.kind === "complete" ? { ...snapshot, candidates: authorizeCatalogSnapshot(connection, snapshot.candidates) } : snapshot;
      },
    };

    let result: ImportCatalogResult;
    try {
      result = await importer.importCatalog({ connection, run, source: authorizedSource, onProgress: createLeaseRenewal(organizationId, connectionId, runId, claimedAt) });
    } catch {
      result = { kind: "failed", failure: { category: "internal" } };
    }
    const completedAt = ports.clock.now();

    if (result.kind === "failed") {
      const failed = failCatalogSyncRun(run, completedAt, result.failure);
      await ports.syncRuns.save(failed);
      await ports.syncLeases.release(organizationId, connectionId, runId);
      return { kind: "retryable-failure", run: failed, failure: result.failure };
    }

    const succeeded = succeedCatalogSyncRun({ ...run, checkpoint: result.checkpoint }, completedAt, result.counts);
    const finalRun = shouldReconcileCatalogSyncAbsence(succeeded)
      ? { ...succeeded, counts: { ...succeeded.counts, absent: await reconcileAbsence(organizationId, connectionId, runId) } }
      : succeeded;
    await ports.syncRuns.save(finalRun);
    await ports.syncLeases.release(organizationId, connectionId, runId);
    return { kind: "succeeded", run: finalRun };
  }

  return { synchronizeCatalogConnection };
}
