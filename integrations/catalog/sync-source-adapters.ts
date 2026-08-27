import type { CatalogSyncSource, CatalogSnapshot } from "@/application/catalog/synchronize-connection";
import type { ProviderConnection as CatalogConnection, Provider } from "@/domain/catalog";
import { createCybermapaClient, CybermapaRequestError } from "@/integrations/cybermapa/client";
import { readCybermapaConfig } from "@/integrations/cybermapa/config";
import { mapCybermapaCatalog } from "@/integrations/cybermapa/seed-cybermapa-catalog";
import { createHowenClient, HowenRequestError } from "@/integrations/howen/client";
import { readHowenConfig } from "@/integrations/howen/config";
import { createHowenSessionManager } from "@/integrations/howen/session";
import { mapHowenCatalog } from "@/integrations/howen/seed-howen-catalog";
import { createHowenFleetCompanyResolver } from "@/integrations/howen/fleet";

export type CatalogSyncSourceRegistry = { resolve(connection: CatalogConnection, provider: Provider): CatalogSyncSource | undefined };
type SourceFactory = (connection: CatalogConnection) => CatalogSyncSource | undefined;

function failure(error: unknown) {
  if (error instanceof CybermapaRequestError || error instanceof HowenRequestError) return { category: error.category, ...(error.httpStatus !== undefined ? { httpStatus: error.httpStatus } : {}) };
  return { category: "internal" as const };
}

function createCybermapaSource(connection: CatalogConnection): CatalogSyncSource | undefined {
  try {
    const client = createCybermapaClient({ config: readCybermapaConfig() });
    return { async loadSnapshot(): Promise<CatalogSnapshot> { try { const records = await client.fetchVehicles(); const candidates = mapCybermapaCatalog(records, { connectionId: connection.id }); const receivedRecordCount = (records as typeof records & { receivedRecordCount?: number }).receivedRecordCount ?? records.length; return { kind: "complete", candidates, evidence: { retrievalComplete: true, paginationComplete: true, receivedRecordCount, parseableRecordCount: records.length } }; } catch (error) { return { kind: "failed", failure: failure(error) }; } } };
  } catch { return undefined; }
}

function createHowenSource(connection: CatalogConnection): CatalogSyncSource | undefined {
  try {
    const config = readHowenConfig();
    const client = createHowenClient({ config, session: createHowenSessionManager({ config }) });
    return { async loadSnapshot(): Promise<CatalogSnapshot> { try { const fleets = await client.fetchFleets(); const records = await client.fetchRoster(); const resolveFleetCompany = createHowenFleetCompanyResolver(fleets); const candidates = mapHowenCatalog(records, { connectionId: connection.id, resolveInitialPlacementFleetId: () => undefined, resolveFleetCompany: (fleetId) => { const result = resolveFleetCompany(fleetId); return { company: result.company, companySourceFleetId: result.companySourceFleetId, outcome: result.outcome }; } }); const receivedRecordCount = (records as typeof records & { receivedRecordCount?: number }).receivedRecordCount ?? records.length; return { kind: "complete", candidates, evidence: { retrievalComplete: true, paginationComplete: true, receivedRecordCount, parseableRecordCount: records.length } }; } catch (error) { return { kind: "failed", failure: failure(error) }; } } };
  } catch { return undefined; }
}

export function createCatalogSyncSourceRegistry(): CatalogSyncSourceRegistry {
  const factories: Record<string, SourceFactory> = { cybermapa: createCybermapaSource, howen: createHowenSource };
  return { resolve(connection, provider) { return factories[provider.adapterKey]?.(connection); } };
}
