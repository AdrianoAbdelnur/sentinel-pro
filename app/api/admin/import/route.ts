import { NextResponse } from "next/server";
import { authorizeAdminRequest, readJson } from "@/app/api/admin/users/delivery";
import { getProviderImportRuntime } from "./composition";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await authorizeAdminRequest(request);
  if (actor instanceof NextResponse) return actor;
  const body = await readJson(request);
  if (!body || (body.provider !== "cybermapa" && body.provider !== "howen")) return NextResponse.json({ error: "Elegí una plataforma válida." }, { status: 400 });
  const result = await (await getProviderImportRuntime())({ organizationId: actor.organizationId, provider: body.provider });
  return NextResponse.json(result, { status: result.status === "succeeded" ? 200 : 502 });
}
