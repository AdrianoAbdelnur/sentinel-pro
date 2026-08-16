import { isValidInternalSecret } from "@/integrations/security/authorize-internal-secret";

import { buildDueCandidates, getCatalogSyncRuntime, type ConnectionSourceFactories } from "./composition";
import { readBearerToken, toSynchronizeResponse, unauthorized } from "./delivery";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.SENTINEL_CATALOG_SYNC_SECRET;
  if (!secret || !isValidInternalSecret(readBearerToken(request), secret)) return unauthorized();

  const runtime = await getCatalogSyncRuntime();
  const { connections, synchronizeDueCatalogConnections } = runtime;
  const registry = "registry" in runtime ? runtime.registry : (runtime as { factories: ConnectionSourceFactories }).factories;
  const { candidates, unsupported, missingCompanyAssignment, misconfigured } = await buildDueCandidates(connections, registry);
  const { results } = await synchronizeDueCatalogConnections({ candidates });

  return toSynchronizeResponse(results, unsupported, missingCompanyAssignment, misconfigured);
}
