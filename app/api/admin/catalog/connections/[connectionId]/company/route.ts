import { NextResponse } from "next/server";

import { authorizeAdminRequest, readJson } from "@/app/api/admin/users/delivery";

import { getCatalogAdminRuntime } from "../../../composition";
import { badRequest, catalogForbidden, toConnectionSummary } from "../../../delivery";

type Context = { params: Promise<{ connectionId: string }> };

export async function POST(request: Request, { params }: Context) {
  const actor = await authorizeAdminRequest(request);
  if (actor instanceof NextResponse) return actor;
  const { connectionId } = await params;
  const body = await readJson(request);
  const companyId = body && typeof body.companyId === "string" && body.companyId.trim() ? body.companyId : undefined;
  if (!connectionId.trim() || !companyId) return badRequest();
  const { assignConnectionCompany } = await getCatalogAdminRuntime();
  const result = await assignConnectionCompany({ actor, connectionId, companyId });
  if (result.kind === "forbidden") return catalogForbidden();
  return NextResponse.json({ connection: toConnectionSummary(result.connection) });
}
