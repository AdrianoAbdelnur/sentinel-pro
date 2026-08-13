import {
  assessCatalogSnapshot,
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

  async function synchronizeCatalogConnection({ organizationId, connectionId, trigger, source, onProgress }: SynchronizeCatalogConnectionInput): Promise<CatalogSyncOutcome> {
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

    const provisionalRun = startCatalogSyncRun(runId, { organizationId, connectionId, trigger, fullSnapshot: false }, ports.clock.now());
    if ((await ports.syncRuns.claimActive(provisionalRun)) === "already-active") {
      await ports.syncLeases.release(organizationId, connectionId, runId);
      return { kind: "already-running" };
    }

    let snapshot;
    try {
      snapshot = await source.loadCompleteSnapshot();
    } catch {
      snapshot = { kind: "failed" as const, failure: { category: "internal" as const } };
    }
    if (snapshot.kind === "failed") {
      const failed = failCatalogSyncRun(provisionalRun, ports.clock.now(), snapshot.failure);
      await ports.syncRuns.save(failed);
      await ports.syncLeases.release(organizationId, connectionId, runId);
      return { kind: "retryable-failure", run: failed, failure: snapshot.failure };
    }
    if (!hasCatalogImportAuthorization(connection)) {
      const failure = { category: "invalid-response" as const, providerErrorCode: "missing-authorization" };
      const failed = failCatalogSyncRun(provisionalRun, ports.clock.now(), failure);
      await ports.syncRuns.save(failed);
      await ports.syncLeases.release(organizationId, connectionId, runId);
      return { kind: "retryable-failure", run: failed, failure };
    }
    const candidates = authorizeCatalogSnapshot(connection, snapshot.candidates);
    const priorConfirmed = await ports.syncRuns.findLastConfirmed?.(organizationId, connectionId);
    const assessment = assessCatalogSnapshot(snapshot.evidence, candidates.length, priorConfirmed);
    const run = { ...provisionalRun, fullSnapshot: assessment.status === "complete", snapshot: assessment };
    const authorizedSource: CatalogImportSource = { async loadCompleteSnapshot() { return { kind: "complete", candidates, evidence: snapshot.evidence ?? { retrievalComplete: false, paginationComplete: false, receivedRecordCount: 0, parseableRecordCount: 0 } }; } };
    let result: ImportCatalogResult;
    try {
      const renewLease = createLeaseRenewal(organizationId, connectionId, runId, claimedAt);
      result = await importer.importCatalog({
        connection,
        run,
        source: authorizedSource,
        onProgress: async (progress) => {
          await renewLease();
          await onProgress?.(progress);
        },
      });
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
    const finalRun = shouldReconcileCatalogSyncAbsence(succeeded, priorConfirmed)
      ? { ...succeeded, counts: { ...succeeded.counts, absent: await reconcileAbsence(organizationId, connectionId, runId) } }
      : succeeded;
    await ports.syncRuns.save(finalRun);
    await ports.syncLeases.release(organizationId, connectionId, runId);
    return { kind: "succeeded", run: finalRun };
  }

  return { synchronizeCatalogConnection };
}
