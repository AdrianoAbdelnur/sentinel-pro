import { NextResponse } from "next/server";

import { authorizePlatformRequest } from "@/app/api/admin/users/delivery";
import { getGlobalCatalogSyncRuntime } from "@/app/api/internal/catalog/composition";
import { badRequest, forbidden, toGlobalSyncResponse, unavailable } from "@/app/api/internal/catalog/delivery";

type Context = { params: Promise<{ connectionId: string }> };

export async function POST(request: Request, { params }: Context) {
  const actor = await authorizePlatformRequest(request);
  if (actor instanceof NextResponse) return actor;
  const { connectionId } = await params;
  if (!connectionId.trim()) return badRequest();
  const catalog = await getGlobalCatalogSyncRuntime();
  const connection = await catalog.connections.findById(connectionId);
  if (!connection) return forbidden();
  const provider = await catalog.providers.findById(connection.providerId);
  const source = provider ? catalog.sources.resolve(connection, provider) : undefined;
  if (!source) return unavailable();
  return toGlobalSyncResponse(await catalog.synchronize({ connectionId, trigger: "manual", source }));
}
