import { NextResponse } from "next/server";

import { authorizeAdminRequest } from "@/app/api/admin/users/delivery";

import { getCatalogAdminRuntime } from "../../../composition";
import { badRequest, catalogForbidden } from "../../../delivery";

type Context = { params: Promise<{ connectionId: string }> };

export async function GET(request: Request, { params }: Context) {
  const actor = await authorizeAdminRequest(request);
  if (actor instanceof NextResponse) return actor;
  const { connectionId } = await params;
  if (!connectionId.trim()) return badRequest();
  const { getCatalogSyncStatus } = await getCatalogAdminRuntime();
  const result = await getCatalogSyncStatus({ organizationId: actor.organizationId, connectionId });
  if (result.kind === "not-found") return catalogForbidden();
  return NextResponse.json({ status: result.status });
}
