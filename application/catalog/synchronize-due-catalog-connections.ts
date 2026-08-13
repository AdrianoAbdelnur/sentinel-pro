import { isCatalogSyncDue } from "@/domain/catalog";

import type { SynchronizeDueCatalogConnectionsPorts } from "./ports";
import type {
  CatalogSyncBatchResult,
  SynchronizeCatalogConnectionUseCase,
  SynchronizeDueCatalogConnectionsInput,
  SynchronizeDueCatalogConnectionsResult,
} from "./sync-contracts";

export function createSynchronizeDueCatalogConnectionsApplication(
  ports: SynchronizeDueCatalogConnectionsPorts,
  synchronizeCatalogConnection: SynchronizeCatalogConnectionUseCase,
) {
  async function findLastConfirmedOrSuccess(organizationId: string, connectionId: string) {
    return ports.syncRuns.findLastConfirmed
      ? ports.syncRuns.findLastConfirmed(organizationId, connectionId)
      : ports.syncRuns.findLastSuccess(organizationId, connectionId);
  }

  async function synchronizeDueCatalogConnections({ candidates }: SynchronizeDueCatalogConnectionsInput): Promise<SynchronizeDueCatalogConnectionsResult> {
    const results: CatalogSyncBatchResult[] = [];

    for (const { organizationId, connectionId, source } of candidates) {
      try {
        const lastSuccess = await findLastConfirmedOrSuccess(organizationId, connectionId);
        if (!isCatalogSyncDue(lastSuccess?.completedAt, ports.clock.now())) {
          results.push({ organizationId, connectionId, outcome: { kind: "skipped-fresh", lastSuccessAt: lastSuccess?.completedAt as Date } });
          continue;
        }

        const outcome = await synchronizeCatalogConnection({ organizationId, connectionId, trigger: "scheduled", source });
        results.push({ organizationId, connectionId, outcome });
      } catch {
        results.push({ organizationId, connectionId, outcome: { kind: "unexpected-failure" } });
      }
    }

    return { results };
  }

  return { synchronizeDueCatalogConnections };
}
