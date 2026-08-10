import { isValidInternalSecret } from "@/integrations/security/authorize-internal-secret";

import { buildDueCandidates, getCatalogSyncRuntime } from "./composition";
import { readBearerToken, toSynchronizeResponse, unauthorized } from "./delivery";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.SENTINEL_CATALOG_SYNC_SECRET;
  if (!secret || !isValidInternalSecret(readBearerToken(request), secret)) return unauthorized();

  const { connections, synchronizeDueCatalogConnections, factories } = await getCatalogSyncRuntime();
  const { candidates, unsupported } = await buildDueCandidates(connections, factories);
  const { results } = await synchronizeDueCatalogConnections({ candidates });

  return toSynchronizeResponse(results, unsupported);
}
