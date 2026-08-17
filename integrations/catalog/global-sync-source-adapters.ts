import type { GlobalSyncSource, GlobalSnapshot } from "@/application/catalog-global/synchronize-global-connection";
import type { ProviderConnection as GlobalConnection, ProviderDefinition } from "@/domain/catalog-global";
import { createCybermapaClient, CybermapaRequestError } from "@/integrations/cybermapa/client";
import { readCybermapaConfig } from "@/integrations/cybermapa/config";
import { mapCybermapaGlobalCatalog } from "@/integrations/cybermapa/seed-cybermapa-catalog";
import { createHowenClient, HowenRequestError } from "@/integrations/howen/client";
import { readHowenConfig } from "@/integrations/howen/config";
import { createHowenSessionManager } from "@/integrations/howen/session";
import { mapHowenGlobalCatalog } from "@/integrations/howen/seed-howen-catalog";

export type GlobalSyncSourceRegistry = { resolve(connection: GlobalConnection, provider: ProviderDefinition): GlobalSyncSource | undefined };
type SourceFactory = (connection: GlobalConnection) => GlobalSyncSource | undefined;

function failure(error: unknown) {
  if (error instanceof CybermapaRequestError || error instanceof HowenRequestError) return { category: error.category, ...(error.httpStatus !== undefined ? { httpStatus: error.httpStatus } : {}) };
  return { category: "internal" as const };
}

function createCybermapaSource(connection: GlobalConnection): GlobalSyncSource | undefined {
  try {
    const client = createCybermapaClient({ config: readCybermapaConfig() });
    return { async loadSnapshot(): Promise<GlobalSnapshot> { try { const records = await client.fetchVehicles(); const candidates = mapCybermapaGlobalCatalog(records, { connectionId: connection.id }); const receivedRecordCount = (records as typeof records & { receivedRecordCount?: number }).receivedRecordCount ?? records.length; return { kind: "complete", candidates, evidence: { retrievalComplete: true, paginationComplete: true, receivedRecordCount, parseableRecordCount: records.length } }; } catch (error) { return { kind: "failed", failure: failure(error) }; } } };
  } catch { return undefined; }
}

function createHowenSource(connection: GlobalConnection): GlobalSyncSource | undefined {
  try {
    const config = readHowenConfig();
    const client = createHowenClient({ config, session: createHowenSessionManager({ config }) });
    return { async loadSnapshot(): Promise<GlobalSnapshot> { try { const records = await client.fetchRoster(); const candidates = mapHowenGlobalCatalog(records, { connectionId: connection.id, resolveInitialPlacementFleetId: () => undefined }); const receivedRecordCount = (records as typeof records & { receivedRecordCount?: number }).receivedRecordCount ?? records.length; return { kind: "complete", candidates, evidence: { retrievalComplete: true, paginationComplete: true, receivedRecordCount, parseableRecordCount: records.length } }; } catch (error) { return { kind: "failed", failure: failure(error) }; } } };
  } catch { return undefined; }
}

export function createGlobalSyncSourceRegistry(): GlobalSyncSourceRegistry {
  const factories: Record<string, SourceFactory> = { cybermapa: createCybermapaSource, howen: createHowenSource };
  return { resolve(connection, provider) { return factories[provider.adapterKey]?.(connection); } };
}
