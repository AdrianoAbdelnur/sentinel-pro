import { NextResponse } from "next/server";

import { authorizePlatformRequest } from "@/app/api/admin/users/delivery";
import { getCatalogSyncRuntime } from "@/app/api/internal/catalog/composition";
import { badRequest, forbidden, projectCatalogSyncRun } from "@/app/api/internal/catalog/delivery";


type Context = { params: Promise<{ connectionId: string }> };

export async function GET(request: Request, { params }: Context) {
  const actor = await authorizePlatformRequest(request);
  if (actor instanceof NextResponse) return actor;
  const { connectionId } = await params;
  if (!connectionId.trim()) return badRequest();
  const result = await (await getCatalogSyncRuntime()).getStatus(connectionId);
  if (result.kind === "not-found") return forbidden();
  return NextResponse.json({ status: { ...result.status, latestRun: projectCatalogSyncRun(result.status.latestRun) } });
}
