import { NextResponse } from "next/server";

import { authorizePlatformRequest } from "@/app/api/admin/users/delivery";
import { getGlobalCatalogSyncRuntime } from "@/app/api/internal/catalog/v2/composition";
import { badRequest, forbidden, toGlobalSyncResponse, unavailable } from "@/app/api/internal/catalog/v2/delivery";

type Context = { params: Promise<{ connectionId: string }> };

export async function POST(request: Request, { params }: Context) {
  const actor = await authorizePlatformRequest(request);
  if (actor instanceof NextResponse) return actor;
  const { connectionId } = await params;
  if (!connectionId.trim()) return badRequest();
  const runtime = await getGlobalCatalogSyncRuntime();
  const connection = await runtime.connections.findById(connectionId);
  if (!connection) return forbidden();
  const provider = await runtime.providers.findById(connection.providerId);
  const source = provider ? runtime.sources.resolve(connection, provider) : undefined;
  if (!source) return unavailable();
  return toGlobalSyncResponse(await runtime.synchronize({ connectionId, trigger: "manual", source }));
}
