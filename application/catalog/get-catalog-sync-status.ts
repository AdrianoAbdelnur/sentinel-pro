import { isCatalogSyncDue, type CatalogSyncRun } from "@/domain/catalog";

import type { GetCatalogSyncStatusPorts } from "./ports";
import type { CatalogSyncRunSummary, GetCatalogSyncStatusInput, GetCatalogSyncStatusResult } from "./sync-contracts";

function projectRunSummary(run: CatalogSyncRun | undefined): CatalogSyncRunSummary | undefined {
  if (!run) return undefined;
  return { status: run.status, trigger: run.trigger, startedAt: run.startedAt, completedAt: run.completedAt, counts: run.counts, failureSummary: run.failureSummary };
}

export function createGetCatalogSyncStatusApplication(ports: GetCatalogSyncStatusPorts) {
  async function getCatalogSyncStatus({ organizationId, connectionId }: GetCatalogSyncStatusInput): Promise<GetCatalogSyncStatusResult> {
    const connection = await ports.connections.findById(organizationId, connectionId);
    if (!connection) return { kind: "not-found" };

    const [latestRun, lastSuccess] = await Promise.all([
      ports.syncRuns.findLatest(organizationId, connectionId),
      ports.syncRuns.findLastSuccess(organizationId, connectionId),
    ]);

    return {
      kind: "found",
      status: {
        connectionId,
        latestRun: projectRunSummary(latestRun),
        lastSuccessAt: lastSuccess?.completedAt,
        isDue: isCatalogSyncDue(lastSuccess?.completedAt, ports.clock.now()),
      },
    };
  }

  return { getCatalogSyncStatus };
}
