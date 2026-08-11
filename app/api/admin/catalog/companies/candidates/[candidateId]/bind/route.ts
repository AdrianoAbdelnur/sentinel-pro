import { NextResponse } from "next/server";

import { authorizeAdminRequest, readJson } from "@/app/api/admin/users/delivery";

import { getCatalogAdminRuntime } from "../../../../composition";
import { badRequest, catalogForbidden, toCandidateSummary } from "../../../../delivery";

type Context = { params: Promise<{ candidateId: string }> };

export async function POST(request: Request, { params }: Context) {
  const actor = await authorizeAdminRequest(request);
  if (actor instanceof NextResponse) return actor;
  const { candidateId } = await params;
  const body = await readJson(request);
  const companyId = body && typeof body.companyId === "string" && body.companyId.trim() ? body.companyId : undefined;
  if (!candidateId.trim() || !companyId) return badRequest();
  const { bindProviderCompany } = await getCatalogAdminRuntime();
  const result = await bindProviderCompany({ actor, candidateId, companyId });
  if (result.kind === "forbidden") return catalogForbidden();
  return NextResponse.json({ candidate: toCandidateSummary(result.candidate) });
}
