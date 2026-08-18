import { isValidInternalSecret } from "@/integrations/security/authorize-internal-secret";

import { getGlobalCatalogSyncRuntime } from "../composition";
import { readBearerToken, unauthorized } from "../delivery";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = process.env.SENTINEL_CATALOG_SYNC_SECRET;
  if (!expected || !isValidInternalSecret(readBearerToken(request), expected)) return unauthorized();
  const catalog = await getGlobalCatalogSyncRuntime();
  const results = [];
  for (const connection of await catalog.listDueConnections()) {
    const provider = await catalog.providers.findById(connection.providerId);
    const source = provider ? catalog.sources.resolve(connection, provider) : undefined;
    results.push(source ? await catalog.synchronize({ connectionId: connection.id, trigger: "scheduler", source }) : { kind: "misconfigured" as const });
  }
  return Response.json({ results: results.map((outcome) => outcome.kind === "failed" ? { kind: outcome.kind, retryable: outcome.retryable, failureCategory: outcome.failure.category } : { kind: outcome.kind }) });
}
