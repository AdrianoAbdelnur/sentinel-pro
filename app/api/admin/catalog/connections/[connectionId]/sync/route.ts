import { NextResponse } from "next/server";

import { authorizeAdminRequest } from "@/app/api/admin/users/delivery";
import { resolveConnectionSource } from "@/app/api/internal/catalog/synchronize/composition";

import { getCatalogAdminRuntime } from "../../../composition";
import { badRequest, catalogForbidden, toSyncOutcomeResponse, unsupportedProvider } from "../../../delivery";

type Context = { params: Promise<{ connectionId: string }> };

export async function POST(request: Request, { params }: Context) {
  const actor = await authorizeAdminRequest(request);
  if (actor instanceof NextResponse) return actor;
  const { connectionId } = await params;
  if (!connectionId.trim()) return badRequest();
  const { connections, synchronizeCatalogConnection, factories } = await getCatalogAdminRuntime();
  const connection = await connections.findById(actor.organizationId, connectionId);
  if (!connection) return catalogForbidden();
  const source = resolveConnectionSource(connection, factories);
  if (!source) return unsupportedProvider();
  const outcome = await synchronizeCatalogConnection({ organizationId: actor.organizationId, connectionId, trigger: "manual", source });
  return toSyncOutcomeResponse(outcome);
}
